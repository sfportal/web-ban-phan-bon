'use server'
// Dữ liệu đặt thử cho admin tập xử lý đơn và chi trả trên site thật. Tạo qua đúng các RPC hiện có
// (create_order, change_order_status, claim_farmer, request_payout, mark_payout_paid,
// create_payout_batch) rồi đánh dấu is_demo; xóa chỉ đụng bản ghi is_demo và user auth của
// đối tác thử. Mật khẩu chung do admin nhập, không lưu ở đâu cả. Mọi hàm gọi requireStaff('admin').
import { requireStaff } from '@/lib/auth/guards'
import { getTier } from '@/lib/catalog/queries'
import { phoneToEmail } from '@/lib/phone'
import { linesPayload, priceAndDiff } from '@/lib/orders/submit'
import { resolveRate } from '@/lib/pricing'
import { getMinPayout } from '@/lib/payouts/wallet'
import { vnToday } from '@/lib/payouts/validate'
import { adminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/database.types'

type OrderStatus = Database['public']['Enums']['order_status']

export type DemoSummary = { partners: number; farmers: number; orders: number; payouts: number }
export type CreateDemoResult =
  | { ok: true; summary: DemoSummary }
  | { error: 'weak_password' | 'already_exists' | 'phone_taken' }
  | { error: 'auth_error'; message: string }
export type DeleteDemoResult =
  | { ok: true; deleted: Record<string, number> }
  | { error: 'linked_real_data' }

const MIN_PASSWORD = 8
const BANK = 'Ngân hàng Thử'

// Đối tác thử: 0900000101–103 CTV active (có ngân hàng), 104 đại lý active, 105 CTV chờ duyệt.
const PARTNERS = [
  { phone: '0900000101', name: 'CTV Thử 1', kind: 'commission', status: 'active', bank: true },
  { phone: '0900000102', name: 'CTV Thử 2', kind: 'commission', status: 'active', bank: true },
  { phone: '0900000103', name: 'CTV Thử 3', kind: 'commission', status: 'active', bank: true },
  { phone: '0900000104', name: 'Đại lý Thử', kind: 'wholesale', status: 'active', bank: false },
  { phone: '0900000105', name: 'CTV Thử chờ duyệt', kind: 'commission', status: 'pending', bank: false },
] as const

// 8 nông dân thử: [chỉ số CTV, SĐT].
const FARMERS: { owner: number; phone: string }[] = [
  { owner: 0, phone: '0900000201' }, { owner: 0, phone: '0900000202' }, { owner: 0, phone: '0900000203' },
  { owner: 1, phone: '0900000204' }, { owner: 1, phone: '0900000205' },
  { owner: 2, phone: '0900000206' }, { owner: 2, phone: '0900000207' }, { owner: 2, phone: '0900000208' },
]

// Đơn của đối tác: đủ 7 trạng thái. `big` = số lượng đủ lớn để hoa hồng vượt mức rút tối thiểu.
const PARTNER_ORDERS: { partner: number; farmer: number | null; status: OrderStatus; big?: boolean }[] = [
  { partner: 0, farmer: 0, status: 'paid', big: true }, { partner: 0, farmer: 1, status: 'paid', big: true },
  { partner: 0, farmer: 2, status: 'returned' }, { partner: 0, farmer: 0, status: 'delivered' },
  { partner: 0, farmer: 1, status: 'shipping' }, { partner: 0, farmer: 2, status: 'new' },
  { partner: 1, farmer: 3, status: 'paid', big: true }, { partner: 1, farmer: 4, status: 'confirmed' },
  { partner: 1, farmer: 3, status: 'cancelled' }, { partner: 1, farmer: 4, status: 'new' },
  { partner: 2, farmer: 5, status: 'paid' }, { partner: 2, farmer: 6, status: 'delivered' },
  { partner: 3, farmer: null, status: 'paid' }, { partner: 3, farmer: null, status: 'delivered' },
  { partner: 3, farmer: null, status: 'new' },
]
const RETAIL_ORDERS: { name: string; phone: string; status: OrderStatus }[] = [
  { name: 'Khách lẻ Thử 1', phone: '0900000301', status: 'new' },
  { name: 'Khách lẻ Thử 2', phone: '0900000302', status: 'delivered' },
  { name: 'Khách lẻ Thử 3', phone: '0900000303', status: 'paid' },
]

/** Đường đi hợp lệ (nhân viên) từ `new` tới trạng thái đích. */
const PATH: Record<OrderStatus, OrderStatus[]> = {
  new: [],
  confirmed: ['confirmed'],
  shipping: ['confirmed', 'shipping'],
  delivered: ['confirmed', 'shipping', 'delivered'],
  paid: ['confirmed', 'shipping', 'delivered', 'paid'],
  cancelled: ['confirmed', 'cancelled'],
  returned: ['confirmed', 'shipping', 'delivered', 'paid', 'returned'],
}

const authEmail = (phone: string) => phoneToEmail(phone)

async function demoExists(): Promise<boolean> {
  const db = adminClient()
  const checks = await Promise.all(
    (['partners', 'farmers', 'orders', 'payouts', 'payout_batches'] as const).map((t) =>
      db.from(t).select('*', { count: 'exact', head: true }).eq('is_demo', true).throwOnError()),
  )
  return checks.some((c) => (c.count ?? 0) > 0)
}

export async function getDemoStatus(): Promise<{ exists: boolean }> {
  await requireStaff('admin')
  return { exists: await demoExists() }
}

async function phonesTaken(): Promise<boolean> {
  const db = adminClient()
  const [p, f] = await Promise.all([
    db.from('partners').select('id', { count: 'exact', head: true }).in('phone', PARTNERS.map((x) => x.phone)).throwOnError(),
    db.from('farmers').select('id', { count: 'exact', head: true }).in('phone', FARMERS.map((x) => x.phone)).throwOnError(),
  ])
  return (p.count ?? 0) > 0 || (f.count ?? 0) > 0
}

/** Tạo toàn bộ dữ liệu thử. Lỗi giữa chừng → dọn phần đã tạo rồi ném lại lỗi. */
export async function createDemoData(form: { password: string }): Promise<CreateDemoResult> {
  const { userId: actor } = await requireStaff('admin')
  const password = typeof form?.password === 'string' ? form.password : ''
  if (password.length < MIN_PASSWORD) return { error: 'weak_password' }
  await sweepOrphanUsers()
  if (await demoExists()) return { error: 'already_exists' }
  if (await phonesTaken()) return { error: 'phone_taken' }

  const db = adminClient()
  const createdUsers: string[] = []
  try {
    // Tài khoản đăng nhập: SĐT → email giả, mật khẩu chung.
    for (const p of PARTNERS) {
      const { data, error } = await db.auth.admin.createUser({ email: authEmail(p.phone), password, email_confirm: true })
      if (error || !data.user) {
        await removeUsers(createdUsers)
        if (error && (error.code === 'email_exists' || error.code === 'user_already_exists' || /already.*registered/i.test(error.message))) {
          return { error: 'phone_taken' }
        }
        console.error('demo: createUser lỗi', error?.code, error?.message)
        return { error: 'auth_error', message: error?.message ?? 'Không tạo được tài khoản đăng nhập.' }
      }
      createdUsers.push(data.user.id)
    }

    const { data: tiers } = await db.from('partner_tiers').select('id, kind').order('name').throwOnError()
    const tierOf = (kind: string) => tiers.find((t) => t.kind === kind)?.id
    const partnerIds: string[] = []
    for (const [i, p] of PARTNERS.entries()) {
      const tierId = tierOf(p.kind)
      if (!tierId) throw new Error(`demo: thiếu bậc ${p.kind}`)
      const { data } = await db.from('partners').insert({
        user_id: createdUsers[i], phone: p.phone, name: p.name, region: 'Đắk Lắk', delivery_address: 'Buôn Ma Thuột (thử)',
        tier_id: tierId, status: p.status, is_demo: true,
        ...(p.bank ? { bank_name: BANK, bank_account: `000000000${p.phone.slice(-3)}`, bank_holder: `NGUYEN VAN THU ${i + 1}` } : {}),
      }).select('id').single().throwOnError()
      partnerIds.push(data.id)
    }

    const farmerIds: string[] = []
    for (const f of FARMERS) {
      const { data } = await db.rpc('claim_farmer', {
        p_partner_id: partnerIds[f.owner], p_phone: f.phone, p_name: `Nông dân Thử ${farmerIds.length + 1}`, p_address: 'Krông Pắc (thử)',
      }).throwOnError()
      const res = data as { status: string; farmer_id?: string }
      if (res.status !== 'ok' || !res.farmer_id) throw new Error('demo: claim_farmer thất bại')
      farmerIds.push(res.farmer_id)
    }

    await createOrders(partnerIds, farmerIds, actor)
    await createPayouts(partnerIds, actor)

    const [orders, payouts] = await Promise.all([
      db.from('orders').select('*', { count: 'exact', head: true }).eq('is_demo', true).throwOnError(),
      db.from('payouts').select('*', { count: 'exact', head: true }).eq('is_demo', true).throwOnError(),
    ])
    return {
      ok: true,
      summary: { partners: PARTNERS.length, farmers: FARMERS.length, orders: orders.count ?? 0, payouts: payouts.count ?? 0 },
    }
  } catch (e) {
    await rollbackCreate(createdUsers)
    throw e
  }
}

async function createOrders(partnerIds: string[], farmerIds: string[], actor: string) {
  const db = adminClient()
  const minPayout = await getMinPayout()
  const { data: products } = await db.from('products').select('id, list_price')
    .eq('is_active', true).eq('in_stock', true).gt('list_price', 0).order('list_price', { ascending: false }).limit(1).throwOnError()
  const product = products[0]
  if (!product) throw new Error('demo: chưa có sản phẩm đang bán')

  const { data: ptn } = await db.from('partners').select('id, tier_id').in('id', partnerIds).throwOnError()
  const tierId = (i: number) => ptn.find((p) => p.id === partnerIds[i])!.tier_id!
  const { data: cat } = await db.from('products').select('category_id').eq('id', product.id).single().throwOnError()

  // Số lượng cho đơn "lớn": hoa hồng ≥ 2 × mức rút tối thiểu (giới hạn 9999).
  const rateOf = async (i: number) => resolveRate(await getTier(db, tierId(i)), product.id, cat.category_id)
  const bigQty = async (i: number) => {
    const rate = await rateOf(i)
    if (rate <= 0) return 20
    return Math.min(9999, Math.max(1, Math.ceil((2 * minPayout * 100) / (Number(product.list_price) * rate))))
  }

  async function place(
    order: Record<string, string | number | boolean | null>, tier: string | null, farmerId: string | null, qty: number, status: OrderStatus,
  ) {
    const r = await priceAndDiff({
      lines: [{ productId: product.id, qty, farmerId, seenSalePrice: 0 }], tierId: tier, acceptChanges: true,
    })
    if (r.status !== 'ok') throw new Error('demo: không tính được giá đơn thử')
    const { data } = await db.rpc('create_order', {
      p_order: {
        ...order, is_demo: true, actor, payment_method: 'cod',
        subtotal: r.priced.subtotal, partner_payable: r.priced.partnerPayable, commission_expected: r.priced.commissionExpected,
      },
      p_lines: linesPayload(r.priced),
    }).throwOnError()
    for (const to of PATH[status]) {
      await db.rpc('change_order_status', {
        p_order_id: data[0].id, p_to: to, p_actor: actor, p_actor_kind: 'staff', p_note: 'Dữ liệu thử',
      }).throwOnError()
    }
  }

  for (const o of PARTNER_ORDERS) {
    const qty = o.big ? await bigQty(o.partner) : 1 + (o.partner % 3)
    await place(
      { source: 'partner', partner_id: partnerIds[o.partner], delivery_address: 'Buôn Ma Thuột (thử)', note: 'Đơn thử' },
      tierId(o.partner), o.farmer === null ? null : farmerIds[o.farmer], qty, o.status,
    )
  }
  for (const r of RETAIL_ORDERS) {
    await place(
      { source: 'retail', retail_name: r.name, retail_phone: r.phone, retail_address: 'Krông Pắc (thử)', note: 'Đơn thử' },
      null, null, 2, r.status,
    )
  }
}

async function createPayouts(partnerIds: string[], actor: string) {
  const db = adminClient()
  const min = await getMinPayout()
  // CTV 1: một khoản đã chuyển (DEMO-0001, không file) và một yêu cầu rút đang chờ.
  const { data: paidId } = await db.rpc('request_payout', { p_partner_id: partnerIds[0], p_amount: min, p_min: min }).throwOnError()
  await db.rpc('mark_payout_paid', {
    p_payout_id: paidId, p_actor: actor, p_ref: 'DEMO-0001', p_date: vnToday(), p_proof_path: null,
  }).throwOnError()
  await db.rpc('request_payout', { p_partner_id: partnerIds[0], p_amount: min, p_min: min }).throwOnError()
  // Một đợt chi thử: chỉ gồm CTV thử (p_is_demo).
  await db.rpc('create_payout_batch', {
    p_kind: 'custom', p_cutoff: vnToday(), p_min: min, p_actor: actor, p_note: 'Đợt chi thử', p_is_demo: true,
  }).throwOnError()
}

/** Xóa tài khoản đăng nhập theo id; lỗi được ghi log và bỏ qua (lần sau sweepOrphanUsers dọn tiếp). */
async function removeUsers(ids: string[]) {
  const db = adminClient()
  for (const id of ids) {
    const { error } = await db.auth.admin.deleteUser(id)
    if (error && !/not.?found/i.test(error.message)) console.error('demo: không xóa được user auth', id, error.message)
  }
}

/** Tạo dở dang bị lỗi: xóa dữ liệu thử đã ghi và các tài khoản đã tạo, ghi log nếu việc dọn cũng lỗi. */
async function rollbackCreate(createdUsers: string[]) {
  try {
    const { data, error } = await adminClient().rpc('delete_demo_data')
    if (error) console.error('demo: dọn dữ liệu thử sau lỗi thất bại', error.message)
    else await removeUsers((data as { user_ids: string[] }).user_ids)
  } catch (e) {
    console.error('demo: dọn dữ liệu thử sau lỗi thất bại', e)
  }
  await removeUsers(createdUsers)
}

/**
 * Tài khoản đăng nhập mồ côi của SĐT thử (0900000101–105): có email dành riêng nhưng KHÔNG có hàng
 * partners lẫn staff (ví dụ lần xóa trước lỗi giữa chừng). Không bao giờ đụng user có đối tác thật,
 * đối tác thử (RPC xóa lo) hoặc nhân viên.
 */
async function sweepOrphanUsers() {
  const db = adminClient()
  const reserved = new Set(PARTNERS.map((p) => authEmail(p.phone)))
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) {
      console.error('demo: không liệt kê được user auth', error.message)
      return
    }
    const candidates = data.users.filter((u) => u.email && reserved.has(u.email))
    if (candidates.length > 0) {
      const ids = candidates.map((u) => u.id)
      const [p, s] = await Promise.all([
        db.from('partners').select('user_id').in('user_id', ids).throwOnError(),
        db.from('staff').select('user_id').in('user_id', ids).throwOnError(),
      ])
      const used = new Set([...p.data.map((r) => r.user_id), ...s.data.map((r) => r.user_id)])
      await removeUsers(ids.filter((id) => !used.has(id)))
    }
    if (data.users.length < 1000) return
  }
}

/** Xóa toàn bộ dữ liệu thử: một giao dịch trong DB, rồi tài khoản đăng nhập của đối tác thử. */
export async function deleteDemoData(): Promise<DeleteDemoResult> {
  await requireStaff('admin')
  await sweepOrphanUsers()
  const { data, error } = await adminClient().rpc('delete_demo_data')
  if (error) {
    // 23503: còn dữ liệu thật tham chiếu tới dữ liệu thử; giao dịch đã hoàn tác, chưa xóa gì.
    if (error.code === '23503') return { error: 'linked_real_data' }
    throw error
  }
  const { user_ids, ...counts } = data as { user_ids: string[] } & Record<string, number>
  await removeUsers(user_ids)
  return { ok: true, deleted: { ...counts, users: user_ids.length } }
}
