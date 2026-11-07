// Đọc / ghi file Excel sản phẩm (thuần, không phụ thuộc DB). Hàng 1 là tiêu đề.
import ExcelJS from 'exceljs'

export const PRODUCT_HEADERS = [
  'SKU', 'Tên', 'Quy cách', 'Nhóm', 'Giá niêm yết', 'Còn hàng', 'Hiển thị', 'Mô tả',
] as const

export type ProductRow = {
  sku: string
  name: string
  unit: string
  categoryId: string
  listPrice: number
  inStock: boolean
  isActive: boolean
  description: string | null
}
export type RowError = { row: number; message: string }
export type ExportProduct = {
  sku: string; name: string; unit: string; category: string
  listPrice: number; inStock: boolean; isActive: boolean; description: string | null
}

export const MAX_IMPORT_ROWS = 5000

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((t) => t.text).join('').trim()
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue)
    if ('text' in v) return String(v.text).trim()
  }
  return String(v).trim()
}

const norm = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()

/** "350.000", "350,000", "350000 đ", 350000 → 350000; âm, thập phân, rỗng → null. */
export function parsePrice(raw: string | number): number | null {
  if (typeof raw === 'number') return Number.isSafeInteger(raw) && raw >= 0 ? raw : null
  const s = raw.normalize('NFC').toLowerCase().replace(/\s+/g, '').replace(/(đ|vnđ|vnd|d)$/, '')
  if (/^\d+$/.test(s) || /^\d{1,3}([.,]\d{3})+$/.test(s)) {
    const n = Number(s.replace(/[.,]/g, ''))
    return Number.isSafeInteger(n) ? n : null
  }
  return null
}

const TRUE = new Set(['có', 'co', 'x', '1', 'true'])
const FALSE = new Set(['không', 'khong', '0', 'false'])

/** Rỗng → `whenEmpty`; không nhận ra → null. */
function parseFlag(raw: string, whenEmpty: boolean): boolean | null {
  const s = norm(raw)
  if (s === '') return whenEmpty
  if (TRUE.has(s)) return true
  if (FALSE.has(s)) return false
  return null
}

export async function parseProductSheet(
  buf: ArrayBuffer,
  categories: { id: string; name: string }[],
): Promise<{ rows: ProductRow[]; errors: RowError[] }> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buf)
  } catch {
    return { rows: [], errors: [{ row: 1, message: 'Không đọc được file. Hãy dùng file .xlsx theo mẫu' }] }
  }
  const ws = wb.worksheets[0]
  if (!ws) return { rows: [], errors: [{ row: 1, message: 'File không có trang tính nào' }] }

  const header = PRODUCT_HEADERS.map((_, i) => norm(cellText(ws.getRow(1).getCell(i + 1).value)))
  if (PRODUCT_HEADERS.some((h, i) => header[i] !== norm(h))) {
    return { rows: [], errors: [{ row: 1, message: `Sai tiêu đề cột. Hàng 1 phải là: ${PRODUCT_HEADERS.join(' | ')}` }] }
  }
  if (ws.rowCount - 1 > MAX_IMPORT_ROWS * 2) {
    return { rows: [], errors: [{ row: 1, message: 'File quá lớn' }] }
  }

  const byName = new Map<string, string>()
  for (const c of categories) if (!byName.has(norm(c.name))) byName.set(norm(c.name), c.id)

  const rows: ProductRow[] = []
  const errors: RowError[] = []
  const seen = new Map<string, number>()
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const c = PRODUCT_HEADERS.map((_, i) => cellText(row.getCell(i + 1).value))
    if (c.every((v) => v === '')) continue
    const [sku, name, unit, group, priceText, stockText, activeText, desc] = c
    const rawPrice = row.getCell(5).value
    const problems: string[] = []

    if (!sku) problems.push('Thiếu SKU')
    if (!name) problems.push('Thiếu tên')
    const listPrice = priceText === '' ? null : parsePrice(typeof rawPrice === 'number' ? rawPrice : priceText)
    if (listPrice === null) problems.push('Giá không hợp lệ')
    const categoryId = byName.get(norm(group))
    if (!categoryId) problems.push(group ? `Nhóm không tồn tại: ${group}` : 'Thiếu nhóm')
    const inStock = parseFlag(stockText, false)
    if (inStock === null) problems.push(`Còn hàng không hợp lệ: ${stockText}`)
    const isActive = parseFlag(activeText, true)
    if (isActive === null) problems.push(`Hiển thị không hợp lệ: ${activeText}`)
    if (sku) {
      const first = seen.get(sku)
      if (first !== undefined) problems.push(`SKU trùng trong file (dòng ${first})`)
      else seen.set(sku, r)
    }

    if (problems.length) {
      for (const message of problems) errors.push({ row: r, message })
    } else {
      rows.push({
        sku, name, unit, categoryId: categoryId!, listPrice: listPrice!,
        inStock: inStock!, isActive: isActive!, description: desc || null,
      })
    }
  }
  if (rows.length + errors.length > MAX_IMPORT_ROWS) {
    return { rows: [], errors: [{ row: 1, message: `Tối đa ${MAX_IMPORT_ROWS} dòng mỗi lần nhập` }] }
  }
  return { rows, errors }
}

async function toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await wb.xlsx.writeBuffer())
}

function newSheet(): { wb: ExcelJS.Workbook; ws: ExcelJS.Worksheet } {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sản phẩm')
  ws.addRow([...PRODUCT_HEADERS]).font = { bold: true }
  ws.columns = [14, 36, 16, 22, 16, 11, 11, 40].map((width) => ({ width }))
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  return { wb, ws }
}

const yesNo = (b: boolean) => (b ? 'có' : 'không')

/** File xlsx đúng mẫu; nhập lại được bằng parseProductSheet. */
export async function buildProductWorkbook(products: ExportProduct[]): Promise<Buffer> {
  const { wb, ws } = newSheet()
  for (const p of products) {
    ws.addRow([p.sku, p.name, p.unit, p.category, p.listPrice, yesNo(p.inStock), yesNo(p.isActive), p.description ?? ''])
  }
  ws.getColumn(5).numFmt = '#,##0'
  return toBuffer(wb)
}

/** File mẫu: tiêu đề và một dòng ví dụ. */
export async function buildProductTemplate(exampleCategory: string): Promise<Buffer> {
  return buildProductWorkbook([
    { sku: 'NPK-16-16-8', name: 'Phân NPK 16-16-8', unit: 'bao 50kg', category: exampleCategory, listPrice: 350000, inStock: true, isActive: true, description: 'Ví dụ — xóa dòng này trước khi nhập' },
  ])
}
