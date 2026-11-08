// Dữ liệu đặt thử (lib/admin/demo-data.ts): tạo đủ loại, từ chối tạo hai lần, xóa chỉ đụng is_demo.
import ExcelJS from 'exceljs'
import { afterAll, beforeEach, describe, expect, test } from 'vitest'
import { createDemoData, deleteDemoData, getDemoStatus } from '@/lib/admin/demo-data'
import { dashboardStats, exportOrders } from '@/lib/admin/orders-actions'
import { addFarmer } from '@/lib/farmers/actions'
import { submitPartnerOrder } from '@/lib/orders/submit'
import { phoneToEmail } from '@/lib/phone'
import {
  adminClient, anonClient, asUser, createPartner, createStaff, insertFarmerFor, insertOrderFor,
  resetData, type TestUser,
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
    const emails = await authEmails()
    for (const phone of DEMO_PHONES.filter((p) => p !== '0900000103')) expect(emails).not.toContain(phoneToEmail(phone))
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

async function demoLogin(phone: string) {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({ email: phoneToEmail(phone), password: PASSWORD })
  if (error) throw error
  return { client }
}

describe('dữ liệu tạo qua đối tác thử', () => {
  test('đối tác thử đặt đơn thường và thêm nông dân → là dữ liệu thử; xóa thành công, không dư', async () => {
    await asUser(admin, () => createDemoData({ password: PASSWORD }))
    const db = adminClient()
    const ctv = await demoLogin('0900000101')
    const { data: mine } = await db.from('farmers').select('id').eq('phone', '0900000201').single().throwOnError()
    const { data: product } = await db.from('products').select('id, list_price').eq('is_active', true).eq('in_stock', true).limit(1).single().throwOnError()

    const res = await asUser(ctv, () => submitPartnerOrder({
      clientKey: crypto.randomUUID(), deliveryAddress: 'Buôn Ma Thuột', acceptChanges: true,
      lines: [{ productId: product.id, qty: 1, farmerId: mine.id, seenSalePrice: Number(product.list_price) }],
    }))
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    const { data: order } = await db.from('orders').select('is_demo').eq('id', res.orderId).single().throwOnError()
    expect(order.is_demo).toBe(true)

    const added = await asUser(ctv, () => addFarmer({ phone: '0912345999', name: 'Nông dân mới của CTV thử' }))
    expect(added.status).toBe('ok')
    const { data: farmer } = await db.from('farmers').select('is_demo').eq('phone', '0912345999').single().throwOnError()
    expect(farmer.is_demo).toBe(true)

    // Đơn lẻ qua nông dân thử (gắn partner_id của đối tác thử) cũng là đơn thử.
    const { data: retail } = await db.rpc('create_order', {
      p_order: { source: 'retail', retail_name: 'Khách', retail_phone: '0911111111', partner_id: null, subtotal: 1 },
      p_lines: [{ product_id: product.id, farmer_id: mine.id, qty: 1, list_price_snap: 1, sale_price_snap: 1, line_total: 1 }],
    }).throwOnError()
    const { data: ro } = await db.from('orders').select('is_demo').eq('id', retail[0].id).single().throwOnError()
    expect(ro.is_demo).toBe(true)

    expect(await asUser(admin, () => deleteDemoData())).toMatchObject({ ok: true })
    for (const t of ['partners', 'farmers', 'orders', 'payouts', 'payout_batches'] as const) {
      expect(await count(t, true)).toBe(0)
      expect(await count(t, false)).toBe(0)
    }
    expect(await authEmails()).not.toContain(phoneToEmail('0900000101'))
  })
})

describe('auth mồ côi và xung đột dữ liệu thật', () => {
  test('user auth mồ côi của SĐT thử bị dọn khi tạo; user của nhân viên không bị đụng', async () => {
    const orphan = await adminClient().auth.admin.createUser({
      email: phoneToEmail('0900000102'), password: PASSWORD, email_confirm: true,
    })
    expect(orphan.error).toBeNull()
    expect(await asUser(admin, () => createDemoData({ password: PASSWORD }))).toMatchObject({ ok: true })
    await asUser(admin, () => deleteDemoData())

    // Mồ côi khác còn sót (xóa dở): lần xóa kế tiếp dọn.
    await adminClient().auth.admin.createUser({ email: phoneToEmail('0900000105'), password: PASSWORD, email_confirm: true })
    expect(await asUser(admin, () => deleteDemoData())).toMatchObject({ ok: true })
    expect(await authEmails()).not.toContain(phoneToEmail('0900000105'))

    // Nhân viên dùng đúng email dành riêng: không bị xóa, tạo dữ liệu thử báo phone_taken.
    const reserved = await createStaff('staff', '0900000104')
    expect(await asUser(admin, () => createDemoData({ password: PASSWORD }))).toEqual({ error: 'phone_taken' })
    expect(await authEmails()).toContain(phoneToEmail('0900000104'))
    const { data } = await adminClient().from('staff').select('user_id').eq('user_id', reserved.userId).throwOnError()
    expect(data).toHaveLength(1)
  })

  test('dữ liệu thật gắn vào đối tác thử → linked_real_data, hoàn tác toàn bộ, không xóa gì', async () => {
    await asUser(admin, () => createDemoData({ password: PASSWORD }))
    const { data: demo } = await adminClient().from('partners').select('id').eq('phone', '0900000102').single().throwOnError()
    await insertOrderFor(demo.id) // đơn is_demo=false gắn vào đối tác thử

    const before = {
      partners: await count('partners', true), farmers: await count('farmers', true),
      orders: await count('orders', true), payouts: await count('payouts', true),
      batches: await count('payout_batches', true),
    }
    expect(await asUser(admin, () => deleteDemoData())).toEqual({ error: 'linked_real_data' })
    expect({
      partners: await count('partners', true), farmers: await count('farmers', true),
      orders: await count('orders', true), payouts: await count('payouts', true),
      batches: await count('payout_batches', true),
    }).toEqual(before)
    expect(await authEmails()).toContain(phoneToEmail('0900000101'))
    expect(await asUser(admin, () => getDemoStatus())).toEqual({ exists: true })
  })
})

describe('thống kê và xuất Excel bỏ dữ liệu thử', () => {
  test('dashboardStats không đổi khi có dữ liệu thử; xuất đơn có cột "Dữ liệu thử"', async () => {
    const stats = () => asUser(admin, () => dashboardStats())
    const before = await stats()
    await asUser(admin, () => createDemoData({ password: PASSWORD }))
    expect(await stats()).toEqual(before)
    expect(before).toEqual({ newToday: 0, awaitingPayment: 0, monthRevenue: 0, pendingCommission: 0 })

    const buf = await asUser(admin, () => exportOrders(new Date(Date.now() - 86400_000), new Date(Date.now() + 86400_000)))
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as unknown as ArrayBuffer)
    const ws = wb.worksheets[0]
    const header = ws.getRow(1).values as unknown[]
    const col = header.indexOf('Dữ liệu thử')
    expect(col).toBeGreaterThan(0)
    expect(ws.getRow(2).getCell(col).value).toBe('Có')
  })
})
