import ExcelJS from 'exceljs'
import { describe, expect, test } from 'vitest'
import { buildProductWorkbook, LEGACY_PRODUCT_HEADERS, parseProductSheet, PRODUCT_HEADERS } from '@/lib/excel/products'

const NPK_ID = 'cat-npk'
const categories = [{ id: NPK_ID, name: 'Phân NPK' }, { id: 'cat-thuoc', name: 'Thuốc BVTV' }]

async function sheet(rows: unknown[][], headers: readonly string[] = PRODUCT_HEADERS): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sản phẩm')
  ws.addRow([...headers])
  for (const r of rows) ws.addRow(r as ExcelJS.CellValue[])
  const buf = await wb.xlsx.writeBuffer()
  return buf as ArrayBuffer
}
const parse = async (rows: unknown[][]) => parseProductSheet(await sheet(rows), categories)

describe('parseProductSheet', () => {
  test('đọc giá nhiều định dạng', async () => {
    const { rows, errors } = await parse([
      ['NPK1', 'NPK 16-16-8', 'bao 50kg', 'phân npk ', '350.000', 'có', '', ''],
      ['NPK2', 'NPK 20-20-15', 'bao 50kg', 'Phân NPK', '350,000', 'x', '1', ''],
      ['NPK3', 'C', '', 'Phân NPK', '350000 đ', 'không', 'không', 'mô tả'],
      ['NPK4', 'D', '', 'Phân NPK', 350000, 'true', 'false', ''],
    ])
    expect(errors).toEqual([])
    expect(rows.map((r) => r.listPrice)).toEqual([350000, 350000, 350000, 350000])
    expect(rows[0]).toMatchObject({ categoryId: NPK_ID, inStock: true, isActive: true, description: null })
    expect(rows[1]).toMatchObject({ inStock: true, isActive: true })
    expect(rows[2]).toMatchObject({ inStock: false, isActive: false, description: 'mô tả', unit: '' })
    expect(rows[3]).toMatchObject({ inStock: true, isActive: false })
  })

  test('lỗi theo dòng', async () => {
    const { rows, errors } = await parse([
      ['', 'A', '', 'Phân NPK', '1', '', '', ''],
      ['S1', 'B', '', 'Không có', '1', '', '', ''],
      ['S2', 'C', '', 'Phân NPK', 'abc', '', '', ''],
      ['S2', 'D', '', 'Phân NPK', '1', '', '', ''],
    ])
    expect(errors).toEqual([
      { row: 2, message: 'Thiếu SKU' },
      { row: 3, message: 'Nhóm không tồn tại: Không có' },
      { row: 4, message: 'Giá không hợp lệ' },
      { row: 5, message: 'SKU trùng trong file (dòng 4)' },
    ])
    expect(rows).toEqual([])
  })

  test('thiếu tên; giá âm, thập phân, rỗng đều bị từ chối', async () => {
    const { errors } = await parse([
      ['A', '', '', 'Phân NPK', '1', '', '', ''],
      ['B', 'x', '', 'Phân NPK', '-5', '', '', ''],
      ['C', 'x', '', 'Phân NPK', '1.5', '', '', ''],
      ['D', 'x', '', 'Phân NPK', 12.5, '', '', ''],
      ['E', 'x', '', 'Phân NPK', '', '', '', ''],
    ])
    expect(errors).toEqual([
      { row: 2, message: 'Thiếu tên' },
      { row: 3, message: 'Giá không hợp lệ' },
      { row: 4, message: 'Giá không hợp lệ' },
      { row: 5, message: 'Giá không hợp lệ' },
      { row: 6, message: 'Giá không hợp lệ' },
    ])
  })

  test('bỏ qua dòng trống hoàn toàn nhưng giữ số dòng Excel', async () => {
    const { rows, errors } = await parse([
      [],
      ['A', 'x', '', 'Phân NPK', '1', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', 'y', '', 'Phân NPK', '1', '', '', ''],
    ])
    expect(rows.map((r) => r.sku)).toEqual(['A'])
    expect(errors).toEqual([{ row: 5, message: 'Thiếu SKU' }])
  })

  test('sai tiêu đề thì báo lỗi, không đọc dữ liệu', async () => {
    const bad = ['Tên', 'SKU', ...PRODUCT_HEADERS.slice(2)]
    const { rows, errors } = await parseProductSheet(await sheet([['A', 'x', '', 'Phân NPK', '1']], bad), categories)
    expect(rows).toEqual([])
    expect(errors).toHaveLength(1)
    expect(errors[0].row).toBe(1)
  })

  test('buildProductWorkbook ghi file mà parseProductSheet đọc lại đúng', async () => {
    const buf = await buildProductWorkbook([
      {
        sku: 'A1', name: 'Tên', unit: 'bao', category: 'Phân NPK', listPrice: 125000, inStock: false, isActive: true, description: 'ghi chú',
        brand: null, shortDesc: null, composition: null, benefits: null, usage: null, crops: [], isFeatured: false,
      },
    ])
    const { rows, errors } = await parseProductSheet(new Uint8Array(buf).buffer, categories)
    expect(errors).toEqual([])
    expect(rows).toEqual([
      {
        sku: 'A1', name: 'Tên', unit: 'bao', categoryId: NPK_ID, listPrice: 125000, inStock: false, isActive: true, description: 'ghi chú',
        brand: null, shortDesc: null, composition: null, benefits: null, usage: null, crops: [], isFeatured: false,
      },
    ])
  })

  test('mẫu 15 cột: đủ tiêu đề mới', () => {
    expect(PRODUCT_HEADERS).toEqual([
      'SKU', 'Tên', 'Quy cách', 'Nhóm', 'Giá niêm yết', 'Còn hàng', 'Hiển thị', 'Mô tả',
      'Thương hiệu', 'Mô tả ngắn', 'Thành phần', 'Công dụng', 'Cách dùng', 'Cây trồng', 'Nổi bật',
    ])
  })

  test('file 15 cột: đọc cột mô tả, cây trồng tách phẩy, nổi bật', async () => {
    const { rows, errors } = await parse([
      ['A', 'NPK', 'bao', 'Phân NPK', '1', 'có', 'có', '', 'Bình Điền', ' ngắn ', 'N 20%', 'xanh lá\ncứng cây', 'bón thúc', 'Lúa, Cà phê, ,', 'có'],
      ['B', 'NPK', 'bao', 'Phân NPK', '1', '', '', '', '', '', '', '', '', '', ''],
      ['C', 'NPK', 'bao', 'Phân NPK', '1', '', '', '', '', '', '', '', '', '', 'hmm'],
    ])
    expect(errors).toEqual([{ row: 4, message: 'Nổi bật không hợp lệ: hmm' }])
    expect(rows[0]).toMatchObject({
      brand: 'Bình Điền', shortDesc: 'ngắn', composition: 'N 20%', benefits: 'xanh lá\ncứng cây', usage: 'bón thúc',
      crops: ['Lúa', 'Cà phê'], isFeatured: true,
    })
    expect(rows[1]).toMatchObject({ brand: null, shortDesc: null, crops: [], isFeatured: false })
  })

  test('file mẫu cũ 8 cột vẫn đọc được, cột mới coi như trống', async () => {
    const { rows, errors } = await parseProductSheet(
      await sheet([['A', 'NPK', 'bao', 'Phân NPK', '1', 'có', 'có', 'mô tả']], LEGACY_PRODUCT_HEADERS),
      categories,
    )
    expect(errors).toEqual([])
    expect(rows).toEqual([{
      sku: 'A', name: 'NPK', unit: 'bao', categoryId: NPK_ID, listPrice: 1, inStock: true, isActive: true, description: 'mô tả',
      brand: null, shortDesc: null, composition: null, benefits: null, usage: null, crops: [], isFeatured: false,
    }])
  })

  test('tiêu đề cột mới sai thì báo lỗi', async () => {
    const bad = [...PRODUCT_HEADERS.slice(0, 8), 'Hãng', ...PRODUCT_HEADERS.slice(9)]
    const { rows, errors } = await parseProductSheet(await sheet([], bad), categories)
    expect(rows).toEqual([])
    expect(errors).toEqual([{ row: 1, message: expect.stringContaining('Sai tiêu đề cột') }])
  })

  test('xuất 15 cột rồi đọc lại giữ nguyên cột mới', async () => {
    const buf = await buildProductWorkbook([{
      sku: 'A2', name: 'Tên', unit: 'bao', category: 'Phân NPK', listPrice: 1000, inStock: true, isActive: true, description: null,
      brand: 'Phú Mỹ', shortDesc: 'ngắn', composition: 'N 46%', benefits: 'a\nb', usage: 'c', crops: ['Lúa', 'Ngô'], isFeatured: true,
    }])
    const { rows, errors } = await parseProductSheet(new Uint8Array(buf).buffer, categories)
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({
      brand: 'Phú Mỹ', shortDesc: 'ngắn', composition: 'N 46%', benefits: 'a\nb', usage: 'c', crops: ['Lúa', 'Ngô'], isFeatured: true,
    })
  })
})
