// Dữ liệu đặt thử (lib/admin/demo-data.ts): tạo đủ loại, từ chối tạo hai lần, xóa chỉ đụng is_demo.
import { afterAll, beforeEach, describe, expect, test } from 'vitest'
import { createDemoData, deleteDemoData, getDemoStatus } from '@/lib/admin/demo-data'
import { phoneToEmail } from '@/lib/phone'
import {
  adminClient, asUser, createPartner, createStaff, insertFarmerFor, insertOrderFor, resetData, type TestUser,
} from './helpers'

const PASSWORD = 'mat-khau-thu-123'
const DEMO_PHONES = ['0900000101', '0900000102', '0900000103', '0900000104', '0900000105']
const STATUSES = ['new', 'confirmed', 'shipping', 'delivered', 'paid', 'cancelled', 'returned']

let admin: TestUser
let staff: TestUser

beforeEach(async () => {
  await resetData()
  ;[admin, staff] = await Promise.all([createStaff('admin'), createStaff('staff')])
})
afterAll(resetData)

async function count(table: 'partners' | 'farmers' | 'orders' | 'payouts' | 'payout_batches', demo: boolean) {
  const { count: n } = await adminClient().from(table).select('*', { count: 'exact', head: true })
    .eq('is_demo', demo).throwOnError()
  return n ?? 0
}

async function authEmails(): Promise<string[]> {
  const { data } = await adminClient().auth.admin.listUsers({ page: 1, perPage: 1000 })
  return data.users.map((u) => u.email ?? '')
}

describe('createDemoData', () => {
  test('tạo đủ đối tác, nông dân, đơn 7 trạng thái, khoản chi và đợt chi; ví khớp partner_wallet', async () => {
    const res = await asUser(admin, () => createDemoData({ password: PASSWORD }))
    expect(res).toMatchObject({ ok: true })
    if (!('ok' in res)) return

    const db = adminClient()
    const { data: partners } = await db.from('partners').select('id, phone, status, is_demo, bank_account, partner_tiers(kind)')
      .eq('is_demo', true).order('phone').throwOnError()
    expect(partners.map((p) => p.phone)).toEqual(DEMO_PHONES)
    expect(partners.map((p) => p.status)).toEqual(['active', 'active', 'active', 'active', 'pending'])
    expect(partners.map((p) => p.partner_tiers?.kind)).toEqual(['commission', 'commission', 'commission', 'wholesale', 'commission'])
    expect(partners.slice(0, 3).every((p) => p.bank_account)).toBe(true)

    expect(await count('farmers', true)).toBe(8)
    const { data: orders } = await db.from('orders').select('status, source').eq('is_demo', true).throwOnError()
    expect(new Set(orders.map((o) => o.status))).toEqual(new Set(STATUSES))
    expect(orders.filter((o) => o.source === 'retail')).toHaveLength(3)
    expect(orders.filter((o) => o.source === 'partner').length).toBeGreaterThanOrEqual(12)
    expect(res.summary).toEqual({
      partners: 5, farmers: 8, orders: orders.length, payouts: await count('payouts', true),
    })

    const { data: payouts } = await db.from('payouts').select('status, transfer_ref, proof_path, source, is_demo').throwOnError()
    expect(payouts.every((p) => p.is_demo)).toBe(true)
    expect(payouts.filter((p) => p.status === 'requested' && p.source === 'request')).toHaveLength(1)
    const paid = payouts.filter((p) => p.status === 'paid')
    expect(paid).toHaveLength(1)
    expect(paid[0]).toMatchObject({ transfer_ref: 'DEMO-0001', proof_path: null })
    expect(await count('payout_batches', true)).toBe(1)
    expect(await count('payout_batches', false)).toBe(0)

    // Ví CTV thử khớp: earned = Σ commission_entries, available = earned − chờ − đã chuyển.
    for (const p of partners.filter((x) => x.partner_tiers?.kind === 'commission')) {
      const { data: e } = await db.from('commission_entries').select('amount').eq('partner_id', p.id).throwOnError()
      const earned = e.reduce((s, r) => s + Number(r.amount), 0)
      const { data: w } = await db.rpc('partner_wallet', { p_partner_id: p.id }).single().throwOnError()
      expect(Number(w.earned)).toBe(earned)
      expect(Number(w.available)).toBe(Number(w.earned) - Number(w.pending_out) - Number(w.paid))
    }
    const { data: first } = await db.rpc('partner_wallet', { p_partner_id: partners[0].id }).single().throwOnError()
    expect(Number(first.earned)).toBeGreaterThan(0)
    expect(Number(first.paid)).toBeGreaterThan(0)

    // Đăng nhập được bằng mật khẩu chung.
    const emails = await authEmails()
    for (const phone of DEMO_PHONES) expect(emails).toContain(phoneToEmail(phone))
    expect(await asUser(admin, () => getDemoStatus())).toEqual({ exists: true })
  })

  test('tạo lần hai → already_exists; mật khẩu yếu bị chặn; SĐT đã có bị chặn', async () => {
    expect(await asUser(admin, () => createDemoData({ password: 'ngan' }))).toEqual({ error: 'weak_password' })
    expect(await asUser(admin, () => getDemoStatus())).toEqual({ exists: false })

    await asUser(admin, () => createDemoData({ password: PASSWORD }))
    expect(await asUser(admin, () => createDemoData({ password: PASSWORD }))).toEqual({ error: 'already_exists' })

    await asUser(admin, () => deleteDemoData())
    await createPartner({ kind: 'commission', phone: '0900000103' })
    expect(await asUser(admin, () => createDemoData({ password: PASSWORD }))).toEqual({ error: 'phone_taken' })
    expect(await count('partners', true)).toBe(0)
    expect(await count('orders', true)).toBe(0)
    expect(await authEmails()).not.toContain(phoneToEmail('0900000101'))
  })

  test('nhân viên thường và khách bị chặn', async () => {
    await expect(asUser(staff, () => createDemoData({ password: PASSWORD }))).rejects.toThrow()
    await expect(asUser(staff, () => deleteDemoData())).rejects.toThrow()
    await expect(asUser(staff, () => getDemoStatus())).rejects.toThrow()
    await expect(asUser(null, () => createDemoData({ password: PASSWORD }))).rejects.toThrow()
    expect(await count('partners', true)).toBe(0)
  })
})

describe('deleteDemoData', () => {
  test('xóa sạch is_demo và user thử, dữ liệu thật còn nguyên', async () => {
    const real = await createPartner({ kind: 'commission' })
    const farmer = await insertFarmerFor(real.partnerId)
    const orderId = await insertOrderFor(real.partnerId, { status: 'paid', commission_expected: 5000 })
    const db = adminClient()
    await db.from('commission_entries').insert({
      partner_id: real.partnerId, order_id: orderId, kind: 'earn', amount: 5000, period: '2026-11',
    }).throwOnError()
    await db.from('payouts').insert({
      partner_id: real.partnerId, amount: 3000, source: 'request', status: 'requested',
    }).throwOnError()
    await db.from('payout_batches').insert({ kind: 'custom', cutoff_date: '2026-11-01' }).throwOnError()

    await asUser(admin, () => createDemoData({ password: PASSWORD }))
    const res = await asUser(admin, () => deleteDemoData())
    expect(res).toMatchObject({ ok: true })
    if (!('ok' in res)) return
    expect(res.deleted.partners).toBe(5)
    expect(res.deleted.farmers).toBe(8)

    for (const t of ['partners', 'farmers', 'orders', 'payouts', 'payout_batches'] as const) {
      expect(await count(t, true)).toBe(0)
    }
    const emails = await authEmails()
    for (const phone of DEMO_PHONES) expect(emails).not.toContain(phoneToEmail(phone))
    expect(emails).toContain(phoneToEmail(real.phone))

    expect(await count('partners', false)).toBe(1)
    expect(await count('farmers', false)).toBe(1)
    expect(await count('orders', false)).toBe(1)
    expect(await count('payouts', false)).toBe(1)
    expect(await count('payout_batches', false)).toBe(1)
    const { data: e } = await db.from('commission_entries').select('amount').throwOnError()
    expect(e).toHaveLength(1)
    const { data: lines } = await db.from('order_lines').select('id').eq('order_id', orderId).throwOnError()
    expect(lines).toHaveLength(1)
    const { data: f } = await db.from('farmers').select('id').eq('id', farmer).throwOnError()
    expect(f).toHaveLength(1)
    const { data: logs } = await db.from('order_status_log').select('id').throwOnError()
    expect(logs).toHaveLength(0) // đơn thật chèn trực tiếp không có log; log của đơn thử đã xóa
    expect(await asUser(admin, () => getDemoStatus())).toEqual({ exists: false })

    // Xóa lần nữa (không còn gì) không lỗi; tạo lại được.
    expect(await asUser(admin, () => deleteDemoData())).toMatchObject({ ok: true })
    expect(await asUser(admin, () => createDemoData({ password: PASSWORD }))).toMatchObject({ ok: true })
  })
})
