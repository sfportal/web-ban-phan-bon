// Dựng file Excel xuất dữ liệu (thuần, không phụ thuộc DB): hoa hồng theo kỳ, dòng đơn hàng
// cho kế toán, chi trả (yêu cầu rút, đợt chi, số dư) và sao lưu mỗi bảng một sheet. Tiêu đề cột tiếng Việt, cột tiền `#,##0`.
import ExcelJS from 'exceljs'
import { STATUS_LABEL, type OrderStatus } from '@/lib/orders/status'
import { BATCH_KIND_LABEL, PAYOUT_STATUS_LABEL, type BatchKind, type PayoutStatus } from '@/lib/payouts/validate'

const FLAG_HEADER = 'Dữ liệu thử'
const flag = (v: boolean | null | undefined) => (v ? 'Có' : '—')

const MONEY = '#,##0'
const DATE_TIME = 'dd/mm/yyyy hh:mm'
const DATE = 'dd/mm/yyyy'
const VN_OFFSET_MS = 7 * 3600_000

/**
 * Excel không có múi giờ: ghi giờ "treo tường" VN (UTC+7) để ô hiển thị đúng giờ Việt Nam
 * mà vẫn là ngày thật (lọc/sắp xếp được).
 */
function vnWallClock(d: string | Date): Date {
  return new Date(new Date(d).getTime() + VN_OFFSET_MS)
}

async function toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await wb.xlsx.writeBuffer())
}

function sheet(wb: ExcelJS.Workbook, name: string, headers: readonly string[], widths: number[]): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name)
  ws.addRow([...headers]).font = { bold: true }
  ws.columns = widths.map((width) => ({ width }))
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  return ws
}

// Đơn hàng (kế toán) --------------------------------------------------------------------

export type OrderExportRow = {
  code: string
  createdAt: string
  source: 'partner' | 'retail'
  partnerName: string | null
  farmerName: string | null
  phone: string | null
  productName: string
  qty: number
  salePrice: number
  lineTotal: number
  ratePct: number
  commission: number
  /** Giá mua / đơn vị của đại lý; null với đơn CTV / đơn lẻ. */
  partnerPrice: number | null
  status: OrderStatus
  isDemo?: boolean
}

export const ORDER_HEADERS = [
  'Mã đơn', 'Ngày', 'Nguồn', 'CTV', 'Nông dân', 'SĐT', 'Sản phẩm', 'SL', 'Đơn giá bán', 'Thành tiền',
  '%', 'Hoa hồng', 'Giá đại lý', 'Trạng thái', FLAG_HEADER,
] as const

/** Mỗi dòng đơn một hàng. */
export async function buildOrdersWorkbook(rows: OrderExportRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = sheet(wb, 'Đơn hàng', ORDER_HEADERS, [14, 17, 10, 24, 24, 13, 32, 7, 14, 15, 7, 13, 13, 16, 12])
  for (const r of rows) {
    ws.addRow([
      r.code, vnWallClock(r.createdAt), r.source === 'partner' ? 'Đối tác' : 'Đơn lẻ', r.partnerName ?? '',
      r.farmerName ?? '', r.phone ?? '', r.productName, r.qty, r.salePrice, r.lineTotal, r.ratePct, r.commission,
      r.partnerPrice ?? '', STATUS_LABEL[r.status], flag(r.isDemo),
    ])
  }
  ws.getColumn(2).numFmt = DATE_TIME
  for (const c of [9, 10, 12, 13]) ws.getColumn(c).numFmt = MONEY
  return toBuffer(wb)
}

// Chi trả ---------------------------------------------------------------------------------

export type PayoutExportRow = {
  partnerName: string
  phone: string
  amount: number
  status: PayoutStatus
  bankName: string | null
  bankAccount: string | null
  bankHolder: string | null
  requestedAt: string
  transferRef: string | null
  /** yyyy-mm-dd */
  transferredOn: string | null
  rejectReason: string | null
  isDemo?: boolean
}

export const PAYOUT_HEADERS = [
  'CTV', 'SĐT', 'Số tiền', 'Trạng thái', 'Ngân hàng', 'Số tài khoản', 'Chủ tài khoản', 'Ngày yêu cầu',
  'Mã giao dịch', 'Ngày chuyển', 'Lý do từ chối', FLAG_HEADER,
] as const
const PAYOUT_WIDTHS = [26, 13, 14, 12, 20, 18, 24, 17, 16, 12, 28, 12]

/** Ngày yyyy-mm-dd → Date 0h UTC (ô ngày thuần, không lệch múi giờ). */
function dateOnly(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`)
}

function formatYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

/** Thêm bảng khoản chi (tiêu đề ở hàng `ws.rowCount + 1`) và hàng "Tổng". */
function addPayoutTable(ws: ExcelJS.Worksheet, rows: PayoutExportRow[]): void {
  ws.addRow([...PAYOUT_HEADERS]).font = { bold: true }
  let total = 0
  for (const r of rows) {
    ws.addRow([
      r.partnerName, r.phone, r.amount, PAYOUT_STATUS_LABEL[r.status], r.bankName ?? '', r.bankAccount ?? '',
      r.bankHolder ?? '', vnWallClock(r.requestedAt), r.transferRef ?? '',
      r.transferredOn ? dateOnly(r.transferredOn) : '', r.rejectReason ?? '', flag(r.isDemo),
    ])
    total += r.amount
  }
  ws.addRow(['Tổng', '', total]).font = { bold: true }
  ws.columns = PAYOUT_WIDTHS.map((width) => ({ width }))
  ws.getColumn(3).numFmt = MONEY
  ws.getColumn(8).numFmt = DATE_TIME
  ws.getColumn(10).numFmt = DATE
}

/** Danh sách yêu cầu rút (mỗi khoản một hàng) và hàng "Tổng". */
export async function buildPayoutRequestsSheet(rows: PayoutExportRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Yêu cầu rút')
  addPayoutTable(ws, rows)
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  return toBuffer(wb)
}

/** Một đợt chi: hàng 1 mô tả đợt, rồi bảng khoản chi và hàng "Tổng". */
export async function buildPayoutBatchSheet(
  batch: { kind: BatchKind; cutoffDate: string; note: string | null },
  rows: PayoutExportRow[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(`Đợt chi ${batch.cutoffDate}`)
  const title = `Đợt chi ${BATCH_KIND_LABEL[batch.kind]}, chốt ${formatYmd(batch.cutoffDate)}${batch.note ? ` — ${batch.note}` : ''}`
  ws.addRow([title]).font = { bold: true }
  addPayoutTable(ws, rows)
  ws.views = [{ state: 'frozen', ySplit: 2 }]
  return toBuffer(wb)
}

export type BalanceExportRow = {
  partnerName: string
  phone: string
  earned: number
  pendingOut: number
  paid: number
  available: number
  isDemo?: boolean
}

export const BALANCE_HEADERS = ['CTV', 'SĐT', 'Đã kiếm được', 'Đang chờ chi', 'Đã nhận', 'Số dư khả dụng', FLAG_HEADER] as const

/** Số dư ví mỗi CTV và hàng "Tổng". */
export async function buildBalancesSheet(rows: BalanceExportRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = sheet(wb, 'Số dư đối tác', BALANCE_HEADERS, [30, 14, 15, 15, 15, 16, 12])
  const total = { earned: 0, pendingOut: 0, paid: 0, available: 0 }
  for (const r of rows) {
    ws.addRow([r.partnerName, r.phone, r.earned, r.pendingOut, r.paid, r.available, flag(r.isDemo)])
    for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += r[k]
  }
  ws.addRow(['Tổng', '', total.earned, total.pendingOut, total.paid, total.available, '']).font = { bold: true }
  for (let c = 3; c <= 6; c++) ws.getColumn(c).numFmt = MONEY
  return toBuffer(wb)
}

// Sao lưu: mỗi bảng một sheet --------------------------------------------------------------

export type ColumnSpec = { key: string; header: string; type?: 'money' | 'datetime' | 'json' | 'flag' }
export type TableSheet = { name: string; columns: ColumnSpec[]; rows: Record<string, unknown>[] }

function cell(v: unknown, type: ColumnSpec['type']): ExcelJS.CellValue {
  if (v === null || v === undefined) return null
  if (type === 'datetime') return vnWallClock(String(v))
  if (type === 'money') return Number(v)
  if (type === 'flag') return flag(Boolean(v))
  if (type === 'json' || typeof v === 'object') return typeof v === 'string' ? v : JSON.stringify(v)
  return v as ExcelJS.CellValue
}

export async function buildTablesWorkbook(sheets: TableSheet[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  for (const s of sheets) {
    const ws = sheet(wb, s.name, s.columns.map((c) => c.header), s.columns.map((c) => (c.type === 'json' ? 40 : 18)))
    for (const r of s.rows) ws.addRow(s.columns.map((c) => cell(r[c.key], c.type)))
    s.columns.forEach((c, i) => {
      if (c.type === 'money') ws.getColumn(i + 1).numFmt = MONEY
      if (c.type === 'datetime') ws.getColumn(i + 1).numFmt = DATE_TIME
    })
  }
  return toBuffer(wb)
}

const col = (key: string, header: string, type?: ColumnSpec['type']): ColumnSpec => ({ key, header, type })

/** Các bảng chính trong file "Xuất toàn bộ dữ liệu" (thứ tự sheet). `order` = cột sắp xếp ổn định. */
export const ALL_DATA_SHEETS: { table: string; name: string; order: string[]; columns: ColumnSpec[] }[] = [
  { table: 'categories', name: 'Nhóm sản phẩm', order: ['id'], columns: [col('id', 'ID'), col('name', 'Tên'), col('sort_order', 'Thứ tự')] },
  {
    table: 'products', name: 'Sản phẩm', order: ['id'], columns: [
      col('id', 'ID'), col('sku', 'SKU'), col('name', 'Tên'), col('unit', 'Quy cách'), col('category_id', 'ID nhóm'),
      col('list_price', 'Giá niêm yết', 'money'), col('in_stock', 'Còn hàng'), col('is_active', 'Hiển thị'),
      col('description', 'Mô tả'), col('image_url', 'Ảnh'), col('updated_price_at', 'Đổi giá lúc', 'datetime'),
    ],
  },
  { table: 'partner_tiers', name: 'Bậc đối tác', order: ['id'], columns: [col('id', 'ID'), col('name', 'Tên'), col('kind', 'Loại')] },
  {
    table: 'tier_rates', name: 'Tỷ lệ theo nhóm', order: ['tier_id', 'category_id'],
    columns: [col('tier_id', 'ID bậc'), col('category_id', 'ID nhóm'), col('rate_pct', '%')],
  },
  {
    table: 'tier_product_rates', name: 'Tỷ lệ theo sản phẩm', order: ['tier_id', 'product_id'],
    columns: [col('tier_id', 'ID bậc'), col('product_id', 'ID sản phẩm'), col('rate_pct', '%')],
  },
  {
    table: 'promotions', name: 'Khuyến mãi', order: ['id'], columns: [
      col('id', 'ID'), col('name', 'Tên'), col('scope', 'Phạm vi'), col('target_id', 'ID áp dụng'), col('type', 'Loại'),
      col('value', 'Giá trị'), col('starts_at', 'Bắt đầu', 'datetime'), col('ends_at', 'Kết thúc', 'datetime'),
      col('is_active', 'Đang bật'),
    ],
  },
  {
    table: 'partners', name: 'Đối tác', order: ['id'], columns: [
      col('id', 'ID'), col('phone', 'SĐT'), col('name', 'Tên'), col('region', 'Khu vực'),
      col('delivery_address', 'Địa chỉ giao'), col('tier_id', 'ID bậc'), col('status', 'Trạng thái'),
      col('created_at', 'Ngày đăng ký', 'datetime'), col('is_demo', FLAG_HEADER, 'flag'),
    ],
  },
  {
    table: 'farmers', name: 'Nông dân', order: ['id'], columns: [
      col('id', 'ID'), col('phone', 'SĐT'), col('name', 'Tên'), col('address', 'Địa chỉ'),
      col('owner_partner_id', 'ID CTV sở hữu'), col('created_at', 'Ngày tạo', 'datetime'), col('is_demo', FLAG_HEADER, 'flag'),
    ],
  },
  {
    table: 'farmer_transfer_log', name: 'Lịch sử chuyển CTV', order: ['id'], columns: [
      col('id', 'ID'), col('farmer_id', 'ID nông dân'), col('from_partner_id', 'Từ CTV'), col('to_partner_id', 'Sang CTV'),
      col('changed_by', 'Người đổi'), col('changed_at', 'Thời điểm', 'datetime'),
    ],
  },
  {
    table: 'orders', name: 'Đơn hàng', order: ['id'], columns: [
      col('id', 'ID'), col('code', 'Mã đơn'), col('created_at', 'Ngày tạo', 'datetime'), col('source', 'Nguồn'),
      col('partner_id', 'ID đối tác'), col('status', 'Trạng thái'), col('delivery_address', 'Điểm giao'),
      col('payment_method', 'Thanh toán'), col('retail_name', 'Tên khách lẻ'), col('retail_phone', 'SĐT khách lẻ'),
      col('retail_address', 'Địa chỉ khách lẻ'), col('note', 'Ghi chú'), col('total_qty', 'Tổng SL'),
      col('subtotal', 'Tổng tiền', 'money'), col('partner_payable', 'Đại lý phải trả', 'money'),
      col('commission_expected', 'Hoa hồng dự kiến', 'money'), col('is_demo', FLAG_HEADER, 'flag'),
    ],
  },
  {
    table: 'order_lines', name: 'Dòng đơn', order: ['id'], columns: [
      col('id', 'ID'), col('order_id', 'ID đơn'), col('farmer_id', 'ID nông dân'), col('product_id', 'ID sản phẩm'),
      col('qty', 'SL'), col('list_price_snap', 'Giá niêm yết', 'money'), col('sale_price_snap', 'Giá bán', 'money'),
      col('promotion_id_snap', 'ID khuyến mãi'), col('rate_pct_snap', '%'), col('line_total', 'Thành tiền', 'money'),
      col('line_commission', 'Hoa hồng', 'money'), col('line_partner_price', 'Giá đại lý', 'money'),
    ],
  },
  {
    table: 'order_status_log', name: 'Lịch sử trạng thái', order: ['id'], columns: [
      col('id', 'ID'), col('order_id', 'ID đơn'), col('from_status', 'Từ'), col('to_status', 'Sang'),
      col('changed_by', 'Người đổi'), col('changed_at', 'Thời điểm', 'datetime'), col('note', 'Ghi chú'),
    ],
  },
  {
    table: 'commission_entries', name: 'Hoa hồng', order: ['id'], columns: [
      col('id', 'ID'), col('partner_id', 'ID đối tác'), col('order_id', 'ID đơn'), col('kind', 'Loại'),
      col('amount', 'Số tiền', 'money'), col('period', 'Kỳ'), col('status', 'Trạng thái'),
      col('created_at', 'Ngày tạo', 'datetime'), col('paid_at', 'Ngày chi', 'datetime'),
    ],
  },
  { table: 'settings', name: 'Cài đặt', order: ['key'], columns: [col('key', 'Khóa'), col('value', 'Giá trị', 'json')] },
]
