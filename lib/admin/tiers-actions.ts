'use server'
// Server Actions quản trị bậc đối tác và lưới tỷ lệ. Mỗi action tự gọi requireStaff('admin').
import { z } from 'zod'
import { requireStaff } from '@/lib/auth/guards'
import { adminClient } from '@/lib/supabase/admin'

const text = (form: FormData, key: string) => {
  const v = form.get(key)
  return typeof v === 'string' ? v : ''
}

const tierInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, 'Thiếu tên bậc').max(100),
  kind: z.enum(['commission', 'wholesale'], 'Chưa chọn loại bậc'),
})

export type SaveTierResult =
  | { status: 'ok'; id: string }
  | { status: 'invalid'; message: string }
  | { status: 'tier_in_use' }

/** Tạo/sửa bậc. Đổi `kind` của bậc đã có đối tác thì trả 'tier_in_use' (đổi loại sẽ làm sai giá/hoa hồng của họ). */
export async function saveTier(form: FormData): Promise<SaveTierResult> {
  await requireStaff('admin')
  const parsed = tierInput.safeParse({ id: text(form, 'id') || undefined, name: text(form, 'name'), kind: text(form, 'kind') })
  if (!parsed.success) return { status: 'invalid', message: parsed.error.issues[0].message }
  const { id, name, kind } = parsed.data
  const db = adminClient()
  if (id) {
    const { data: cur } = await db.from('partner_tiers').select('kind').eq('id', id).maybeSingle().throwOnError()
    if (!cur) return { status: 'invalid', message: 'Không tìm thấy bậc' }
    if (cur.kind !== kind) {
      const { count } = await db.from('partners').select('id', { count: 'exact', head: true }).eq('tier_id', id).throwOnError()
      if (count) return { status: 'tier_in_use' }
    }
    const { error } = await db.from('partner_tiers').update({ name, kind }).eq('id', id)
    if (error) return { status: 'invalid', message: error.code === '23505' ? 'Tên bậc đã tồn tại' : error.message }
    return { status: 'ok', id }
  }
  const { data, error } = await db.from('partner_tiers').insert({ name, kind }).select('id').single()
  if (error) return { status: 'invalid', message: error.code === '23505' ? 'Tên bậc đã tồn tại' : error.message }
  return { status: 'ok', id: data.id }
}

/** 0 ≤ x ≤ 100, tối đa 2 chữ số thập phân. */
function validRate(x: unknown): x is number {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > 100) return false
  return Math.abs(x * 100 - Math.round(x * 100)) < 1e-6
}

export type RateResult = { status: 'ok' } | { status: 'invalid'; message: string }

/** Lưu cả lưới tỷ lệ của một bậc theo nhóm: số thì upsert, null thì xóa dòng. Kiểm hết trước khi ghi. */
export async function saveRateGrid(tierId: string, rates: Record<string, number | null>): Promise<RateResult> {
  await requireStaff('admin')
  if (!z.uuid().safeParse(tierId).success) return { status: 'invalid', message: 'Bậc không hợp lệ' }
  const upserts: { tier_id: string; category_id: string; rate_pct: number }[] = []
  const removes: string[] = []
  for (const [categoryId, rate] of Object.entries(rates ?? {})) {
    if (!z.uuid().safeParse(categoryId).success) return { status: 'invalid', message: 'Nhóm không hợp lệ' }
    if (rate === null) removes.push(categoryId)
    else if (validRate(rate)) upserts.push({ tier_id: tierId, category_id: categoryId, rate_pct: rate })
    else return { status: 'invalid', message: 'Tỷ lệ phải từ 0 đến 100, tối đa 2 chữ số thập phân' }
  }
  const db = adminClient()
  const { data: tier } = await db.from('partner_tiers').select('id').eq('id', tierId).maybeSingle().throwOnError()
  if (!tier) return { status: 'invalid', message: 'Không tìm thấy bậc' }
  if (upserts.length) {
    const { error } = await db.from('tier_rates').upsert(upserts, { onConflict: 'tier_id,category_id' })
    if (error) return { status: 'invalid', message: error.code === '23503' ? 'Nhóm không tồn tại' : error.message }
  }
  if (removes.length) {
    await db.from('tier_rates').delete().eq('tier_id', tierId).in('category_id', removes).throwOnError()
  }
  return { status: 'ok' }
}

/** Mức riêng theo sản phẩm (ghi đè mức theo nhóm); null = xóa mức riêng. */
export async function saveProductRate(tierId: string, productId: string, rate: number | null): Promise<RateResult> {
  await requireStaff('admin')
  if (!z.uuid().safeParse(tierId).success || !z.uuid().safeParse(productId).success) {
    return { status: 'invalid', message: 'Bậc hoặc sản phẩm không hợp lệ' }
  }
  const db = adminClient()
  if (rate === null) {
    await db.from('tier_product_rates').delete().eq('tier_id', tierId).eq('product_id', productId).throwOnError()
    return { status: 'ok' }
  }
  if (!validRate(rate)) return { status: 'invalid', message: 'Tỷ lệ phải từ 0 đến 100, tối đa 2 chữ số thập phân' }
  const { error } = await db.from('tier_product_rates').upsert(
    { tier_id: tierId, product_id: productId, rate_pct: rate }, { onConflict: 'tier_id,product_id' })
  if (error) return { status: 'invalid', message: error.code === '23503' ? 'Bậc hoặc sản phẩm không tồn tại' : error.message }
  return { status: 'ok' }
}
