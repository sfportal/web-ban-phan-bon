'use server'
// Server Actions quản trị sản phẩm / nhóm / Excel. Mỗi action tự gọi requireStaff('admin');
// ghi dữ liệu bằng service role sau khi đã kiểm quyền.
import { z } from 'zod'
import { requireStaff } from '@/lib/auth/guards'
import { buildProductTemplate, buildProductWorkbook, parseProductSheet, parsePrice, type RowError } from '@/lib/excel/products'
import { adminClient } from '@/lib/supabase/admin'
import { parseImageLink, validateImage } from './image'
import { uploadProductImage } from './product-image'

const MAX_EXCEL_BYTES = 5 * 1024 * 1024
const XLSX_TYPES_OK = /\.xlsx$/i

type DbError = { code?: string; message: string }
const isUnique = (e: DbError) => e.code === '23505'

// ---------------------------------------------------------------------------
// Excel

export type ImportResult = { created: number; updated: number } | { errors: RowError[] }

/** Nhập sản phẩm từ Excel (field `file`): có lỗi ở bất kỳ dòng nào thì không ghi gì; không lỗi thì upsert theo SKU. */
export async function importProducts(form: FormData): Promise<ImportResult> {
  await requireStaff('admin')
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return { errors: [{ row: 0, message: 'Chưa chọn file Excel' }] }
  if (!XLSX_TYPES_OK.test(file.name)) return { errors: [{ row: 0, message: 'Chỉ nhận file .xlsx' }] }
  if (file.size > MAX_EXCEL_BYTES) return { errors: [{ row: 0, message: 'File tối đa 5MB' }] }

  const db = adminClient()
  const { data: categories } = await db.from('categories').select('id, name').throwOnError()
  const { rows, errors } = await parseProductSheet(await file.arrayBuffer(), categories)
  if (errors.length) return { errors }
  if (rows.length === 0) return { errors: [{ row: 0, message: 'File không có dòng sản phẩm nào' }] }

  const { data: existing } = await db
    .from('products').select('sku').in('sku', rows.map((r) => r.sku)).throwOnError()
  const have = new Set(existing.map((p) => p.sku))
  // Một lệnh upsert = một giao dịch. Không gửi image_url nên ảnh sẵn có được giữ nguyên;
  // updated_price_at do trigger products_touch_price cập nhật khi giá đổi.
  const { error } = await db.from('products').upsert(
    rows.map((r) => ({
      sku: r.sku, name: r.name, unit: r.unit, category_id: r.categoryId, list_price: r.listPrice,
      in_stock: r.inStock, is_active: r.isActive, description: r.description,
    })),
    { onConflict: 'sku' },
  )
  if (error) return { errors: [{ row: 0, message: `Không lưu được: ${error.message}` }] }
  const updated = rows.filter((r) => have.has(r.sku)).length
  return { created: rows.length - updated, updated }
}

/** Toàn bộ sản phẩm (kể cả đang ẩn) theo đúng mẫu nhập. */
export async function exportProducts(): Promise<Buffer> {
  await requireStaff('admin')
  const { data } = await adminClient()
    .from('products')
    .select('sku, name, unit, list_price, in_stock, is_active, description, categories(name)')
    .order('sku').limit(10000).throwOnError()
  return buildProductWorkbook(
    data.map((p) => ({
      sku: p.sku, name: p.name, unit: p.unit, category: p.categories?.name ?? '',
      listPrice: Number(p.list_price), inStock: p.in_stock, isActive: p.is_active, description: p.description,
    })),
  )
}

export async function downloadProductTemplate(): Promise<Buffer> {
  await requireStaff('admin')
  const { data } = await adminClient().from('categories').select('name').order('sort_order').order('name').limit(1).throwOnError()
  return buildProductTemplate(data[0]?.name ?? 'Phân NPK')
}

// ---------------------------------------------------------------------------
// Sản phẩm

export type SaveResult =
  | { status: 'ok'; id: string; imageError?: string }
  | { status: 'invalid'; message: string }

const productInput = z.object({
  id: z.uuid().optional(),
  sku: z.string().trim().min(1, 'Thiếu SKU').max(60),
  name: z.string().trim().min(1, 'Thiếu tên').max(200),
  unit: z.string().trim().max(60),
  categoryId: z.uuid('Chưa chọn nhóm'),
  description: z.string().trim().max(5000),
})

const text = (form: FormData, key: string) => {
  const v = form.get(key)
  return typeof v === 'string' ? v : ''
}
// Checkbox: có trong form = bật.
const flag = (form: FormData, key: string) => form.get(key) === 'on'

/** Tạo/sửa sản phẩm. Ảnh lỗi (tải lên hỏng) không chặn lưu: sản phẩm vẫn lưu, ảnh giữ nguyên, trả imageError. */
export async function saveProduct(form: FormData): Promise<SaveResult> {
  await requireStaff('admin')
  const parsed = productInput.safeParse({
    id: text(form, 'id') || undefined,
    sku: text(form, 'sku'),
    name: text(form, 'name'),
    unit: text(form, 'unit'),
    categoryId: text(form, 'categoryId'),
    description: text(form, 'description'),
  })
  if (!parsed.success) return { status: 'invalid', message: parsed.error.issues[0].message }
  const listPrice = parsePrice(text(form, 'listPrice'))
  if (listPrice === null) return { status: 'invalid', message: 'Giá không hợp lệ' }

  const file = form.get('image')
  const upload = file instanceof File && file.size > 0 ? file : null
  // Không gửi field imageUrl = giữ nguyên ảnh hiện có; gửi rỗng = bỏ ảnh.
  let link: string | null | undefined
  try {
    link = form.has('imageUrl') ? parseImageLink(text(form, 'imageUrl')) : undefined
  } catch (e) {
    return { status: 'invalid', message: (e as Error).message }
  }
  if (upload) {
    const bad = validateImage(upload)
    if (bad) return { status: 'invalid', message: bad }
  }

  const { id, sku, name, unit, categoryId, description } = parsed.data
  const fields = {
    sku, name, unit, category_id: categoryId, list_price: listPrice,
    in_stock: flag(form, 'inStock'), is_active: flag(form, 'isActive'),
    description: description || null,
  }
  const db = adminClient()
  let productId = id
  if (id) {
    const { data, error } = await db.from('products')
      .update(link === undefined ? fields : { ...fields, image_url: link }).eq('id', id).select('id')
    if (error) return { status: 'invalid', message: isUnique(error) ? 'SKU đã tồn tại' : error.message }
    if (data.length === 0) return { status: 'invalid', message: 'Không tìm thấy sản phẩm' }
  } else {
    const { data, error } = await db.from('products').insert({ ...fields, image_url: link ?? null }).select('id').single()
    if (error) return { status: 'invalid', message: isUnique(error) ? 'SKU đã tồn tại' : error.message }
    productId = data.id
  }

  if (upload) {
    try {
      const url = await uploadProductImage(productId!, upload)
      await db.from('products').update({ image_url: url }).eq('id', productId!).throwOnError()
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'lỗi không xác định'
      return { status: 'ok', id: productId!, imageError: `Đã lưu sản phẩm nhưng không tải được ảnh lên: ${reason}` }
    }
  }
  return { status: 'ok', id: productId! }
}

/** Đảo nhanh "Còn hàng" / "Hiển thị" của một sản phẩm. */
export async function toggleProduct(id: string, field: 'in_stock' | 'is_active'): Promise<{ status: 'ok'; value: boolean } | { status: 'not_found' }> {
  await requireStaff('admin')
  if (field !== 'in_stock' && field !== 'is_active') throw new Error('Trường không hợp lệ')
  if (!z.uuid().safeParse(id).success) return { status: 'not_found' }
  const db = adminClient()
  const { data } = await db.from('products').select('in_stock, is_active').eq('id', id).maybeSingle().throwOnError()
  if (!data) return { status: 'not_found' }
  const value = !data[field]
  await db.from('products').update(field === 'in_stock' ? { in_stock: value } : { is_active: value }).eq('id', id).throwOnError()
  return { status: 'ok', value }
}

// ---------------------------------------------------------------------------
// Nhóm sản phẩm

const categoryInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, 'Thiếu tên nhóm').max(100),
  sortOrder: z.coerce.number().int().min(0).max(100000),
})

export async function saveCategory(form: FormData): Promise<{ status: 'ok'; id: string } | { status: 'invalid'; message: string }> {
  await requireStaff('admin')
  const parsed = categoryInput.safeParse({
    id: text(form, 'id') || undefined,
    name: text(form, 'name'),
    sortOrder: text(form, 'sortOrder') || '0',
  })
  if (!parsed.success) {
    return { status: 'invalid', message: parsed.error.issues[0].path[0] === 'sortOrder' ? 'Thứ tự không hợp lệ' : parsed.error.issues[0].message }
  }
  const { id, name, sortOrder } = parsed.data
  const db = adminClient()
  // Tên nhóm là khóa nhận diện khi nhập Excel (không phân biệt hoa thường) nên cấm trùng kiểu đó.
  // So khớp trong JS: ilike của Postgres không đáng tin với chữ có dấu khi locale DB là C.
  const { data: all } = await db.from('categories').select('id, name').throwOnError()
  const key = (v: string) => v.normalize('NFC').toLowerCase()
  const same = all.filter((c) => key(c.name) === key(name))
  if (same.some((c) => c.id !== id)) return { status: 'invalid', message: 'Tên nhóm đã tồn tại' }

  if (id) {
    const { data, error } = await db.from('categories').update({ name, sort_order: sortOrder }).eq('id', id).select('id')
    if (error) return { status: 'invalid', message: isUnique(error) ? 'Tên nhóm đã tồn tại' : error.message }
    if (data.length === 0) return { status: 'invalid', message: 'Không tìm thấy nhóm' }
    return { status: 'ok', id }
  }
  const { data, error } = await db.from('categories').insert({ name, sort_order: sortOrder }).select('id').single()
  if (error) return { status: 'invalid', message: isUnique(error) ? 'Tên nhóm đã tồn tại' : error.message }
  return { status: 'ok', id: data.id }
}

export async function deleteCategory(id: string): Promise<{ status: 'ok' } | { status: 'category_in_use' } | { status: 'not_found' }> {
  await requireStaff('admin')
  if (!z.uuid().safeParse(id).success) return { status: 'not_found' }
  const db = adminClient()
  const { count } = await db.from('products').select('id', { count: 'exact', head: true }).eq('category_id', id).throwOnError()
  if (count) return { status: 'category_in_use' }
  const { error, data } = await db.from('categories').delete().eq('id', id).select('id')
  if (error) {
    if (error.code === '23503') return { status: 'category_in_use' } // sản phẩm mới thêm vào giữa chừng
    throw error
  }
  return data.length ? { status: 'ok' } : { status: 'not_found' }
}
