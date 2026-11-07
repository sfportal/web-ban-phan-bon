import ExcelJS from 'exceljs'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import {
  deleteCategory, exportProducts, importProducts, saveCategory, saveProduct, toggleProduct,
} from '@/lib/admin/products-actions'
import { LEGACY_PRODUCT_HEADERS, PRODUCT_HEADERS } from '@/lib/excel/products'
import { category } from '../support/dataset'
import { adminClient, asUser, createPartner, createStaff, redirectTarget, resetData, type TestUser } from './helpers'

const PREFIX = 'T11-'
const NPK = category('npk').name
const BVTV = category('thuoc-bvtv').name
let admin: TestUser
let staff: TestUser
let npkId: string

async function xlsxFile(rows: unknown[][], name = 'sp.xlsx'): Promise<File> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sản phẩm')
  ws.addRow([...PRODUCT_HEADERS])
  for (const r of rows) ws.addRow(r as ExcelJS.CellValue[])
  return new File([await wb.xlsx.writeBuffer()], name)
}
const formWith = (file: File) => {
  const f = new FormData()
  f.set('file', file)
  return f
}
async function countProducts() {
  const { count } = await adminClient().from('products').select('*', { count: 'exact', head: true }).throwOnError()
  return count ?? 0
}
async function bySku(sku: string) {
  const { data } = await adminClient().from('products').select('*').eq('sku', sku).maybeSingle().throwOnError()
  return data
}
async function cleanup() {
  const db = adminClient()
  await db.from('products').delete().like('sku', `${PREFIX}%`).throwOnError()
  await db.from('categories').delete().like('name', `${PREFIX}%`).throwOnError()
}

beforeAll(async () => {
  await resetData()
  await cleanup()
  ;[admin, staff] = await Promise.all([createStaff('admin'), createStaff('staff')])
  const { data } = await adminClient().from('categories').select('id').eq('slug', 'npk').single().throwOnError()
  npkId = data.id
})
afterAll(async () => {
  await cleanup()
  await resetData()
})

describe('importProducts', () => {
  test('có lỗi thì không ghi dòng nào', async () => {
    const before = await countProducts()
    const file = await xlsxFile([
      [`${PREFIX}OK1`, 'Hợp lệ', 'bao', NPK, '100000', '', '', ''],
      [`${PREFIX}BAD`, 'Sai nhóm', 'bao', 'Không có nhóm này', '100000', '', '', ''],
    ])
    const res = await asUser(admin, () => importProducts(formWith(file)))
    expect(res).toEqual({ errors: [{ row: 3, message: 'Nhóm không tồn tại: Không có nhóm này' }] })
    expect(await countProducts()).toBe(before)
    expect(await bySku(`${PREFIX}OK1`)).toBeNull()
  })

  test('upsert theo SKU và cập nhật updated_price_at khi đổi giá', async () => {
    const a = `${PREFIX}A`, b = `${PREFIX}B`
    const f1 = await xlsxFile([
      [a, 'Sản phẩm A', 'bao', NPK.toLowerCase(), '100.000', 'có', 'có', 'mô tả A'],
      [b, 'Sản phẩm B', 'chai', BVTV, '50000', '', '', ''],
    ])
    expect(await asUser(admin, () => importProducts(formWith(f1)))).toEqual({ created: 2, updated: 0 })
    const rowA = (await bySku(a))!
    expect(rowA).toMatchObject({ name: 'Sản phẩm A', category_id: npkId, list_price: 100000, in_stock: true, is_active: true, description: 'mô tả A' })
    const rowB = (await bySku(b))!
    expect(rowB).toMatchObject({ in_stock: false, is_active: true })
    await adminClient().from('products').update({ image_url: 'https://x.vn/a.jpg' }).eq('id', rowA.id).throwOnError()

    await new Promise((r) => setTimeout(r, 20))
    const f2 = await xlsxFile([
      [a, 'Sản phẩm A đổi tên', 'bao', NPK, '120000', 'có', 'có', ''], // đổi giá
      [b, 'Sản phẩm B', 'chai', BVTV, '50000', '', '', ''], // không đổi giá
    ])
    expect(await asUser(admin, () => importProducts(formWith(f2)))).toEqual({ created: 0, updated: 2 })
    const a2 = (await bySku(a))!
    const b2 = (await bySku(b))!
    expect(a2).toMatchObject({ name: 'Sản phẩm A đổi tên', list_price: 120000, image_url: 'https://x.vn/a.jpg' })
    expect(new Date(a2.updated_price_at).getTime()).toBeGreaterThan(new Date(rowA.updated_price_at).getTime())
    expect(b2.updated_price_at).toBe(rowB.updated_price_at)
  })

  test('staff thường và đối tác không gọi được importProducts', async () => {
    const before = await countProducts()
    const file = await xlsxFile([[`${PREFIX}S`, 'x', '', NPK, '1', '', '', '']])
    expect(await redirectTarget(asUser(staff, () => importProducts(formWith(file))))).toBe('/')
    expect(await redirectTarget(asUser(null, () => importProducts(formWith(file))))).toBe('/dang-nhap')
    const partner = await createPartner({ kind: 'commission' })
    expect(await redirectTarget(asUser(partner, () => importProducts(formWith(file))))).toBe('/')
    expect(await countProducts()).toBe(before)
  })

  test('không có file / sai đuôi → lỗi, không ghi', async () => {
    expect(await asUser(admin, () => importProducts(new FormData()))).toEqual({ errors: [{ row: 0, message: 'Chưa chọn file Excel' }] })
    const txt = new File(['a,b'], 'sp.csv')
    expect(await asUser(admin, () => importProducts(formWith(txt)))).toEqual({ errors: [{ row: 0, message: 'Chỉ nhận file .xlsx' }] })
  })
})

describe('số lượng lớn (> 1000 dòng)', () => {
  const N = 1200
  test('nhập 1200 dòng thành công, xuất trả đủ và nhập lại được', async () => {
    const rows = Array.from({ length: N }, (_, i) => [`${PREFIX}BULK${String(i).padStart(4, '0')}`, `SP ${i}`, 'bao', NPK, 1000 + i, 'có', 'có', ''])
    const file = await xlsxFile(rows)
    expect(await asUser(admin, () => importProducts(formWith(file)))).toEqual({ created: N, updated: 0 })

    const buf = await asUser(admin, () => exportProducts())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as never)
    const total = await countProducts()
    expect(total).toBeGreaterThan(1000)
    expect(wb.worksheets[0].rowCount - 1).toBe(total)

    expect(await asUser(admin, () => importProducts(formWith(new File([new Uint8Array(buf)], 'x.xlsx')))))
      .toEqual({ created: 0, updated: total })
  })
})

describe('exportProducts', () => {
  test('xuất rồi nhập lại không đổi dữ liệu', async () => {
    await adminClient().from('products').insert({
      sku: `${PREFIX}HIDDEN`, name: 'Ẩn, hết hàng', unit: 'kg', category_id: npkId, list_price: 99000,
      in_stock: false, is_active: false, description: null,
      brand: "O'Neil", short_desc: 'ngắn', composition: 'N 20%', benefits: 'dòng 1\ndòng 2', usage: 'pha 20ml',
      crops: ['Lúa', 'Cà phê'], is_featured: true,
    }).throwOnError()
    const snapshot = async () =>
      (await adminClient().from('products').select('sku, name, unit, category_id, list_price, in_stock, is_active, description, image_url, updated_price_at, brand, short_desc, composition, benefits, usage, crops, is_featured').order('sku').throwOnError()).data
    const before = await snapshot()

    const buf = await asUser(admin, () => exportProducts())
    const res = await asUser(admin, () => importProducts(formWith(new File([new Uint8Array(buf)], 'xuat.xlsx'))))
    expect(res).toEqual({ created: 0, updated: before.length })
    const after = await snapshot()
    expect(after).toEqual(before)
    expect(after.find((p) => p.sku === `${PREFIX}HIDDEN`)).toMatchObject({ brand: "O'Neil", crops: ['Lúa', 'Cà phê'], is_featured: true })
    expect(after.filter((p) => p.short_desc).length).toBeGreaterThan(1) // sản phẩm seed có mô tả
  })

  test('nhập file mẫu cũ 8 cột không xóa mô tả sẵn có', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Sản phẩm')
    ws.addRow([...LEGACY_PRODUCT_HEADERS])
    ws.addRow([`${PREFIX}HIDDEN`, 'Ẩn, đổi tên', 'kg', NPK, 99000, 'không', 'không', ''])
    const file = new File([await wb.xlsx.writeBuffer()], 'cu.xlsx')
    expect(await asUser(admin, () => importProducts(formWith(file)))).toEqual({ created: 0, updated: 1 })
    expect(await bySku(`${PREFIX}HIDDEN`)).toMatchObject({ name: 'Ẩn, đổi tên', brand: "O'Neil", crops: ['Lúa', 'Cà phê'], is_featured: true })
  })

  test('staff thường không xuất được', async () => {
    expect(await redirectTarget(asUser(staff, () => exportProducts()))).toBe('/')
  })
})

describe('saveProduct / toggleProduct', () => {
  function productForm(over: Record<string, string> = {}) {
    const f = new FormData()
    const base: Record<string, string> = {
      sku: `${PREFIX}P1`, name: ' Sản phẩm P1 ', unit: 'bao', categoryId: npkId, listPrice: '150.000',
      inStock: 'on', isActive: 'on', description: '', ...over,
    }
    for (const [k, v] of Object.entries(base)) f.set(k, v)
    return f
  }

  test('tạo, sửa, SKU trùng, link ảnh', async () => {
    const created = await asUser(admin, () => saveProduct(productForm({ imageUrl: 'https://x.vn/p1.png' })))
    expect(created.status).toBe('ok')
    const id = (created as { id: string }).id
    expect(await bySku(`${PREFIX}P1`)).toMatchObject({ name: 'Sản phẩm P1', list_price: 150000, image_url: 'https://x.vn/p1.png', in_stock: true })

    const edited = await asUser(admin, () => saveProduct(productForm({ id, listPrice: '160000', isActive: '' , imageUrl: 'https://x.vn/p1.png' })))
    expect(edited).toEqual({ status: 'ok', id })
    expect(await bySku(`${PREFIX}P1`)).toMatchObject({ list_price: 160000, is_active: false })

    // thiếu field imageUrl: giữ ảnh cũ
    const f = productForm({ id })
    expect(await asUser(admin, () => saveProduct(f))).toEqual({ status: 'ok', id })
    expect((await bySku(`${PREFIX}P1`))!.image_url).toBe('https://x.vn/p1.png')

    const dup = await asUser(admin, () => saveProduct(productForm()))
    expect(dup).toEqual({ status: 'invalid', message: 'SKU đã tồn tại' })
    expect(await asUser(admin, () => saveProduct(productForm({ sku: `${PREFIX}P2`, listPrice: '-1' })))).toEqual({ status: 'invalid', message: 'Giá không hợp lệ' })
    expect(await asUser(admin, () => saveProduct(productForm({ sku: `${PREFIX}P2`, imageUrl: 'javascript:alert(1)' })))).toMatchObject({ status: 'invalid' })
    expect(await bySku(`${PREFIX}P2`)).toBeNull()
  })

  test('lưu và đọc lại các cột mô tả mới', async () => {
    const f = productForm({
      sku: `${PREFIX}D1`, brand: ' Bình Điền ', shortDesc: 'Ngắn gọn', composition: 'N 16%', benefits: 'Xanh lá\nCứng cây',
      usage: 'Bón thúc', crops: 'Lúa, Cà phê , ,Sầu riêng', isFeatured: 'on',
    })
    const res = await asUser(admin, () => saveProduct(f))
    expect(res.status).toBe('ok')
    expect(await bySku(`${PREFIX}D1`)).toMatchObject({
      brand: 'Bình Điền', short_desc: 'Ngắn gọn', composition: 'N 16%', benefits: 'Xanh lá\nCứng cây', usage: 'Bón thúc',
      crops: ['Lúa', 'Cà phê', 'Sầu riêng'], is_featured: true,
    })
    const id = (res as { id: string }).id
    expect(await asUser(admin, () => saveProduct(productForm({ id, sku: `${PREFIX}D1`, brand: '', crops: '' })))).toEqual({ status: 'ok', id })
    expect(await bySku(`${PREFIX}D1`)).toMatchObject({ brand: null, short_desc: null, crops: [], is_featured: false })
  })

  test('ảnh tải lên sai định dạng bị từ chối trước khi ghi', async () => {
    const f = productForm({ sku: `${PREFIX}P3` })
    f.set('image', new File(['GIF89a'], 'a.gif', { type: 'image/gif' }))
    expect(await asUser(admin, () => saveProduct(f))).toMatchObject({ status: 'invalid' })
    expect(await bySku(`${PREFIX}P3`)).toBeNull()
  })

  test('tải ảnh lên Storage lỗi (hoặc không có Storage) vẫn lưu sản phẩm, giữ ảnh cũ', async () => {
    const f = productForm({ sku: `${PREFIX}P4`, imageUrl: 'https://x.vn/old.jpg' })
    f.set('image', new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }))
    const res = await asUser(admin, () => saveProduct(f))
    expect(res.status).toBe('ok')
    const row = (await bySku(`${PREFIX}P4`))!
    // Local không có Storage → imageError; nếu có Storage thì ảnh được thay bằng URL công khai.
    if ('imageError' in res && res.imageError) expect(row.image_url).toBe('https://x.vn/old.jpg')
    else expect(row.image_url).toContain('/products/')
  })

  test('toggleProduct đảo từng trường; staff thường bị chặn', async () => {
    const row = (await bySku(`${PREFIX}P1`))!
    expect(await asUser(admin, () => toggleProduct(row.id, 'in_stock'))).toEqual({ status: 'ok', value: false })
    expect((await bySku(`${PREFIX}P1`))).toMatchObject({ in_stock: false, is_active: true })
    expect(await asUser(admin, () => toggleProduct(row.id, 'in_stock', true))).toEqual({ status: 'ok', value: true })
    expect(await asUser(admin, () => toggleProduct('khong-phai-uuid', 'is_active'))).toEqual({ status: 'not_found' })
    expect(await redirectTarget(asUser(staff, () => toggleProduct(row.id, 'is_active')))).toBe('/')
    expect(await redirectTarget(asUser(staff, () => saveProduct(productForm({ sku: `${PREFIX}ZZ` }))))).toBe('/')
    expect(await bySku(`${PREFIX}ZZ`)).toBeNull()
  })
})

describe('nhóm sản phẩm', () => {
  function catForm(name: string, extra: Record<string, string> = {}) {
    const f = new FormData()
    f.set('name', name)
    for (const [k, v] of Object.entries(extra)) f.set(k, v)
    return f
  }

  test('tạo, đổi tên, trùng tên (không phân biệt hoa thường) bị chặn', async () => {
    const res = await asUser(admin, () => saveCategory(catForm(` ${PREFIX}Nhóm A `, { sortOrder: '9' })))
    expect(res.status).toBe('ok')
    const id = (res as { id: string }).id
    expect(await asUser(admin, () => saveCategory(catForm(`${PREFIX}NHÓM a`)))).toEqual({ status: 'invalid', message: 'Tên nhóm đã tồn tại' })
    expect(await asUser(admin, () => saveCategory(catForm(`${PREFIX}Nhóm A2`, { id, sortOrder: '3' })))).toEqual({ status: 'ok', id })
    const { data } = await adminClient().from('categories').select('name, sort_order').eq('id', id).single().throwOnError()
    expect(data).toEqual({ name: `${PREFIX}Nhóm A2`, sort_order: 3 })
    expect(await asUser(admin, () => saveCategory(catForm('  ')))).toMatchObject({ status: 'invalid' })
    expect(await redirectTarget(asUser(staff, () => saveCategory(catForm(`${PREFIX}X`))))).toBe('/')
  })

  test('link ảnh nhóm: lưu http/https, rỗng = bỏ ảnh, không gửi = giữ nguyên', async () => {
    const res = await asUser(admin, () => saveCategory(catForm(`${PREFIX}Nhóm ảnh`, { imageUrl: 'https://x.vn/nhom.jpg' })))
    expect(res.status).toBe('ok')
    const id = (res as { id: string }).id
    const img = async () => (await adminClient().from('categories').select('image_url').eq('id', id).single().throwOnError()).data.image_url
    expect(await img()).toBe('https://x.vn/nhom.jpg')
    expect(await asUser(admin, () => saveCategory(catForm(`${PREFIX}Nhóm ảnh`, { id })))).toEqual({ status: 'ok', id })
    expect(await img()).toBe('https://x.vn/nhom.jpg')
    expect(await asUser(admin, () => saveCategory(catForm(`${PREFIX}Nhóm ảnh`, { id, imageUrl: 'javascript:alert(1)' })))).toMatchObject({ status: 'invalid' })
    expect(await asUser(admin, () => saveCategory(catForm(`${PREFIX}Nhóm ảnh`, { id, imageUrl: '' })))).toEqual({ status: 'ok', id })
    expect(await img()).toBeNull()
  })

  test('xóa nhóm: chặn khi còn sản phẩm, xóa được khi trống', async () => {
    const { data: c } = await adminClient().from('categories').insert({ name: `${PREFIX}Nhóm B` }).select('id').single().throwOnError()
    await adminClient().from('products').insert({ sku: `${PREFIX}CB`, name: 'x', unit: '', category_id: c.id, list_price: 1 }).throwOnError()
    expect(await asUser(admin, () => deleteCategory(c.id))).toEqual({ status: 'category_in_use' })
    await adminClient().from('products').delete().eq('sku', `${PREFIX}CB`).throwOnError()
    expect(await redirectTarget(asUser(staff, () => deleteCategory(c.id)))).toBe('/')
    expect(await asUser(admin, () => deleteCategory(c.id))).toEqual({ status: 'ok' })
    expect(await asUser(admin, () => deleteCategory(c.id))).toEqual({ status: 'not_found' })
  })
})
