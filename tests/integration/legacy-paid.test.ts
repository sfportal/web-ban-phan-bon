// 0008_legacy_paid.sql: hoa hồng đã chi theo cách cũ (commission_entries.status = 'paid') thành
// khoản chi legacy `paid`, để ví không cho rút lại. Chạy lại không thêm gì.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { adminClient, createPartner, insertOrderFor, resetData } from './helpers'

const SQL = readFileSync(path.resolve(import.meta.dirname, '../../supabase/migrations/0008_legacy_paid.sql'), 'utf8')
const db = new pg.Client('postgres://postgres:postgres@127.0.0.1:54322/postgres')
const BANK = { bank_name: 'Vietcombank', bank_account: '0123456789', bank_holder: 'NGUYEN VAN A' }

beforeAll(() => db.connect())
beforeEach(resetData)
afterAll(async () => {
  await resetData()
  await db.end()
})

async function entry(partnerId: string, kind: 'earn' | 'reversal', amount: number, paidAt: string | null, orderId?: string) {
  const order = orderId ?? await insertOrderFor(partnerId)
  await adminClient().from('commission_entries').insert({
    partner_id: partnerId, order_id: order, kind, amount, period: '2026-10',
    status: paidAt ? 'paid' : 'pending', paid_at: paidAt,
  }).throwOnError()
  return order
}

async function wallet(partnerId: string) {
  const { data, error } = await adminClient().rpc('partner_wallet', { p_partner_id: partnerId }).single()
  if (error) throw error
  return data
}

const legacyRows = async () =>
  (await adminClient().from('payouts').select().eq('source', 'legacy').order('amount').throwOnError()).data

test('hoa hồng đã chi cũ không rút lại được; chạy hai lần không thêm gì', async () => {
  const a = await createPartner({ kind: 'commission' })
  const b = await createPartner({ kind: 'commission' })
  const none = await createPartner({ kind: 'commission' })
  await adminClient().from('partners').update(BANK).in('id', [a.partnerId, b.partnerId]).throwOnError()
  // a: 500.000 đã chi (hai dòng, một dòng là đơn trả hàng đã trừ), 300.000 chưa chi.
  const o = await entry(a.partnerId, 'earn', 600000, '2026-10-05T03:00:00Z')
  await entry(a.partnerId, 'reversal', -100000, '2026-10-20T03:00:00Z', o)
  await entry(a.partnerId, 'earn', 300000, null)
  // b: 200.000 đã chi.
  await entry(b.partnerId, 'earn', 200000, '2026-10-31T18:00:00Z')
  // none: chưa chi gì.
  await entry(none.partnerId, 'earn', 150000, null)

  expect((await wallet(a.partnerId)).available).toBe(800000) // lỗi C1 trước khi chuyển

  await db.query(SQL)
  await db.query(SQL)

  const rows = await legacyRows()
  expect(rows).toHaveLength(2)
  expect(rows[1]).toMatchObject({
    partner_id: a.partnerId, amount: 500000, source: 'legacy', status: 'paid', transfer_ref: 'LEGACY-TRUOC-VI',
    transferred_on: '2026-10-20', batch_id: null, is_demo: false,
  })
  expect(new Date(rows[1].paid_at!).toISOString()).toBe('2026-10-20T03:00:00.000Z')
  // 18:00 UTC ngày 31/10 = 01:00 giờ VN ngày 1/11.
  expect(rows[0]).toMatchObject({ partner_id: b.partnerId, amount: 200000, transferred_on: '2026-11-01' })

  expect(await wallet(a.partnerId)).toEqual({ earned: 800000, pending_out: 0, paid: 500000, available: 300000 })
  expect(await wallet(b.partnerId)).toEqual({ earned: 200000, pending_out: 0, paid: 200000, available: 0 })
  expect(await wallet(none.partnerId)).toEqual({ earned: 150000, pending_out: 0, paid: 0, available: 150000 })

  const tooMuch = await adminClient().rpc('request_payout', { p_partner_id: a.partnerId, p_amount: 300001, p_min: 100000 })
  expect(tooMuch.error?.message).toBe('insufficient_balance')

  // Đợt chi sau khi chuyển chỉ chi phần chưa chi.
  const { data: batch, error } = await adminClient().rpc('create_payout_batch', {
    p_kind: 'monthly', p_cutoff: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()), p_min: 100000, p_actor: null, p_note: null, p_is_demo: false,
  })
  expect(error).toBeNull()
  expect(batch).toMatchObject({ created: 1 })
  const { data: inBatch } = await adminClient().from('payouts').select('partner_id, amount')
    .eq('source', 'batch').throwOnError()
  expect(inBatch).toEqual([{ partner_id: a.partnerId, amount: 300000 }])
})

test('tổng đã chi ≤ 0 (trả hàng trừ hết) → không tạo khoản legacy', async () => {
  const p = await createPartner({ kind: 'commission' })
  const o = await entry(p.partnerId, 'earn', 100000, '2026-10-05T03:00:00Z')
  await entry(p.partnerId, 'reversal', -100000, '2026-10-06T03:00:00Z', o)
  await db.query(SQL)
  expect(await legacyRows()).toEqual([])
})
