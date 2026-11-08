// Ví hoa hồng + chi trả (0006_payouts.sql): partner_wallet, request_payout, decide_payout,
// mark_payout_paid, create_payout_batch; RLS payouts/payout_batches; quyền execute RPC.
import { afterAll, beforeEach, describe, expect, test } from 'vitest'
import {
  adminClient,
  anonClient,
  createPartner,
  createStaff,
  insertOrderFor,
  resetData,
  type TestPartner,
} from './helpers'

const MIN = 100000
const BANK = { bank_name: 'Vietcombank', bank_account: '0123456789', bank_holder: 'NGUYEN VAN A' }

beforeEach(resetData)
afterAll(resetData)

/** Ngày hôm nay theo giờ VN dạng YYYY-MM-DD, cộng thêm `days`. */
function vnDate(days = 0): string {
  const d = new Date(Date.now() + days * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d)
}

/** Hoa hồng earn trên một đơn mới; trả order id (để thêm reversal). */
async function earn(p: { partnerId: string }, amount: number, createdAt?: string): Promise<string> {
  const orderId = await insertOrderFor(p.partnerId)
  await adminClient().from('commission_entries').insert({
    partner_id: p.partnerId, order_id: orderId, kind: 'earn', amount, period: '2026-11',
    ...(createdAt ? { created_at: createdAt } : {}),
  }).throwOnError()
  return orderId
}

async function reversal(p: { partnerId: string }, orderId: string, amount: number) {
  await adminClient().from('commission_entries').insert({
    partner_id: p.partnerId, order_id: orderId, kind: 'reversal', amount: -amount, period: '2026-11',
  }).throwOnError()
}

async function setBank(p: { partnerId: string }, bank: Partial<typeof BANK> = BANK) {
  await adminClient().from('partners').update(bank).eq('id', p.partnerId).throwOnError()
}

async function ctv(opts: { bank?: boolean } = {}): Promise<TestPartner> {
  const p = await createPartner({ kind: 'commission' })
  if (opts.bank ?? true) await setBank(p)
  return p
}

async function wallet(p: { partnerId: string }) {
  const { data, error } = await adminClient().rpc('partner_wallet', { p_partner_id: p.partnerId }).single()
  if (error) throw error
  return data
}

const request = (p: { partnerId: string }, amount: number, min = MIN) =>
  adminClient().rpc('request_payout', { p_partner_id: p.partnerId, p_amount: amount, p_min: min })

async function requestOk(p: { partnerId: string }, amount: number, min = MIN): Promise<string> {
  const { data, error } = await request(p, amount, min)
  if (error) throw error
  return data
}

const decide = (id: string, action: string, reason: string | null = null, actor: string | null = null) =>
  // `action` để string: test cả giá trị ngoài kiểu (invalid_action).
  adminClient().rpc('decide_payout', {
    p_payout_id: id, p_action: action as 'approve' | 'reject', p_actor: actor, p_reason: reason,
  })

const markPaid = (id: string, ref = 'GD123', date = vnDate(), proof: string | null = null, actor: string | null = null) =>
  adminClient().rpc('mark_payout_paid', {
    p_payout_id: id, p_actor: actor, p_ref: ref, p_date: date, p_proof_path: proof,
  })

async function payout(id: string) {
  const { data } = await adminClient().from('payouts').select().eq('id', id).single().throwOnError()
  return data
}

type BatchResult = { batch_id: string; created: number; skipped_no_bank: number; skipped_below_min: number }
async function batch(cutoff = vnDate(), opts: { isDemo?: boolean; kind?: string } = {}): Promise<BatchResult> {
  const { data, error } = await adminClient().rpc('create_payout_batch', {
    p_kind: (opts.kind ?? 'monthly') as 'weekly' | 'monthly' | 'custom', p_cutoff: cutoff, p_min: MIN, p_actor: null, p_note: 'Tháng 10',
    p_is_demo: opts.isDemo ?? false,
  })
  if (error) throw error
  return data as BatchResult
}

describe('partner_wallet', () => {
  test('available = earned − pending_out − paid', async () => {
    const p = await ctv()
    await earn(p, 120000)
    await requestOk(p, 50000, 10000)
    const paidId = await requestOk(p, 30000, 10000)
    expect((await markPaid(paidId)).error).toBeNull()
    expect(await wallet(p)).toEqual({ earned: 120000, pending_out: 50000, paid: 30000, available: 40000 })
  })

  test('đối tác chưa có gì → toàn 0', async () => {
    const p = await ctv()
    expect(await wallet(p)).toEqual({ earned: 0, pending_out: 0, paid: 0, available: 0 })
  })
})

describe('request_payout', () => {
  test('tạo khoản requested, snapshot ngân hàng', async () => {
    const p = await ctv()
    await earn(p, 150000)
    const id = await requestOk(p, 120000)
    const row = await payout(id)
    expect(row).toMatchObject({
      partner_id: p.partnerId, amount: 120000, source: 'request', status: 'requested', batch_id: null, ...BANK,
    })
    // Đổi ngân hàng sau đó không đổi snapshot.
    await setBank(p, { bank_account: '999999999' })
    expect((await payout(id)).bank_account).toBe(BANK.bank_account)
  })

  test('thiếu ngân hàng → missing_bank (kể cả chỉ có khoảng trắng)', async () => {
    const p = await ctv({ bank: false })
    await earn(p, 200000)
    expect((await request(p, 100000)).error?.message).toBe('missing_bank')
    await setBank(p, { ...BANK, bank_holder: '   ' })
    expect((await request(p, 100000)).error?.message).toBe('missing_bank')
  })

  test('dưới mức tối thiểu → below_min; vượt số dư → insufficient_balance', async () => {
    const p = await ctv()
    await earn(p, 150000)
    expect((await request(p, 99999)).error?.message).toBe('below_min')
    expect((await request(p, 0, 0)).error?.message).toBe('below_min')
    expect((await request(p, 150001)).error?.message).toBe('insufficient_balance')
    expect((await request(p, 150000)).error).toBeNull()
  })

  test('đối tác không active (chờ duyệt / bị khóa) → not_active', async () => {
    for (const status of ['pending', 'locked'] as const) {
      const p = await createPartner({ kind: 'commission', status })
      await setBank(p)
      await earn(p, 200000)
      expect((await request(p, 100000)).error?.message).toBe('not_active')
    }
  })

  test('đại lý → not_commission', async () => {
    const d = await createPartner({ kind: 'wholesale' })
    await setBank(d)
    await earn(d, 500000)
    expect((await request(d, 100000)).error?.message).toBe('not_commission')
  })

  test('hai yêu cầu song song không vượt số dư', async () => {
    const p = await ctv()
    await earn(p, 150000)
    const results = await Promise.all([request(p, 100000), request(p, 100000)])
    const ok = results.filter((r) => r.error === null)
    const failed = results.filter((r) => r.error !== null)
    expect(ok).toHaveLength(1)
    expect(failed.map((r) => r.error?.message)).toEqual(['insufficient_balance'])
    expect((await wallet(p)).available).toBe(50000)
  })

  test('số dư âm (trả hàng sau khi đã chi) → insufficient_balance, đợt chi bỏ qua', async () => {
    const p = await ctv()
    const orderId = await earn(p, 200000)
    const id = await requestOk(p, 150000)
    expect((await markPaid(id)).error).toBeNull()
    await reversal(p, orderId, 200000)
    await earn(p, 120000)
    expect(await wallet(p)).toEqual({ earned: 120000, pending_out: 0, paid: 150000, available: -30000 })
    expect((await request(p, 100000)).error?.message).toBe('insufficient_balance')
    // Số dư ≤ 0 không tính vào nhóm bỏ qua nào.
    expect(await batch()).toMatchObject({ created: 0, skipped_no_bank: 0, skipped_below_min: 0 })
  })
})

describe('decide_payout', () => {
  test('approve requested → approved; approve lần hai → invalid_state', async () => {
    const p = await ctv()
    const admin = await createStaff('admin')
    await earn(p, 150000)
    const id = await requestOk(p, 100000)
    expect((await decide(id, 'approve', null, admin.userId)).error).toBeNull()
    const row = await payout(id)
    expect(row.status).toBe('approved')
    expect(row.decided_by).toBe(admin.userId)
    expect(row.decided_at).not.toBeNull()
    expect((await decide(id, 'approve')).error?.message).toBe('invalid_state')
    expect((await decide(id, 'bogus')).error?.message).toBe('invalid_action')
  })

  test('reject hoàn tiền về available; thiếu lý do → reason_required', async () => {
    const p = await ctv()
    await earn(p, 150000)
    const id = await requestOk(p, 100000)
    expect((await wallet(p)).available).toBe(50000)
    expect((await decide(id, 'reject', null)).error?.message).toBe('reason_required')
    expect((await decide(id, 'reject', '  ')).error?.message).toBe('reason_required')
    expect((await decide(id, 'approve')).error).toBeNull()
    expect((await decide(id, 'reject', 'Sai số tài khoản')).error).toBeNull()
    const row = await payout(id)
    expect(row).toMatchObject({ status: 'rejected', reject_reason: 'Sai số tài khoản' })
    expect(await wallet(p)).toEqual({ earned: 150000, pending_out: 0, paid: 0, available: 150000 })
    // Đã từ chối thì không duyệt/từ chối lại được.
    expect((await decide(id, 'approve')).error?.message).toBe('invalid_state')
    expect((await decide(id, 'reject', 'x')).error?.message).toBe('invalid_state')
  })

  test('không tìm thấy → payout_not_found', async () => {
    expect((await decide('00000000-0000-0000-0000-000000000000', 'approve')).error?.message).toBe('payout_not_found')
  })
})

describe('mark_payout_paid', () => {
  test('requested → paid, lưu mã GD/ngày/chứng từ; lần hai không đổi gì', async () => {
    const p = await ctv()
    const admin = await createStaff('admin')
    await earn(p, 150000)
    const id = await requestOk(p, 100000)
    const proof = `${p.partnerId}/${id}.pdf`
    expect((await markPaid(id, ' GD123 ', vnDate(-1), proof, admin.userId)).error).toBeNull()
    const first = await payout(id)
    expect(first).toMatchObject({
      status: 'paid', transfer_ref: 'GD123', transferred_on: vnDate(-1), proof_path: proof, paid_by: admin.userId,
    })
    expect(first.paid_at).not.toBeNull()

    expect((await markPaid(id, 'KHAC', vnDate(), null)).error).toBeNull()
    const second = await payout(id)
    expect(second).toEqual(first)
    expect(await wallet(p)).toEqual({ earned: 150000, pending_out: 0, paid: 100000, available: 50000 })
  })

  test('approved → paid được', async () => {
    const p = await ctv()
    await earn(p, 150000)
    const id = await requestOk(p, 100000)
    expect((await decide(id, 'approve')).error).toBeNull()
    expect((await markPaid(id)).error).toBeNull()
    expect((await payout(id)).status).toBe('paid')
  })

  test('khoản rejected → invalid_state; mã rỗng → ref_required; ngày tương lai → invalid_date', async () => {
    const p = await ctv()
    await earn(p, 300000)
    const rejected = await requestOk(p, 100000)
    expect((await decide(rejected, 'reject', 'Trùng')).error).toBeNull()
    expect((await markPaid(rejected)).error?.message).toBe('invalid_state')

    const id = await requestOk(p, 100000)
    expect((await markPaid(id, '   ')).error?.message).toBe('ref_required')
    expect((await markPaid(id, 'GD1', vnDate(1))).error?.message).toBe('invalid_date')
    expect((await payout(id)).status).toBe('requested')
    expect((await markPaid(id, 'GD1', vnDate())).error).toBeNull()
  })
})

describe('create_payout_batch', () => {
  test('bỏ qua thiếu ngân hàng / dưới mức, hoa hồng sau cutoff không tính', async () => {
    const noBank = await ctv({ bank: false })
    const below = await ctv()
    const ok = await ctv()
    const dealer = await createPartner({ kind: 'wholesale' })
    const pending = await createPartner({ kind: 'commission', status: 'pending' })
    await setBank(dealer)
    await setBank(pending)
    await earn(noBank, 200000, '2026-10-15T10:00:00+07:00')
    await earn(below, 50000, '2026-10-15T10:00:00+07:00')
    await earn(ok, 150000, '2026-10-31T23:59:00+07:00') // trong ngày cutoff (giờ VN)
    await earn(ok, 80000, '2026-11-01T00:00:00+07:00') // sau cutoff
    await earn(dealer, 500000, '2026-10-15T10:00:00+07:00')
    await earn(pending, 500000, '2026-10-15T10:00:00+07:00')

    const r = await batch('2026-10-31')
    expect(r).toMatchObject({ created: 1, skipped_no_bank: 1, skipped_below_min: 1 })

    const { data: b } = await adminClient().from('payout_batches').select().eq('id', r.batch_id).single().throwOnError()
    expect(b).toMatchObject({ kind: 'monthly', cutoff_date: '2026-10-31', note: 'Tháng 10', is_demo: false })

    const { data: rows } = await adminClient().from('payouts').select().eq('batch_id', r.batch_id).throwOnError()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      partner_id: ok.partnerId, amount: 150000, source: 'batch', status: 'approved', ...BANK,
    })
    expect(await wallet(ok)).toEqual({ earned: 230000, pending_out: 150000, paid: 0, available: 80000 })

    // Chạy lại cùng cutoff: phần đã nằm trong khoản chờ chi được trừ → không tạo trùng
    // (ok còn 0 → không đếm; noBank vẫn đủ mức → thiếu ngân hàng; below vẫn dưới mức).
    expect(await batch('2026-10-31')).toMatchObject({ created: 0, skipped_no_bank: 1, skipped_below_min: 1 })
  })

  test('thiếu ngân hàng chỉ đếm khi số tiền ≥ mức tối thiểu; dưới mức → below_min; 0 → không đếm', async () => {
    const noBankBelow = await ctv({ bank: false })
    await ctv({ bank: false }) // không có hoa hồng
    const noBankOk = await ctv({ bank: false })
    await earn(noBankBelow, 50000, '2026-10-15T10:00:00+07:00')
    await earn(noBankOk, 100000, '2026-10-15T10:00:00+07:00')
    expect(await batch('2026-10-31')).toMatchObject({ created: 0, skipped_no_bank: 1, skipped_below_min: 1 })
  })

  test('trừ khoản chờ chi/đã chi; không vượt available khi trả hàng sau cutoff', async () => {
    const p = await ctv()
    const order = await earn(p, 400000, '2026-10-10T10:00:00+07:00')
    await requestOk(p, 100000) // pending_out 100000
    await reversal(p, order, 400000) // sau cutoff: available = 0 − 100000
    await earn(p, 250000, '2026-10-12T10:00:00+07:00')
    // earned tới cutoff = 650000, trừ pending 100000 = 550000, nhưng available chỉ 150000.
    const r = await batch('2026-10-31')
    expect(r.created).toBe(1)
    const { data: rows } = await adminClient().from('payouts').select('amount').eq('batch_id', r.batch_id).throwOnError()
    expect(rows).toEqual([{ amount: 150000 }])
    expect((await wallet(p)).available).toBe(0)
  })

  test('đợt thử chỉ gồm đối tác thử; đợt thật bỏ qua đối tác thử', async () => {
    const real = await ctv()
    const demo = await ctv()
    await adminClient().from('partners').update({ is_demo: true }).eq('id', demo.partnerId).throwOnError()
    await earn(real, 150000)
    await earn(demo, 150000)

    const d = await batch(vnDate(), { isDemo: true })
    expect(d.created).toBe(1)
    const { data: dRows } = await adminClient().from('payouts').select('partner_id, is_demo').eq('batch_id', d.batch_id).throwOnError()
    expect(dRows).toEqual([{ partner_id: demo.partnerId, is_demo: true }])
    const { data: db } = await adminClient().from('payout_batches').select('is_demo').eq('id', d.batch_id).single().throwOnError()
    expect(db.is_demo).toBe(true)

    const r = await batch(vnDate())
    const { data: rRows } = await adminClient().from('payouts').select('partner_id, is_demo').eq('batch_id', r.batch_id).throwOnError()
    expect(rRows).toEqual([{ partner_id: real.partnerId, is_demo: false }])
  })

  test('yêu cầu rút của đối tác thử mang is_demo', async () => {
    const demo = await ctv()
    await adminClient().from('partners').update({ is_demo: true }).eq('id', demo.partnerId).throwOnError()
    await earn(demo, 150000)
    const id = await requestOk(demo, 100000)
    expect((await payout(id)).is_demo).toBe(true)
  })

  test('kind không hợp lệ bị từ chối', async () => {
    await expect(batch(vnDate(), { kind: 'daily' })).rejects.toMatchObject({ code: '23514' })
  })
})

describe('RLS và quyền', () => {
  test('CTV chỉ đọc payouts của mình; không đọc payout_batches; staff đọc tất cả', async () => {
    const a = await ctv()
    const b = await ctv()
    await earn(a, 150000)
    await earn(b, 150000)
    const idA = await requestOk(a, 100000)
    const idB = await requestOk(b, 100000)
    const r = await batch(vnDate(), { kind: 'custom' })
    expect(r.created).toBe(0) // còn 50000 mỗi người

    expect((await a.client.from('payouts').select('id')).data).toEqual([{ id: idA }])
    expect((await a.client.from('payouts').select('id').eq('id', idB)).data).toEqual([])
    expect((await b.client.from('payouts').select('id')).data).toEqual([{ id: idB }])
    expect((await a.client.from('payout_batches').select('id')).data).toEqual([])
    expect((await anonClient().from('payouts').select('id')).data).toEqual([])
    expect((await anonClient().from('payout_batches').select('id')).data).toEqual([])

    const s = await createStaff('staff')
    expect((await s.client.from('payouts').select('id')).data).toHaveLength(2)
    expect((await s.client.from('payout_batches').select('id')).data).toEqual([{ id: r.batch_id }])
  })

  test('CTV không ghi được payouts / payout_batches / cột ngân hàng', async () => {
    const a = await ctv()
    const ins = await a.client.from('payouts').insert({ partner_id: a.partnerId, amount: 1, source: 'request', status: 'paid' })
    expect(ins.error).not.toBeNull()
    const bIns = await a.client.from('payout_batches').insert({ kind: 'custom', cutoff_date: vnDate() })
    expect(bIns.error).not.toBeNull()
    await a.client.from('partners').update({ bank_account: '1' }).eq('id', a.partnerId)
    const { data } = await adminClient().from('partners').select('bank_account').eq('id', a.partnerId).single().throwOnError()
    expect(data.bank_account).toBe(BANK.bank_account)
  })

  test('anon/authenticated không execute được RPC ví/chi trả', async () => {
    const a = await ctv()
    await earn(a, 150000)
    const id = await requestOk(a, 100000)
    for (const c of [anonClient(), a.client]) {
      const calls = [
        c.rpc('partner_wallet', { p_partner_id: a.partnerId }),
        c.rpc('request_payout', { p_partner_id: a.partnerId, p_amount: 100000, p_min: 0 }),
        c.rpc('decide_payout', { p_payout_id: id, p_action: 'approve', p_actor: null, p_reason: null }),
        c.rpc('mark_payout_paid', { p_payout_id: id, p_actor: null, p_ref: 'X', p_date: vnDate(), p_proof_path: null }),
        c.rpc('create_payout_batch', { p_kind: 'custom', p_cutoff: vnDate(), p_min: 0, p_actor: null, p_note: null }),
      ]
      for (const res of await Promise.all(calls)) expect(res.error?.code).toBe('42501')
    }
    expect((await payout(id)).status).toBe('requested')
  })
})

describe('settings', () => {
  test('seed có min_payout = 100000', async () => {
    const { data } = await adminClient().from('settings').select('value').eq('key', 'min_payout').single().throwOnError()
    expect(data.value).toBe(100000)
  })
})
