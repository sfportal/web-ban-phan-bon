// Tiện ích cho test tích hợp trên stack Supabase local (cần `npm run stack:start` + `db:reset`).
import { randomInt, randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { phoneToEmail } from '@/lib/phone'
import { adminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/database.types'

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
