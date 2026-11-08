// Server Actions ví / chi trả (lib/payouts/*): quyền, ánh xạ lỗi RPC, đọc min_payout bằng service
// role, chứng từ (mock lớp Storage — local không có Storage), thông báo, xuất Excel.
import ExcelJS from 'exceljs'
import { after, NextRequest } from 'next/server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { GET } from '@/app/admin/xuat-du-lieu/route'
import { saveSettings } from '@/lib/admin/settings-actions'
import {
  approvePayout, createBatch, exportBalances, exportPayoutBatch, exportPayoutRequests, getAdminProofUrl,
  markBatchPaid, markPayoutPaid, rejectPayout,
} from '@/lib/payouts/admin-actions'
import { getProofUrl, requestPayout, saveBankInfo } from '@/lib/payouts/partner-actions'
import { removeProof, signedProofUrl, uploadProof } from '@/lib/payouts/proof-storage'
import { getMinPayout, getWallet, getWalletHistory, listBalances } from '@/lib/payouts/wallet'
import type { Json } from '@/lib/supabase/database.types'
import {
  adminClient, asUser, createPartner, createStaff, insertOrderFor, redirectTarget, resetData, type TestPartner,
  type TestUser,
} from './helpers'

vi.mock('@/lib/payouts/proof-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/payouts/proof-storage')>()
  return {
    ...actual,
    uploadProof: vi.fn(actual.uploadProof),
    removeProof: vi.fn(actual.removeProof),
    signedProofUrl: vi.fn(actual.signedProofUrl),
  }
})

const BANK = { bank_name: 'Vietcombank', bank_account: '0123456789', bank_holder: 'NGUYEN VAN A' }

let admin: TestUser
let staff: TestUser
// Một số test đổi / xóa khóa settings: chụp lại để trả nguyên trạng cho các file test sau.
let savedSettings: { key: string; value: Json }[] = []

beforeAll(async () => {
  savedSettings = (await adminClient().from('settings').select('key, value').throwOnError()).data
})

beforeEach(async () => {
  await resetData()
  await adminClient().from('settings').upsert({ key: 'min_payout', value: 100000 }).throwOnError()
  ;[admin, staff] = await Promise.all([createStaff('admin'), createStaff('staff')])
  vi.mocked(after).mockClear()
  vi.mocked(uploadProof).mockClear()
  vi.mocked(removeProof).mockClear()
  vi.mocked(signedProofUrl).mockClear()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
afterAll(async () => {
  await resetData()
  await adminClient().from('settings').delete().not('key', 'is', null).throwOnError()
  await adminClient().from('settings').insert(savedSettings).throwOnError()
})

function vnDate(days = 0): string {
  const d = new Date(Date.now() + days * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d)
}

async function earn(p: { partnerId: string }, amount: number, createdAt?: string): Promise<string> {
  const orderId = await insertOrderFor(p.partnerId)
  await adminClient().from('commission_entries').insert({
    partner_id: p.partnerId, order_id: orderId, kind: amount >= 0 ? 'earn' : 'reversal', amount, period: '2026-11',
    ...(createdAt ? { created_at: createdAt } : {}),
  }).throwOnError()
  return orderId
}

async function ctv(opts: { bank?: boolean } = {}): Promise<TestPartner> {
  const p = await createPartner({ kind: 'commission' })
  if (opts.bank ?? true) await adminClient().from('partners').update(BANK).eq('id', p.partnerId).throwOnError()
  return p
}

async function payout(id: string) {
  return (await adminClient().from('payouts').select().eq('id', id).single().throwOnError()).data
}

async function requested(p: TestPartner, amount: number): Promise<string> {
  const res = await asUser(p, () => requestPayout({ amount: String(amount) }))
  if (!('ok' in res)) throw new Error(`requestPayout: ${res.error}`)
  return res.id
}

const png = (size = 1000) => new File([new Uint8Array(size)], 'ck.png', { type: 'image/png' })

describe('saveBankInfo', () => {
  test('lưu chuẩn hóa vào partners của chính mình', async () => {
    const p = await ctv({ bank: false })
    const form = new FormData()
    form.set('bank_name', ' ACB ')
    form.set('bank_account', '0123 456 789')
    form.set('bank_holder', ' TRAN THI B ')
    expect(await asUser(p, () => saveBankInfo(form))).toEqual({ ok: true })
    const { data } = await adminClient().from('partners').select('bank_name, bank_account, bank_holder')
      .eq('id', p.partnerId).single().throwOnError()
    expect(data).toEqual({ bank_name: 'ACB', bank_account: '0123456789', bank_holder: 'TRAN THI B' })
  })

  test('lỗi định dạng / thiếu ô → không đổi dữ liệu', async () => {
    const p = await ctv()
    expect(await asUser(p, () => saveBankInfo({ ...BANK, bank_account: '12-34' }))).toEqual({ error: 'invalid_account' })
    expect(await asUser(p, () => saveBankInfo({ ...BANK, bank_account: '12345' }))).toEqual({ error: 'invalid_account' })
    expect(await asUser(p, () => saveBankInfo({ ...BANK, bank_holder: '  ' }))).toEqual({ error: 'missing_fields' })
    const { data } = await adminClient().from('partners').select('bank_account, bank_holder').eq('id', p.partnerId).single().throwOnError()
    expect(data).toEqual({ bank_account: BANK.bank_account, bank_holder: BANK.bank_holder })
  })

  test('chưa đăng nhập → /dang-nhap; nhân viên → /', async () => {
    expect(await redirectTarget(asUser(null, () => saveBankInfo(BANK)))).toBe('/dang-nhap')
    expect(await redirectTarget(asUser(staff, () => saveBankInfo(BANK)))).toBe('/')
  })
})

describe('requestPayout', () => {
  test('tạo khoản requested cho chính mình và báo admin qua Telegram (after)', async () => {
    const p = await ctv()
    await earn(p, 1600000)
    await adminClient().from('settings').upsert({ key: 'telegram_chat_id', value: '-100999' }).throwOnError()
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '123:abc')
    vi.stubEnv('RESEND_API_KEY', '')
    const realFetch = globalThis.fetch
    const telegram = vi.fn()
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url.startsWith('https://api.telegram.org/')) {
        telegram(url, init)
        return Promise.resolve(new Response('{}', { status: 200 }))
      }
      return realFetch(input, init)
    })

    const res = await asUser(p, () => requestPayout({ amount: '1.500.000' }))
    expect(res).toMatchObject({ ok: true })
    const id = (res as { id: string }).id
    expect(await payout(id)).toMatchObject({ partner_id: p.partnerId, amount: 1500000, status: 'requested', source: 'request' })
    expect(after).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(telegram).toHaveBeenCalledTimes(1))
    const [url, init] = telegram.mock.calls[0]
    expect(url).toBe('https://api.telegram.org/bot123:abc/sendMessage')
    const body = JSON.parse(init.body)
    expect(body.chat_id).toBe('-100999')
    expect(body.text).toContain('1.500.000 đ')
    expect(body.text).toContain(p.phone)
    expect(body.text).toContain(BANK.bank_account)
    expect(body.text).not.toContain('[THỬ]')

    // Đối tác thử: thông báo có "[THỬ]".
    await adminClient().from('partners').update({ is_demo: true }).eq('id', p.partnerId).throwOnError()
    expect(await asUser(p, () => requestPayout({ amount: '100.000' }))).toMatchObject({ ok: true })
    await vi.waitFor(() => expect(telegram).toHaveBeenCalledTimes(2))
    expect(JSON.parse(telegram.mock.calls[1][1].body).text).toMatch(/^\[THỬ\] Yêu cầu rút tiền 100\.000 đ/)
    await adminClient().from('settings').delete().eq('key', 'telegram_chat_id').throwOnError()
  })

  test('mã lỗi nghiệp vụ; mức tối thiểu đọc từ setting (service role)', async () => {
    const p = await ctv()
    await earn(p, 300000)
    expect(await asUser(p, () => requestPayout({ amount: 'abc' }))).toEqual({ error: 'invalid_amount' })
    expect(await asUser(p, () => requestPayout({ amount: '0' }))).toEqual({ error: 'invalid_amount' })
    expect(await asUser(p, () => requestPayout({ amount: '99.999' }))).toEqual({ error: 'below_min' })
    expect(await asUser(p, () => requestPayout({ amount: '300.001' }))).toEqual({ error: 'insufficient_balance' })

    await adminClient().from('settings').upsert({ key: 'min_payout', value: 200000 }).throwOnError()
    expect(await asUser(p, () => getMinPayout())).toBe(200000)
    expect(await asUser(p, () => requestPayout({ amount: '150000' }))).toEqual({ error: 'below_min' })
    expect(await asUser(p, () => requestPayout({ amount: '200000' }))).toMatchObject({ ok: true })
    expect(after).toHaveBeenCalledTimes(1) // chỉ lần thành công

    const noBank = await ctv({ bank: false })
    await earn(noBank, 300000)
    expect(await asUser(noBank, () => requestPayout({ amount: '200000' }))).toEqual({ error: 'missing_bank' })

    const dealer = await createPartner({ kind: 'wholesale' })
    expect(await asUser(dealer, () => requestPayout({ amount: '200000' }))).toEqual({ error: 'not_commission' })
  })

  test('min_payout thiếu / hỏng → mặc định 100000', async () => {
    await adminClient().from('settings').delete().eq('key', 'min_payout').throwOnError()
    expect(await getMinPayout()).toBe(100000)
    await adminClient().from('settings').upsert({ key: 'min_payout', value: 'x' }).throwOnError()
    expect(await getMinPayout()).toBe(100000)
  })

  test('nhân viên / khách không gọi được', async () => {
    expect(await redirectTarget(asUser(null, () => requestPayout({ amount: '100000' })))).toBe('/dang-nhap')
    expect(await redirectTarget(asUser(admin, () => requestPayout({ amount: '100000' })))).toBe('/')
  })
})

describe('ví', () => {
  test('getWallet và getWalletHistory', async () => {
    const p = await ctv()
    const order = await earn(p, 300000, '2026-11-01T10:00:00+07:00')
    await adminClient().from('commission_entries').insert({
      partner_id: p.partnerId, order_id: order, kind: 'reversal', amount: -50000, period: '2026-11',
      created_at: '2026-11-02T10:00:00+07:00',
    }).throwOnError()
    const id = await requested(p, 100000)
    const paidId = await requested(p, 100000)
    expect(await asUser(admin, () => markPayoutPaid({ id: paidId, ref: 'GD9', date: vnDate() }))).toEqual({ ok: true })

    expect(await getWallet(p.partnerId)).toEqual({ earned: 250000, pendingOut: 100000, paid: 100000, available: 50000 })
    const h = await getWalletHistory(p.partnerId)
    const { data: o } = await adminClient().from('orders').select('code').eq('id', order).single().throwOnError()
    expect(h.entries).toEqual([
      { orderCode: o.code, amount: -50000, kind: 'reversal', createdAt: new Date('2026-11-02T03:00:00Z') },
      { orderCode: o.code, amount: 300000, kind: 'earn', createdAt: new Date('2026-11-01T03:00:00Z') },
    ])
    expect(h.payouts.map((x) => x.id).sort()).toEqual([id, paidId].sort())
    const paidRow = h.payouts.find((x) => x.id === paidId)!
    expect(paidRow).toMatchObject({
      amount: 100000, source: 'request', status: 'paid', transferRef: 'GD9', transferredOn: vnDate(),
      hasProof: false, rejectReason: null,
    })
    expect(paidRow.requestedAt).toBeInstanceOf(Date)
    expect(paidRow.paidAt).toBeInstanceOf(Date)
    expect(h.payouts.find((x) => x.id === id)!.paidAt).toBeNull()
  })

  test('đối tác chưa có gì → 0', async () => {
    const p = await ctv()
    expect(await getWallet(p.partnerId)).toEqual({ earned: 0, pendingOut: 0, paid: 0, available: 0 })
    expect(await getWalletHistory(p.partnerId)).toEqual({ entries: [], payouts: [] })
  })
})

describe('chứng từ', () => {
  test('getProofUrl: khoản của CTV khác / id rác → not_found; của mình chưa có file → no_proof', async () => {
    const a = await ctv()
    const b = await ctv()
    await earn(a, 200000)
    await earn(b, 200000)
    const idA = await requested(a, 100000)
    const idB = await requested(b, 100000)
    await adminClient().from('payouts').update({ proof_path: `${b.partnerId}/${idB}.png` }).eq('id', idB).throwOnError()

    expect(await asUser(a, () => getProofUrl(idB))).toEqual({ error: 'not_found' })
    expect(await asUser(a, () => getProofUrl('khong-phai-uuid'))).toEqual({ error: 'not_found' })
    expect(await asUser(a, () => getProofUrl(idA))).toEqual({ error: 'no_proof' })
    expect(signedProofUrl).not.toHaveBeenCalled()

    vi.mocked(signedProofUrl).mockResolvedValueOnce('https://signed.example/b.png')
    expect(await asUser(b, () => getProofUrl(idB))).toEqual({ url: 'https://signed.example/b.png' })
    expect(signedProofUrl).toHaveBeenCalledWith(`${b.partnerId}/${idB}.png`)
  })

  test('getAdminProofUrl: chỉ admin; xem được mọi khoản', async () => {
    const b = await ctv()
    await earn(b, 200000)
    const idB = await requested(b, 100000)
    expect(await asUser(admin, () => getAdminProofUrl(idB))).toEqual({ error: 'no_proof' })
    await adminClient().from('payouts').update({ proof_path: `${b.partnerId}/${idB}.pdf` }).eq('id', idB).throwOnError()
    vi.mocked(signedProofUrl).mockResolvedValueOnce('https://signed.example/b.pdf')
    expect(await asUser(admin, () => getAdminProofUrl(idB))).toEqual({ url: 'https://signed.example/b.pdf' })
    expect(await asUser(admin, () => getAdminProofUrl('00000000-0000-0000-0000-000000000000'))).toEqual({ error: 'not_found' })
    expect(await redirectTarget(asUser(staff, () => getAdminProofUrl(idB)))).toBe('/')
    expect(await redirectTarget(asUser(b, () => getAdminProofUrl(idB)))).toBe('/')
  })
})

describe('duyệt / từ chối', () => {
  test('approve → approved; lần hai invalid_state; reject cần lý do, hoàn số dư', async () => {
    const p = await ctv()
    await earn(p, 300000)
    const id = await requested(p, 100000)
    expect(await asUser(admin, () => approvePayout(id))).toEqual({ ok: true })
    expect(await payout(id)).toMatchObject({ status: 'approved', decided_by: admin.userId })
    expect(await asUser(admin, () => approvePayout(id))).toEqual({ error: 'invalid_state' })
    expect(await asUser(admin, () => rejectPayout(id, '  '))).toEqual({ error: 'reason_required' })
    expect(await asUser(admin, () => rejectPayout(id, 'Sai số tài khoản'))).toEqual({ ok: true })
    expect(await payout(id)).toMatchObject({ status: 'rejected', reject_reason: 'Sai số tài khoản' })
    expect((await getWallet(p.partnerId)).available).toBe(300000)
    expect(await asUser(admin, () => approvePayout('xyz'))).toEqual({ error: 'not_found' })
    expect(await asUser(admin, () => rejectPayout('00000000-0000-0000-0000-000000000000', 'x'))).toEqual({ error: 'not_found' })
  })

  test('nhân viên thường bị chặn', async () => {
    const p = await ctv()
    await earn(p, 300000)
    const id = await requested(p, 100000)
    expect(await redirectTarget(asUser(staff, () => approvePayout(id)))).toBe('/')
    expect(await redirectTarget(asUser(staff, () => rejectPayout(id, 'x')))).toBe('/')
    expect((await payout(id)).status).toBe('requested')
  })
})

describe('markPayoutPaid', () => {
  test('nhân viên thường bị chặn', async () => {
    const p = await ctv()
    await earn(p, 300000)
    const id = await requested(p, 100000)
    expect(await redirectTarget(asUser(staff, () => markPayoutPaid({ id, ref: 'GD1', date: vnDate() })))).toBe('/')
    expect((await payout(id)).status).toBe('requested')
  })

  test('không file (kể cả File rỗng của form) → paid, proof_path null, không upload', async () => {
    const p = await ctv()
    await earn(p, 300000)
    const id = await requested(p, 100000)
    const form = new FormData()
    form.set('id', id)
    form.set('ref', ' GD123 ')
    form.set('date', vnDate(-1))
    form.set('proof', new File([], '', { type: 'application/octet-stream' }))
    expect(await asUser(admin, () => markPayoutPaid(form))).toEqual({ ok: true })
    expect(await payout(id)).toMatchObject({
      status: 'paid', transfer_ref: 'GD123', transferred_on: vnDate(-1), proof_path: null, paid_by: admin.userId,
    })
    expect(uploadProof).not.toHaveBeenCalled()
    // Bấm lần hai: vẫn ok, không đổi gì.
    expect(await asUser(admin, () => markPayoutPaid({ id, ref: 'KHAC', date: vnDate() }))).toEqual({ ok: true })
    expect((await payout(id)).transfer_ref).toBe('GD123')
  })

  test('có file: tải lên <partner>/<id>.<ext> rồi lưu đường dẫn', async () => {
    const p = await ctv()
    await earn(p, 300000)
    const id = await requested(p, 100000)
    vi.mocked(uploadProof).mockImplementationOnce(async (partnerId, payoutId) => `${partnerId}/${payoutId}.png`)
    const file = png()
    expect(await asUser(admin, () => markPayoutPaid({ id, ref: 'GD1', date: vnDate(), proof: file }))).toEqual({ ok: true })
    expect(uploadProof).toHaveBeenCalledWith(p.partnerId, id, file)
    expect((await payout(id)).proof_path).toBe(`${p.partnerId}/${id}.png`)
  })

  test('admin khác đánh dấu trong lúc tải chứng từ → gỡ file vừa tải, invalid_state', async () => {
    const p = await ctv()
    await earn(p, 300000)
    const id = await requested(p, 100000)
    vi.mocked(uploadProof).mockImplementationOnce(async (partnerId, payoutId) => {
      await adminClient().rpc('mark_payout_paid', {
        p_payout_id: payoutId, p_actor: null, p_ref: 'GD-KHAC', p_date: vnDate(), p_proof_path: null,
      }).throwOnError()
      return `${partnerId}/${payoutId}.png`
    })
    vi.mocked(removeProof).mockResolvedValueOnce(undefined)
    expect(await asUser(admin, () => markPayoutPaid({ id, ref: 'GD1', date: vnDate(), proof: png() }))).toEqual({ error: 'invalid_state' })
    expect(removeProof).toHaveBeenCalledWith(`${p.partnerId}/${id}.png`)
    expect(await payout(id)).toMatchObject({ status: 'paid', transfer_ref: 'GD-KHAC', proof_path: null })
  })

  test('file sai loại / quá lớn / upload lỗi → báo lỗi, không đổi trạng thái', async () => {
    const p = await ctv()
    await earn(p, 300000)
    const id = await requested(p, 100000)
    const gif = new File([new Uint8Array(10)], 'a.gif', { type: 'image/gif' })
    expect(await asUser(admin, () => markPayoutPaid({ id, ref: 'GD1', date: vnDate(), proof: gif }))).toEqual({ error: 'bad_type' })
    expect(await asUser(admin, () => markPayoutPaid({ id, ref: 'GD1', date: vnDate(), proof: png(5 * 1024 * 1024 + 1) }))).toEqual({ error: 'too_large' })
    vi.mocked(uploadProof).mockRejectedValueOnce(new Error('storage down'))
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await asUser(admin, () => markPayoutPaid({ id, ref: 'GD1', date: vnDate(), proof: png() }))).toEqual({ error: 'upload_failed' })
    err.mockRestore()
    expect((await payout(id)).status).toBe('requested')
    expect(uploadProof).toHaveBeenCalledTimes(1)
  })

  test('mã GD rỗng / ngày sai / tương lai / khoản đã từ chối / không tồn tại', async () => {
    const p = await ctv()
    await earn(p, 300000)
    const id = await requested(p, 100000)
    expect(await asUser(admin, () => markPayoutPaid({ id, ref: '  ', date: vnDate() }))).toEqual({ error: 'ref_required' })
    expect(await asUser(admin, () => markPayoutPaid({ id, ref: 'GD1', date: '2026-02-31' }))).toEqual({ error: 'invalid_date' })
    expect(await asUser(admin, () => markPayoutPaid({ id, ref: 'GD1', date: vnDate(1) }))).toEqual({ error: 'invalid_date' })
    expect(await asUser(admin, () => markPayoutPaid({ id: 'abc', ref: 'GD1', date: vnDate() }))).toEqual({ error: 'not_found' })
    expect(await asUser(admin, () => rejectPayout(id, 'Trùng'))).toEqual({ ok: true })
    // Khoản đã từ chối: báo lỗi trước khi tải file lên.
    expect(await asUser(admin, () => markPayoutPaid({ id, ref: 'GD1', date: vnDate(), proof: png() }))).toEqual({ error: 'invalid_state' })
    expect(uploadProof).not.toHaveBeenCalled()
  })
})

describe('đợt chi', () => {
  test('createBatch trả đúng số; markBatchPaid chỉ đánh dấu khoản chưa chi', async () => {
    const a = await ctv()
    const b = await ctv()
    const noBank = await ctv({ bank: false })
    const below = await ctv()
    await earn(a, 200000, '2026-10-10T10:00:00+07:00')
    await earn(b, 150000, '2026-10-10T10:00:00+07:00')
    await earn(noBank, 500000, '2026-10-10T10:00:00+07:00')
    await earn(below, 50000, '2026-10-10T10:00:00+07:00')

    expect(await asUser(admin, () => createBatch({ kind: 'daily', cutoff: '2026-10-31' }))).toEqual({ error: 'invalid_kind' })
    expect(await asUser(admin, () => createBatch({ kind: 'monthly', cutoff: '2026-10-32' }))).toEqual({ error: 'invalid_date' })
    expect(await asUser(admin, () => createBatch({ kind: 'monthly', cutoff: vnDate(1) }))).toEqual({ error: 'invalid_date' })

    const form = new FormData()
    form.set('kind', 'monthly')
    form.set('cutoff', '2026-10-31')
    form.set('note', ' Tháng 10 ')
    const res = await asUser(admin, () => createBatch(form))
    expect(res).toMatchObject({ ok: true, created: 2, skippedNoBank: 1, skippedBelowMin: 1 })
    const batchId = (res as { batchId: string }).batchId
    const { data: batch } = await adminClient().from('payout_batches').select().eq('id', batchId).single().throwOnError()
    expect(batch).toMatchObject({ kind: 'monthly', cutoff_date: '2026-10-31', note: 'Tháng 10', is_demo: false, created_by: admin.userId })

    const { data: rows } = await adminClient().from('payouts').select('id, partner_id').eq('batch_id', batchId).throwOnError()
    const rowA = rows.find((r) => r.partner_id === a.partnerId)!
    expect(await asUser(admin, () => markPayoutPaid({ id: rowA.id, ref: 'GD-A', date: vnDate() }))).toEqual({ ok: true })

    expect(await asUser(admin, () => markBatchPaid(batchId, { ref: ' ', date: vnDate() }))).toEqual({
      ok: 0, failed: [expect.objectContaining({ code: 'ref_required' })],
    })
    expect(await asUser(admin, () => markBatchPaid(batchId, { ref: 'GD-CHUNG', date: vnDate() }))).toEqual({ ok: 1, failed: [] })
    const { data: after2 } = await adminClient().from('payouts').select('partner_id, status, transfer_ref').eq('batch_id', batchId).throwOnError()
    expect(after2).toEqual(expect.arrayContaining([
      { partner_id: a.partnerId, status: 'paid', transfer_ref: 'GD-A' },
      { partner_id: b.partnerId, status: 'paid', transfer_ref: 'GD-CHUNG' },
    ]))
    expect(await asUser(admin, () => markBatchPaid(batchId, { ref: 'GD-CHUNG', date: vnDate() }))).toEqual({ ok: 0, failed: [] })
  })

  test('nhân viên thường bị chặn tạo đợt / đánh dấu đợt', async () => {
    expect(await redirectTarget(asUser(staff, () => createBatch({ kind: 'weekly', cutoff: vnDate() })))).toBe('/')
    expect(await redirectTarget(asUser(staff, () => markBatchPaid('00000000-0000-0000-0000-000000000000', { ref: 'x', date: vnDate() })))).toBe('/')
    const { count } = await adminClient().from('payout_batches').select('*', { count: 'exact', head: true }).throwOnError()
    expect(count).toBe(0)
  })
})

describe('số dư và xuất Excel', () => {
  const req = (query: string) => new NextRequest(`http://localhost/admin/xuat-du-lieu?${query}`)
  const load = async (buf: Buffer | ArrayBuffer) => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as ArrayBuffer)
    return wb.worksheets[0]
  }

  test('listBalances: mọi CTV, đại lý không có', async () => {
    const a = await ctv()
    await createPartner({ kind: 'wholesale' })
    await earn(a, 300000)
    await requested(a, 100000)
    const rows = await listBalances()
    expect(rows).toEqual([expect.objectContaining({
      partnerId: a.partnerId, phone: a.phone, earned: 300000, pendingOut: 100000, paid: 0, available: 200000,
    })])
  })

  test('route chi-tra-yeu-cau / chi-tra-dot / so-du: admin 200, nhân viên thường bị chặn', async () => {
    const a = await ctv()
    await earn(a, 300000, '2026-10-10T10:00:00+07:00')
    await requested(a, 100000)
    const batch = await asUser(admin, () => createBatch({ kind: 'custom', cutoff: '2026-10-31' }))
    const batchId = (batch as { batchId: string }).batchId

    for (const q of ['loai=chi-tra-yeu-cau', `loai=chi-tra-dot&dot=${batchId}`, 'loai=so-du']) {
      expect(await redirectTarget(asUser(staff, () => GET(req(q)))), q).toBe('/')
    }

    const r1 = await asUser(admin, () => GET(req('loai=chi-tra-yeu-cau')))
    expect(r1.status).toBe(200)
    expect(r1.headers.get('Content-Disposition')).toMatch(/^attachment; filename="chi-tra-yeu-cau_\d{4}-\d{2}-\d{2}\.xlsx"$/)
    const ws1 = await load(await r1.arrayBuffer())
    expect(ws1.getRow(2).getCell(3).value).toBe(100000)

    const r2 = await asUser(admin, () => GET(req(`loai=chi-tra-dot&dot=${batchId}`)))
    expect(r2.status).toBe(200)
    expect(r2.headers.get('Content-Disposition')).toBe('attachment; filename="chi-tra-dot_2026-10-31.xlsx"')
    const ws2 = await load(await r2.arrayBuffer())
    expect(ws2.getRow(3).getCell(3).value).toBe(200000)

    const r3 = await asUser(admin, () => GET(req('loai=so-du')))
    expect(r3.status).toBe(200)
    const ws3 = await load(await r3.arrayBuffer())
    expect(ws3.getRow(2).getCell(6).value).toBe(0)

    expect((await asUser(admin, () => GET(req('loai=chi-tra-dot&dot=abc')))).status).toBe(400)
    expect((await asUser(admin, () => GET(req('loai=chi-tra-dot&dot=00000000-0000-0000-0000-000000000000')))).status).toBe(404)
    expect((await asUser(admin, () => GET(req('loai=chi-tra-yeu-cau&trang-thai=khac')))).status).toBe(400)
  })

  test('hàm xuất tự kiểm tra quyền admin', async () => {
    expect(await redirectTarget(asUser(staff, () => exportPayoutRequests()))).toBe('/')
    expect(await redirectTarget(asUser(staff, () => exportPayoutBatch('00000000-0000-0000-0000-000000000000')))).toBe('/')
    expect(await redirectTarget(asUser(staff, () => exportBalances()))).toBe('/')
  })
})

describe('saveSettings: min_payout', () => {
  const base = {
    store_name: '', bank: '', account: '', holder: '', notify_email: '', telegram_chat_id: '', zalo_link: '',
  }
  const form = (v: Record<string, string>) => {
    const f = new FormData()
    for (const [k, x] of Object.entries(v)) f.set(k, x)
    return f
  }
  const value = async () => (await adminClient().from('settings').select('value').eq('key', 'min_payout').single().throwOnError()).data.value

  test('lưu số (nhận dấu chấm nghìn); thiếu ô → giữ nguyên; sai → invalid', async () => {
    expect(await asUser(admin, () => saveSettings(form({ ...base, min_payout: '150.000' })))).toEqual({ status: 'ok' })
    expect(await value()).toBe(150000)
    expect(await asUser(admin, () => saveSettings(form(base)))).toEqual({ status: 'ok' })
    expect(await value()).toBe(150000)
    for (const bad of ['abc', '0', '1.5']) {
      expect(await asUser(admin, () => saveSettings(form({ ...base, min_payout: bad }))), bad).toEqual({
        status: 'invalid', message: 'Mức rút tối thiểu phải là số tiền nguyên dương',
      })
    }
    expect(await value()).toBe(150000)
  })
})
