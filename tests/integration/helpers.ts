// Tiện ích cho test tích hợp trên stack Supabase local (cần `npm run stack:start` + `db:reset`).
import { randomInt, randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { phoneToEmail } from '@/lib/phone'
import { adminClient } from '@/lib/supabase/admin'
import type { Database, Json } from '@/lib/supabase/database.types'
import { requestContext } from './request-context'

export { adminClient }

type Db = SupabaseClient<Database>
export type TestUser = { userId: string; phone: string; client: Db }
export type TestPartner = TestUser & { partnerId: string; tierId: string | null }

const PASSWORD = 'mat-khau-test-123'
const noSession = { auth: { persistSession: false, autoRefreshToken: false } }

export function anonClient(): Db {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    noSession,
  )
}

/** SĐT di động hợp lệ ngẫu nhiên (10 số, đầu 09). */
export function randomPhone(): string {
  return '09' + String(randomInt(0, 100_000_000)).padStart(8, '0')
}

async function createAuthUser(phone: string): Promise<string> {
  const { data, error } = await adminClient().auth.admin.createUser({
    email: phoneToEmail(phone),
    password: PASSWORD,
    email_confirm: true,
  })
  if (error) throw error
  return data.user.id
}

async function signIn(phone: string): Promise<Db> {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({ email: phoneToEmail(phone), password: PASSWORD })
  if (error) throw error
  return client
}

export async function seededTierId(kind: 'commission' | 'wholesale'): Promise<string> {
  const { data } = await adminClient()
    .from('partner_tiers').select('id').eq('kind', kind).order('name').limit(1).single().throwOnError()
  return data.id
}

export async function createPartner(opts: {
  kind: 'commission' | 'wholesale'
  status?: 'pending' | 'active' | 'locked'
  phone?: string
}): Promise<TestPartner> {
  const phone = opts.phone ?? randomPhone()
  const status = opts.status ?? 'active'
  const tierId = await seededTierId(opts.kind)
  const userId = await createAuthUser(phone)
  const { data } = await adminClient()
    .from('partners')
    .insert({
      user_id: userId, phone, name: `Đối tác ${phone}`, region: 'Đắk Lắk',
      delivery_address: 'Buôn Ma Thuột', tier_id: tierId, status,
    })
    .select('id').single().throwOnError()
  return { partnerId: data.id, userId, phone, tierId, client: await signIn(phone) }
}

export async function createStaff(role: 'admin' | 'staff', phone = randomPhone()): Promise<TestUser> {
  const userId = await createAuthUser(phone)
  await adminClient().from('staff').insert({ user_id: userId, role }).throwOnError()
  return { userId, phone, client: await signIn(phone) }
}

export async function insertFarmerFor(partnerId: string | null, phone = randomPhone()): Promise<string> {
  const { data } = await adminClient()
    .from('farmers').insert({ phone, name: `Nông dân ${phone}`, owner_partner_id: partnerId })
    .select('id').single().throwOnError()
  return data.id
}

/** Tạo đơn partner (1 dòng, sản phẩm đầu tiên theo SKU) trực tiếp bằng service role. */
export async function insertOrderFor(
  partnerId: string,
  overrides: Partial<Database['public']['Tables']['orders']['Insert']> = {},
): Promise<string> {
  const admin = adminClient()
  const { data: product } = await admin
    .from('products').select('id, list_price').order('sku').limit(1).single().throwOnError()
  const { data: order } = await admin
    .from('orders')
    .insert({
      code: `TEST-${randomUUID().slice(0, 8)}`, source: 'partner', partner_id: partnerId,
      delivery_address: 'Buôn Ma Thuột', subtotal: product.list_price, total_qty: 1, ...overrides,
    })
    .select('id').single().throwOnError()
  await admin.from('order_lines').insert({
    order_id: order.id, product_id: product.id, qty: 1,
    list_price_snap: product.list_price, sale_price_snap: product.list_price, line_total: product.list_price,
  }).throwOnError()
  return order.id
}

/** Xóa dữ liệu nghiệp vụ và user test (@partner.local); giữ catalog, bậc, settings của seed. */
export async function resetData(): Promise<void> {
  const admin = adminClient()
  await admin.from('commission_entries').delete().not('id', 'is', null).throwOnError()
  await admin.from('order_status_log').delete().not('id', 'is', null).throwOnError()
  await admin.from('order_lines').delete().not('id', 'is', null).throwOnError()
  await admin.from('orders').delete().not('id', 'is', null).throwOnError()
  await admin.from('farmer_transfer_log').delete().not('id', 'is', null).throwOnError()
  await admin.from('farmers').delete().not('id', 'is', null).throwOnError()
  await admin.from('order_counters').delete().not('period', 'is', null).throwOnError()
  await admin.from('partners').delete().not('id', 'is', null).throwOnError()
  await admin.from('staff').delete().not('user_id', 'is', null).throwOnError()

  const targets: string[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const u of data.users) if (u.email?.endsWith('@partner.local')) targets.push(u.id)
    if (data.users.length < 1000) break
  }
  for (const id of targets) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) throw error
  }
}

// Gọi Server Action / guard trong test -------------------------------------------

/**
 * Chạy `fn` như một request của `u` (null = khách chưa đăng nhập). createServerClient()
 * trả `u.client`; cookies() là kho trong bộ nhớ riêng cho lần gọi này; headers() có
 * `x-forwarded-for` = `opts.ip` nếu truyền. Xem tests/integration/setup.ts.
 */
export function asUser<T>(
  u: { client: SupabaseClient<Database> } | null,
  fn: () => Promise<T>,
  opts: { ip?: string } = {},
): Promise<T> {
  const headers = new Headers()
  if (opts.ip) headers.set('x-forwarded-for', opts.ip)
  return requestContext.run({ client: u?.client ?? null, cookies: new Map(), headers }, fn)
}

/** Chờ `p` bị từ chối bởi redirect() của Next và trả URL đích; lỗi khác được ném lại. */
export async function redirectTarget(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    const digest = (e as { digest?: unknown }).digest
    if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT;')) {
      return digest.split(';').slice(2, -2).join(';')
    }
    throw e
  }
  throw new Error('Kỳ vọng redirect() nhưng hàm trả về bình thường')
}

// RPC đơn hàng / nông dân (0003_functions.sql) ------------------------------------

type OrderStatus = Database['public']['Enums']['order_status']
type ActorKind = 'partner' | 'staff'

/** Một dòng hàng hợp lệ (sản phẩm đầu tiên theo SKU, qty 1) cho p_lines. */
export async function sampleLine(overrides: Record<string, unknown> = {}) {
  const { data: product } = await adminClient()
    .from('products').select('id, list_price').order('sku').limit(1).single().throwOnError()
  return {
    product_id: product.id, qty: 1, list_price_snap: product.list_price,
    sale_price_snap: product.list_price, line_total: product.list_price, ...overrides,
  }
}

/** Gọi create_order; mặc định là đơn lẻ 1 dòng. `order` ghi đè các khóa của p_order. */
export async function createOrderRpc(
  order: Record<string, unknown> = {},
  lines?: Record<string, unknown>[],
): Promise<{ id: string; code: string }> {
  const ls = lines ?? [await sampleLine()]
  const subtotal = ls.reduce((s, l) => s + Number(l.line_total), 0)
  const { data, error } = await adminClient().rpc('create_order', {
    p_order: {
      source: 'retail', retail_name: 'Khách lẻ', retail_phone: '0911111111',
      retail_address: 'Krông Pắc', payment_method: 'cod', subtotal, commission_expected: 0, ...order,
    },
    p_lines: ls as Json,
  })
  if (error) throw error
  return data[0]
}

export async function changeStatus(
  id: string, to: OrderStatus, kind: ActorKind = 'staff', actor: string | null = null, note: string | null = null,
) {
  return adminClient().rpc('change_order_status', {
    p_order_id: id, p_to: to, p_actor: actor, p_actor_kind: kind, p_note: note,
  })
}

export async function toStatus(id: string, to: OrderStatus): Promise<void> {
  const { error } = await changeStatus(id, to)
  if (error) throw error
}

const PATH: Record<OrderStatus, OrderStatus[]> = {
  new: [],
  confirmed: ['confirmed'],
  shipping: ['confirmed', 'shipping'],
  delivered: ['confirmed', 'shipping', 'delivered'],
  paid: ['confirmed', 'shipping', 'delivered', 'paid'],
  cancelled: ['cancelled'],
  returned: ['confirmed', 'shipping', 'delivered', 'returned'],
}

/** Tạo đơn qua create_order rồi đi theo luồng hợp lệ (staff) tới trạng thái `status`. */
export async function orderInStatus(status: OrderStatus, order: Record<string, unknown> = {}): Promise<string> {
  const { id } = await createOrderRpc(order)
  for (const s of PATH[status]) await toStatus(id, s)
  return id
}

export async function commissions(orderId: string) {
  const { data } = await adminClient()
    .from('commission_entries').select('kind, amount, status').eq('order_id', orderId)
    .order('created_at').throwOnError()
  return data
}

export async function countOrders(): Promise<number> {
  const { count } = await adminClient().from('orders').select('*', { count: 'exact', head: true }).throwOnError()
  return count ?? 0
}

export async function claim(
  p: { partnerId: string }, phone: string, name = `Nông dân ${phone}`, address: string | null = null,
): Promise<{ status: 'ok'; farmer_id: string } | { status: 'owned_by_other' }> {
  const { data, error } = await adminClient().rpc('claim_farmer', {
    p_partner_id: p.partnerId, p_phone: phone, p_name: name, p_address: address,
  })
  if (error) throw error
  return data as { status: 'ok'; farmer_id: string } | { status: 'owned_by_other' }
}
