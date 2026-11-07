'use server'
// Server Actions quản trị khuyến mãi. Ngày nhập là ngày VN, ngày kết thúc tính cả ngày đó.
import { z } from 'zod'
import { requireStaff } from '@/lib/auth/guards'
import { vnDateStart } from '@/lib/format'
import { adminClient } from '@/lib/supabase/admin'

const text = (form: FormData, key: string) => {
  const v = form.get(key)
  return typeof v === 'string' ? v : ''
}

const input = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, 'Thiếu tên khuyến mãi').max(200),
  scope: z.enum(['product', 'category'], 'Chưa chọn phạm vi'),
  targetId: z.uuid('Chưa chọn sản phẩm/nhóm'),
  type: z.enum(['percent', 'fixed_price'], 'Chưa chọn loại'),
})

export type PromotionResult = { status: 'ok'; id: string } | { status: 'invalid'; message: string }
const bad = (message: string): PromotionResult => ({ status: 'invalid', message })

/**
 * Tạo/sửa khuyến mãi. starts_at = 0h giờ VN của ngày bắt đầu; ends_at = 0h giờ VN của ngày SAU ngày kết thúc
 * (khoảng [starts_at, ends_at)). Giá trị: percent 0 < v ≤ 100; fixed_price chỉ cho sản phẩm, v > 0 (đồng nguyên).
 */
export async function savePromotion(form: FormData): Promise<PromotionResult> {
  await requireStaff('admin')
  const parsed = input.safeParse({
    id: text(form, 'id') || undefined, name: text(form, 'name'), scope: text(form, 'scope'),
    targetId: text(form, 'targetId'), type: text(form, 'type'),
  })
  if (!parsed.success) return bad(parsed.error.issues[0].message)
  const { id, name, scope, targetId, type } = parsed.data

  const raw = text(form, 'value').trim().replace(',', '.')
  const value = /^\d+(\.\d{1,2})?$/.test(raw) ? Number(raw) : NaN
  if (!Number.isFinite(value) || value <= 0) return bad('Giá trị phải lớn hơn 0')
  if (type === 'percent' && value > 100) return bad('Phần trăm giảm tối đa 100')
  if (type === 'fixed_price') {
    if (scope !== 'product') return bad('Giá cố định chỉ áp dụng cho sản phẩm')
    if (!Number.isInteger(value)) return bad('Giá cố định phải là số đồng nguyên')
  }

  const startsAt = vnDateStart(text(form, 'startDate'))
  const endsAt = vnDateStart(text(form, 'endDate'), 1)
  if (!startsAt) return bad('Ngày bắt đầu không hợp lệ')
  if (!endsAt) return bad('Ngày kết thúc không hợp lệ')
  if (endsAt <= startsAt) return bad('Ngày kết thúc phải từ ngày bắt đầu trở đi')

  const db = adminClient()
  const { data: target } = await db.from(scope === 'product' ? 'products' : 'categories')
    .select('id').eq('id', targetId).maybeSingle().throwOnError()
  if (!target) return bad(scope === 'product' ? 'Sản phẩm không tồn tại' : 'Nhóm không tồn tại')

  const fields = {
    name, scope, target_id: targetId, type, value,
    starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), is_active: form.get('isActive') === 'on',
  }
  if (id) {
    const { data, error } = await db.from('promotions').update(fields).eq('id', id).select('id')
    if (error) return bad(error.message)
    if (data.length === 0) return bad('Không tìm thấy khuyến mãi')
    return { status: 'ok', id }
  }
  const { data, error } = await db.from('promotions').insert(fields).select('id').single()
  if (error) return bad(error.message)
  return { status: 'ok', id: data.id }
}

export async function deletePromotion(id: string): Promise<{ status: 'ok' } | { status: 'not_found' }> {
  await requireStaff('admin')
  if (!z.uuid().safeParse(id).success) return { status: 'not_found' }
  const { data } = await adminClient().from('promotions').delete().eq('id', id).select('id').throwOnError()
  return data.length ? { status: 'ok' } : { status: 'not_found' }
}
