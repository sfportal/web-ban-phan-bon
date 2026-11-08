import ExcelJS from 'exceljs'
import { describe, expect, test } from 'vitest'
import {
  ALL_DATA_SHEETS, BALANCE_HEADERS, buildBalancesSheet, buildCommissionWorkbook, buildOrdersWorkbook,
  buildPayoutBatchSheet, buildPayoutRequestsSheet, buildTablesWorkbook, COMMISSION_HEADERS, ORDER_HEADERS,
  PAYOUT_HEADERS, type BalanceExportRow, type CommissionRow, type OrderExportRow, type PayoutExportRow,
} from '@/lib/excel/export'

async function read(buf: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  return wb
}
const rowValues = (ws: ExcelJS.Worksheet, r: number) => (ws.getRow(r).values as unknown[]).slice(1)

describe('buildCommissionWorkbook', () => {
  const rows: CommissionRow[] = [
    { partnerId: 'a', partnerName: 'CTV An', phone: '0905000001', earned: 120000, reversed: -20000, net: 100000, pending: 100000, paid: 0 },
    { partnerId: 'b', partnerName: 'CTV Bình', phone: '0905000002', earned: 50000, reversed: 0, net: 50000, pending: 0, paid: 50000 },
  ]

  test('tiêu đề tiếng Việt, mỗi CTV một hàng, hàng tổng, cột tiền #,##0', async () => {
    const ws = (await read(await buildCommissionWorkbook('2026-11', rows))).worksheets[0]
    expect(ws.name).toBe('Hoa hồng 2026-11')
    expect(rowValues(ws, 1)).toEqual([...COMMISSION_HEADERS])
    expect(COMMISSION_HEADERS).toEqual(['CTV', 'SĐT', 'Ghi nhận', 'Hoàn (trả hàng)', 'Thực nhận', 'Chờ chi', 'Đã chi'])
    expect(rowValues(ws, 2)).toEqual(['CTV An', '0905000001', 120000, -20000, 100000, 100000, 0])
    expect(rowValues(ws, 3)).toEqual(['CTV Bình', '0905000002', 50000, 0, 50000, 0, 50000])
    expect(rowValues(ws, 4)).toEqual(['Tổng', '', 170000, -20000, 150000, 100000, 50000])
    expect(ws.rowCount).toBe(4)
    for (let c = 3; c <= 7; c++) expect(ws.getRow(2).getCell(c).numFmt).toBe('#,##0')
  })

  test('kỳ không có hoa hồng: chỉ tiêu đề và hàng tổng 0', async () => {
    const ws = (await read(await buildCommissionWorkbook('2026-10', []))).worksheets[0]
    expect(rowValues(ws, 2)).toEqual(['Tổng', '', 0, 0, 0, 0, 0])
  })
})

describe('buildOrdersWorkbook', () => {
  const row: OrderExportRow = {
    code: 'DH2611-0001', createdAt: '2026-11-07T01:30:00Z', source: 'partner', partnerName: 'CTV An',
    farmerName: 'Ông Ba', phone: '0912345678', productName: 'NPK 16-16-8', qty: 3, salePrice: 350000,
    lineTotal: 1050000, ratePct: 5, commission: 52500, partnerPrice: null, status: 'paid',
  }

  test('mỗi dòng đơn một hàng; ngày giờ VN; cột tiền #,##0', async () => {
    const ws = (await read(await buildOrdersWorkbook([row, { ...row, source: 'retail', partnerName: null, partnerPrice: 330000, commission: 0, ratePct: 0, status: 'new' }]))).worksheets[0]
    expect(rowValues(ws, 1)).toEqual([...ORDER_HEADERS])
    const values = rowValues(ws, 2)
    // 01:30 UTC = 08:30 giờ VN, ghi dạng giờ "treo tường" để Excel hiển thị đúng.
    expect((values[1] as Date).toISOString()).toBe('2026-11-07T08:30:00.000Z')
    expect(ws.getRow(2).getCell(2).numFmt).toBe('dd/mm/yyyy hh:mm')
    expect([values[0], ...values.slice(2)]).toEqual([
      'DH2611-0001', 'Đối tác', 'CTV An', 'Ông Ba', '0912345678', 'NPK 16-16-8', 3, 350000, 1050000, 5, 52500, '', 'Đã thu đủ tiền', '—',
    ])
    expect(rowValues(ws, 3).slice(2, 4)).toEqual(['Đơn lẻ', ''])
    expect(rowValues(ws, 3)[12]).toBe(330000)
    expect(rowValues(ws, 3)[13]).toBe('Mới')
    expect(rowValues(ws, 3)[14]).toBe('—')
    for (const c of [9, 10, 12, 13]) expect(ws.getRow(2).getCell(c).numFmt).toBe('#,##0')
  })
})

describe('buildTablesWorkbook', () => {
  test('mỗi bảng một sheet, tiêu đề theo cột, tiền #,##0, null → ô trống', async () => {
    const wb = await read(await buildTablesWorkbook([
      { name: 'Sản phẩm', columns: [{ key: 'sku', header: 'SKU' }, { key: 'list_price', header: 'Giá niêm yết', type: 'money' }], rows: [{ sku: 'A', list_price: 1000 }, { sku: 'B', list_price: null }] },
      { name: 'Trống', columns: [{ key: 'x', header: 'X' }], rows: [] },
    ]))
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Sản phẩm', 'Trống'])
    const ws = wb.worksheets[0]
    expect(rowValues(ws, 1)).toEqual(['SKU', 'Giá niêm yết'])
    expect(rowValues(ws, 2)).toEqual(['A', 1000])
    expect(rowValues(ws, 3)).toEqual(['B'])
    expect(ws.getRow(2).getCell(2).numFmt).toBe('#,##0')
  })

  test('danh mục sheet xuất toàn bộ: tên sheet duy nhất, ≤ 31 ký tự, có các bảng chính', () => {
    const names = ALL_DATA_SHEETS.map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
    for (const n of names) expect(n.length).toBeLessThanOrEqual(31)
    expect(ALL_DATA_SHEETS.map((s) => s.table)).toEqual(expect.arrayContaining([
      'categories', 'products', 'partner_tiers', 'tier_rates', 'tier_product_rates', 'promotions', 'partners',
      'farmers', 'orders', 'order_lines', 'order_status_log', 'commission_entries', 'settings',
    ]))
  })
})

describe('xuất chi trả', () => {
  const paid: PayoutExportRow = {
    partnerName: 'CTV An', phone: '0905000001', amount: 1500000, status: 'paid',
    bankName: 'Vietcombank', bankAccount: '0012345678', bankHolder: 'NGUYEN VAN AN',
    requestedAt: '2026-11-07T01:30:00Z', transferRef: 'GD123', transferredOn: '2026-11-08', rejectReason: null,
  }
  const rejected: PayoutExportRow = {
    ...paid, partnerName: 'CTV Bình', phone: '0905000002', amount: 200000, status: 'rejected',
    transferRef: null, transferredOn: null, rejectReason: 'Sai số tài khoản',
  }

  test('yêu cầu rút: tiêu đề tiếng Việt, trạng thái, số TK giữ số 0 đầu, tiền #,##0, hàng tổng', async () => {
    const ws = (await read(await buildPayoutRequestsSheet([paid, rejected]))).worksheets[0]
    expect(ws.name).toBe('Yêu cầu rút')
    expect(PAYOUT_HEADERS).toEqual([
      'CTV', 'SĐT', 'Số tiền', 'Trạng thái', 'Ngân hàng', 'Số tài khoản', 'Chủ tài khoản', 'Ngày yêu cầu',
      'Mã giao dịch', 'Ngày chuyển', 'Lý do từ chối', 'Dữ liệu thử',
    ])
    expect(rowValues(ws, 1)).toEqual([...PAYOUT_HEADERS])
    const v = rowValues(ws, 2)
    expect(v.slice(0, 7)).toEqual(['CTV An', '0905000001', 1500000, 'Đã chuyển', 'Vietcombank', '0012345678', 'NGUYEN VAN AN'])
    expect((v[7] as Date).toISOString()).toBe('2026-11-07T08:30:00.000Z')
    expect(v[8]).toBe('GD123')
    expect((v[9] as Date).toISOString()).toBe('2026-11-08T00:00:00.000Z')
    expect(ws.getRow(2).getCell(10).numFmt).toBe('dd/mm/yyyy')
    expect(rowValues(ws, 3)[3]).toBe('Từ chối')
    expect(rowValues(ws, 3)[10]).toBe('Sai số tài khoản')
    expect(rowValues(ws, 4).slice(0, 3)).toEqual(['Tổng', '', 1700000])
    expect(ws.getRow(2).getCell(3).numFmt).toBe('#,##0')
  })

  test('đợt chi: tên sheet theo ngày chốt, dòng thông tin đợt, rồi bảng khoản chi', async () => {
    const ws = (await read(await buildPayoutBatchSheet(
      { kind: 'monthly', cutoffDate: '2026-10-31', note: 'Tháng 10' }, [paid],
    ))).worksheets[0]
    expect(ws.name).toBe('Đợt chi 2026-10-31')
    expect(rowValues(ws, 1)).toEqual(['Đợt chi theo tháng, chốt 31/10/2026 — Tháng 10'])
    expect(rowValues(ws, 2)).toEqual([...PAYOUT_HEADERS])
    expect(rowValues(ws, 3).slice(0, 4)).toEqual(['CTV An', '0905000001', 1500000, 'Đã chuyển'])
    expect(rowValues(ws, 4).slice(0, 3)).toEqual(['Tổng', '', 1500000])
    expect(ws.getRow(3).getCell(3).numFmt).toBe('#,##0')
  })

  test('số dư đối tác: 4 cột tiền, hàng tổng, số âm giữ nguyên', async () => {
    const rows: BalanceExportRow[] = [
      { partnerName: 'CTV An', phone: '0905000001', earned: 300000, pendingOut: 100000, paid: 150000, available: 50000 },
      { partnerName: 'CTV Bình', phone: '0905000002', earned: 120000, pendingOut: 0, paid: 150000, available: -30000, isDemo: true },
    ]
    const ws = (await read(await buildBalancesSheet(rows))).worksheets[0]
    expect(ws.name).toBe('Số dư đối tác')
    expect(BALANCE_HEADERS).toEqual(['CTV', 'SĐT', 'Đã kiếm được', 'Đang chờ chi', 'Đã nhận', 'Số dư khả dụng', 'Dữ liệu thử'])
    expect(rowValues(ws, 1)).toEqual([...BALANCE_HEADERS])
    expect(rowValues(ws, 2)).toEqual(['CTV An', '0905000001', 300000, 100000, 150000, 50000, '—'])
    expect(rowValues(ws, 3)).toEqual(['CTV Bình', '0905000002', 120000, 0, 150000, -30000, 'Có'])
    expect(rowValues(ws, 4)).toEqual(['Tổng', '', 420000, 100000, 300000, 20000, ''])
    for (let c = 3; c <= 6; c++) expect(ws.getRow(2).getCell(c).numFmt).toBe('#,##0')
  })
})
