import ExcelJS from 'exceljs'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { commissionReport, exportCommissions, markCommissionsPaid } from '@/lib/admin/commission-actions'
import { bulkSetStatus, dashboardStats, exportOrders, setOrderStatus, staffEditOrder } from '@/lib/admin/orders-actions'
import { exportAll, saveSettings } from '@/lib/admin/settings-actions'
import { vnPeriod } from '@/lib/format'
import {
  adminClient, asUser, createOrderRpc, createPartner, createStaff, insertFarmerFor, orderInStatus,
  redirectTarget, resetData, sampleLine, toStatus, type TestPartner, type TestUser,
} from './helpers'

// Giả lập lỗi bất ngờ (không phải lỗi chuyển trạng thái) của change_order_status cho một đơn.
const failing = vi.hoisted(() => ({ orderId: '' }))
vi.mock('@/lib/supabase/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/admin')>()
  return {
    adminClient: () => {
      const client = actual.adminClient()
      const rpc = client.rpc.bind(client) as unknown as (fn: string, args?: Record<string, unknown>, opts?: unknown) => unknown
      const wrapped = (fn: string, args?: Record<string, unknown>, opts?: unknown) =>
        fn === 'change_order_status' && failing.orderId && args?.p_order_id === failing.orderId
          ? Promise.resolve({ data: null, error: { message: 'connection reset' } })
          : rpc(fn, args, opts)
      client.rpc = wrapped as unknown as typeof client.rpc
      return client
    },
  }
})

let admin: TestUser
let staff: TestUser
let ctv: TestPartner
let dealer: TestPartner
let farmerId: string
let product: { id: string; list_price: number }

/** Đơn CTV (1 dòng, có hoa hồng `commission`) tới trạng thái `status` bằng RPC. */
async function ctvOrder(commission: number, subtotal?: number) {
  const line = await sampleLine({ farmer_id: farmerId, line_commission: commission, rate_pct_snap: 5 })
  const { id } = await createOrderRpc({
    source: 'partner', partner_id: ctv.partnerId, retail_name: null, retail_phone: null, retail_address: null,
    delivery_address: 'Buôn Ma Thuột', commission_expected: commission, ...(subtotal ? { subtotal } : {}),
  }, [line])
  return id
}
async function walk(id: string, ...steps: Parameters<typeof toStatus>[1][]) {
  for (const s of steps) await toStatus(id, s)
}
async function status(id: string) {
  return (await adminClient().from('orders').select('status').eq('id', id).single().throwOnError()).data.status
}
const form = (o: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(o)) f.set(k, v)
  return f
}
async function load(buf: Buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  return wb
}

beforeAll(async () => {
  await resetData()
  ;[admin, staff, ctv, dealer] = await Promise.all([
    createStaff('admin'), createStaff('staff'), createPartner({ kind: 'commission' }), createPartner({ kind: 'wholesale' }),
  ])
  farmerId = await insertFarmerFor(ctv.partnerId)
  product = (await adminClient().from('products').select('id, list_price').order('sku').limit(1).single().throwOnError()).data
})
afterAll(async () => {
  await resetData()
  await adminClient().from('settings').delete().in('key', ['bank_info', 'notify_email', 'telegram_chat_id', 'zalo_link']).throwOnError()
  await adminClient().from('settings').upsert({ key: 'store_name', value: 'Cửa hàng vật tư' }).throwOnError()
})

describe('setOrderStatus / bulkSetStatus', () => {
  test('một đơn: hợp lệ ghi log kèm ghi chú và người đổi; sai sơ đồ → invalid_transition', async () => {
    const id = await orderInStatus('new')
    expect(await asUser(staff, () => setOrderStatus(id, 'confirmed', 'Đã gọi khách'))).toEqual({ ok: true })
    const { data: log } = await adminClient().from('order_status_log').select('to_status, changed_by, note')
      .eq('order_id', id).eq('to_status', 'confirmed').single().throwOnError()
    expect(log).toEqual({ to_status: 'confirmed', changed_by: staff.userId, note: 'Đã gọi khách' })
    expect(await asUser(staff, () => setOrderStatus(id, 'paid'))).toEqual({ error: 'invalid_transition' })
    expect(await status(id)).toBe('confirmed')
  })

  test('3 đơn, 1 đơn không hợp lệ: 2 thành công, 1 lỗi invalid_transition, không ảnh hưởng nhau', async () => {
    const a = await orderInStatus('new')
    const b = await orderInStatus('shipping')
    const c = await orderInStatus('new')
    const res = await asUser(staff, () => bulkSetStatus([a, b, c], 'confirmed'))
    expect(res.ok.sort()).toEqual([a, c].sort())
    expect(res.failed).toEqual([{ id: b, code: 'invalid_transition' }])
    expect([await status(a), await status(b), await status(c)]).toEqual(['confirmed', 'shipping', 'confirmed'])
  })

  test('lỗi bất ngờ ở một đơn → code error, các đơn sau vẫn được đổi', async () => {
    const a = await orderInStatus('new')
    const b = await orderInStatus('new')
    const c = await orderInStatus('new')
    failing.orderId = b
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const res = await asUser(staff, () => bulkSetStatus([a, b, c], 'confirmed'))
      expect(res.ok.sort()).toEqual([a, c].sort())
      expect(res.failed).toEqual([{ id: b, code: 'error' }])
      expect(logged).toHaveBeenCalled()
    } finally {
      failing.orderId = ''
      logged.mockRestore()
    }
    expect([await status(a), await status(b), await status(c)]).toEqual(['confirmed', 'new', 'confirmed'])
  })

  test('id không tồn tại / sai dạng → failed, không throw', async () => {
    const res = await asUser(staff, () => bulkSetStatus([crypto.randomUUID(), 'abc'], 'confirmed'))
    expect(res.ok).toEqual([])
    expect(res.failed.map((f) => f.code)).toEqual(['not_found', 'not_found'])
  })

  test('chưa đăng nhập / đối tác bị chặn', async () => {
    const id = await orderInStatus('new')
    expect(await redirectTarget(asUser(null, () => bulkSetStatus([id], 'confirmed')))).toBe('/dang-nhap')
    expect(await redirectTarget(asUser(ctv, () => setOrderStatus(id, 'confirmed')))).toBe('/')
    expect(await status(id)).toBe('new')
  })
})

describe('staffEditOrder', () => {
  const editLine = (o: Partial<{ productId: string; qty: number; farmerId: string | null; seenSalePrice: number }> = {}) =>
    ({ productId: product.id, qty: 2, farmerId, seenSalePrice: 0, ...o })

  test('đơn CTV đã xác nhận: tính lại theo bậc của CTV, ghi bởi staff', async () => {
    const id = await ctvOrder(0)
    await walk(id, 'confirmed')
    const changed = await asUser(staff, () => staffEditOrder(id, [editLine()], false))
    expect(changed.status).toBe('changed')
    const res = await asUser(staff, () => staffEditOrder(id, [editLine({ qty: 3 })], true))
    expect(res.status).toBe('ok')
    const { data: order } = await adminClient().from('orders').select('subtotal, total_qty, commission_expected, partner_payable')
      .eq('id', id).single().throwOnError()
    const { data: lines } = await adminClient().from('order_lines').select('qty, farmer_id, sale_price_snap, rate_pct_snap, line_commission')
      .eq('order_id', id).throwOnError()
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ qty: 3, farmer_id: farmerId })
    expect(order.total_qty).toBe(3)
    expect(order.subtotal).toBe(lines[0].sale_price_snap * 3)
    expect(order.partner_payable).toBeNull()
    expect(order.commission_expected).toBe(lines[0].line_commission)
    expect(order.commission_expected).toBe(Math.round(lines[0].sale_price_snap * 3 * Number(lines[0].rate_pct_snap) / 100))
  })

  test('nông dân không thuộc CTV của đơn → farmer_not_owned; đơn đang giao → not_editable', async () => {
    const id = await ctvOrder(0)
    const other = await insertFarmerFor(null)
    expect(await asUser(staff, () => staffEditOrder(id, [editLine({ farmerId: other })], true)))
      .toEqual({ status: 'error', error: 'farmer_not_owned' })
    expect(await asUser(staff, () => staffEditOrder(id, [editLine({ farmerId: null })], true)))
      .toEqual({ status: 'error', error: 'farmer_not_owned' })
    await walk(id, 'confirmed', 'shipping')
    expect(await asUser(staff, () => staffEditOrder(id, [editLine()], true))).toEqual({ status: 'error', error: 'not_editable' })
  })

  test('đơn đại lý: giá mua theo bậc đại lý; không được gắn nông dân', async () => {
    const { id } = await createOrderRpc({
      source: 'partner', partner_id: dealer.partnerId, retail_name: null, retail_phone: null, retail_address: null,
      delivery_address: 'Đại lý', partner_payable: product.list_price,
    })
    expect(await asUser(staff, () => staffEditOrder(id, [editLine({ farmerId })], true)))
      .toEqual({ status: 'error', error: 'farmer_not_owned' })
    expect((await asUser(staff, () => staffEditOrder(id, [editLine({ farmerId: null })], true))).status).toBe('ok')
    const { data: order } = await adminClient().from('orders').select('subtotal, partner_payable, commission_expected').eq('id', id).single().throwOnError()
    expect(order.partner_payable).not.toBeNull()
    expect(order.partner_payable!).toBeLessThanOrEqual(order.subtotal)
    expect(order.commission_expected).toBe(0)
  })

  test('đơn lẻ: mỗi dòng phải giữ nông dân của chính dòng đó', async () => {
    const [x, y] = [await insertFarmerFor(null), await insertFarmerFor(null)]
    const { data: two } = await adminClient().from('products').select('id, list_price').order('sku').limit(2).throwOnError()
    const { id } = await createOrderRpc({}, [
      await sampleLine({ farmer_id: x }),
      await sampleLine({ farmer_id: y, product_id: two[1].id, list_price_snap: two[1].list_price, sale_price_snap: two[1].list_price, line_total: two[1].list_price }),
    ])
    // Đổi chéo nông dân giữa hai dòng → từ chối dù cả hai đều có trong đơn.
    expect(await asUser(staff, () => staffEditOrder(id, [editLine({ farmerId: y }), editLine({ productId: two[1].id, farmerId: x })], true)))
      .toEqual({ status: 'error', error: 'farmer_not_owned' })
    expect((await asUser(staff, () => staffEditOrder(id, [editLine({ farmerId: x }), editLine({ productId: two[1].id, farmerId: y })], true))).status).toBe('ok')
  })

  test('đơn lẻ không gắn CTV: giá lẻ, giữ nông dân cũ của đơn', async () => {
    const retailFarmer = await insertFarmerFor(null)
    const { id } = await createOrderRpc({}, [await sampleLine({ farmer_id: retailFarmer })])
    expect(await asUser(staff, () => staffEditOrder(id, [editLine({ farmerId })], true)))
      .toEqual({ status: 'error', error: 'farmer_not_owned' })
    expect((await asUser(staff, () => staffEditOrder(id, [editLine({ farmerId: retailFarmer, qty: 4 })], true))).status).toBe('ok')
    const { data: order } = await adminClient().from('orders').select('total_qty, commission_expected, partner_payable').eq('id', id).single().throwOnError()
    expect(order).toEqual({ total_qty: 4, commission_expected: 0, partner_payable: null })
  })
})

describe('hoa hồng', () => {
  const period = vnPeriod(new Date())

  test('commissionReport: net = earned + reversed (đơn paid rồi returned → net 0)', async () => {
    const returned = await ctvOrder(30000)
    await walk(returned, 'confirmed', 'shipping', 'delivered', 'paid', 'returned')
    const kept = await ctvOrder(12000)
    await walk(kept, 'confirmed', 'shipping', 'delivered', 'paid')

    const report = await asUser(staff, () => commissionReport(period))
    const row = report.find((r) => r.partnerId === ctv.partnerId)!
    expect(row).toEqual({
      partnerId: ctv.partnerId, partnerName: `Đối tác ${ctv.phone}`, phone: ctv.phone,
      earned: 42000, reversed: -30000, net: 12000, pending: 12000, paid: 0,
    })
    expect(report.find((r) => r.partnerId === dealer.partnerId)).toBeUndefined()
    expect(await asUser(staff, () => commissionReport('2020-01'))).toEqual([])
    await expect(asUser(staff, () => commissionReport('2026-13'))).rejects.toThrow()
  })

  test('markCommissionsPaid: chỉ đổi dòng pending, giữ paid_at của dòng đã chi', async () => {
    const id = await ctvOrder(5000)
    await walk(id, 'confirmed', 'shipping', 'delivered', 'paid')
    const id2 = await ctvOrder(7000)
    await walk(id2, 'confirmed', 'shipping', 'delivered', 'paid')
    const entry = async (orderId: string) => (await adminClient().from('commission_entries').select('id, status, paid_at').eq('order_id', orderId).single().throwOnError()).data
    const e1 = await entry(id)
    const e2 = await entry(id2)

    expect(await asUser(admin, () => markCommissionsPaid([e1.id]))).toEqual({ updated: 1 })
    const paid1 = await entry(id)
    expect(paid1.status).toBe('paid')
    expect(paid1.paid_at).not.toBeNull()

    expect(await asUser(admin, () => markCommissionsPaid([e1.id, e2.id, 'khong-phai-uuid']))).toEqual({ updated: 1 })
    expect((await entry(id)).paid_at).toBe(paid1.paid_at)
    expect((await entry(id2)).status).toBe('paid')
  })

  test('nhân viên thường gọi markCommissionsPaid / exportCommissions bị chặn', async () => {
    const id = await ctvOrder(4000)
    await walk(id, 'confirmed', 'shipping', 'delivered', 'paid')
    const { data: e } = await adminClient().from('commission_entries').select('id').eq('order_id', id).single().throwOnError()
    expect(await redirectTarget(asUser(staff, () => markCommissionsPaid([e.id])))).toBe('/')
    expect(await redirectTarget(asUser(staff, () => exportCommissions(period)))).toBe('/')
    const { data: after } = await adminClient().from('commission_entries').select('status').eq('id', e.id).single().throwOnError()
    expect(after.status).toBe('pending')
  })

  test('exportCommissions: file có hàng của CTV khớp báo cáo', async () => {
    const report = await asUser(admin, () => commissionReport(period))
    const ws = (await load(await asUser(admin, () => exportCommissions(period)))).worksheets[0]
    const row = report.find((r) => r.partnerId === ctv.partnerId)!
    const found = ws.getRows(2, ws.rowCount - 1)!.find((r) => r.getCell(2).value === ctv.phone)!
    expect([3, 4, 5, 6, 7].map((c) => found.getCell(c).value)).toEqual([row.earned, row.reversed, row.net, row.pending, row.paid])
  })
})

describe('dashboardStats', () => {
  test('doanh số tháng theo thời điểm chuyển paid, bỏ đơn đã trả hàng; đơn chờ thu tiền; hoa hồng chờ chi', async () => {
    const before = await asUser(staff, () => dashboardStats())
    const paid = await ctvOrder(1000, 500000)
    await walk(paid, 'confirmed', 'shipping', 'delivered', 'paid')
    const returned = await ctvOrder(1000, 700000)
    await walk(returned, 'confirmed', 'shipping', 'delivered', 'paid', 'returned')
    const waiting = await ctvOrder(0)
    await walk(waiting, 'confirmed', 'shipping', 'delivered')
    await orderInStatus('new')

    const after = await asUser(staff, () => dashboardStats())
    expect(after.newToday - before.newToday).toBe(4)
    expect(after.awaitingPayment - before.awaitingPayment).toBe(1)
    expect(after.monthRevenue - before.monthRevenue).toBe(500000)
    expect(after.pendingCommission - before.pendingCommission).toBe(1000)
  })
})

describe('exportOrders / exportAll', () => {
  test('exportOrders: mỗi dòng đơn một hàng trong khoảng ngày; nhân viên thường được xuất', async () => {
    const id = await ctvOrder(2500)
    const { data: o } = await adminClient().from('orders').select('code').eq('id', id).single().throwOnError()
    const now = Date.now()
    const ws = (await load(await asUser(staff, () => exportOrders(new Date(now - 3600_000), new Date(now + 3600_000))))).worksheets[0]
    expect(ws.getRow(1).getCell(1).value).toBe('Mã đơn')
    const row = ws.getRows(2, ws.rowCount - 1)!.find((r) => r.getCell(1).value === o.code)!
    expect(row.getCell(3).value).toBe('Đối tác')
    expect(row.getCell(5).value).toBe(`Nông dân ${(await adminClient().from('farmers').select('phone').eq('id', farmerId).single()).data!.phone}`)
    expect(row.getCell(12).value).toBe(2500)
    const empty = (await load(await asUser(staff, () => exportOrders(new Date('2020-01-01'), new Date('2020-01-02'))))).worksheets[0]
    expect(empty.rowCount).toBe(1)
  })

  test('exportAll: chỉ admin; mỗi bảng chính một sheet', async () => {
    expect(await redirectTarget(asUser(staff, () => exportAll()))).toBe('/')
    const wb = await load(await asUser(admin, () => exportAll()))
    expect(wb.worksheets.length).toBeGreaterThanOrEqual(13)
    const orders = wb.getWorksheet('Đơn hàng')!
    expect(orders.rowCount).toBeGreaterThan(1)
  })
})

describe('saveSettings', () => {
  const full = {
    store_name: ' Đại lý Phân bón Hòa ', bank: 'Vietcombank', account: '0123456789', holder: 'NGUYEN VAN HOA',
    notify_email: 'chu@cuahang.vn', telegram_chat_id: '-100123', zalo_link: 'https://zalo.me/0905000000',
  }
  const value = async (key: string) => (await adminClient().from('settings').select('value').eq('key', key).maybeSingle().throwOnError()).data?.value

  test('lưu đúng dạng mà các nơi đọc đang dùng; ô trống → xóa khóa', async () => {
    expect(await asUser(admin, () => saveSettings(form(full)))).toEqual({ status: 'ok' })
    expect(await value('store_name')).toBe('Đại lý Phân bón Hòa')
    expect(await value('bank_info')).toEqual({ bank: 'Vietcombank', account: '0123456789', holder: 'NGUYEN VAN HOA' })
    expect(await value('notify_email')).toBe('chu@cuahang.vn')
    expect(await value('telegram_chat_id')).toBe('-100123')
    expect(await value('zalo_link')).toBe('https://zalo.me/0905000000')

    expect(await asUser(admin, () => saveSettings(form({ ...full, bank: '', account: '', holder: '', zalo_link: '', telegram_chat_id: '' })))).toEqual({ status: 'ok' })
    expect(await value('bank_info')).toBeUndefined()
    expect(await value('zalo_link')).toBeUndefined()
    expect(await value('telegram_chat_id')).toBeUndefined()
  })

  test('giá trị quá dài → invalid, không xóa/sửa giá trị đang lưu', async () => {
    expect(await asUser(admin, () => saveSettings(form(full)))).toEqual({ status: 'ok' })
    const res = await asUser(admin, () => saveSettings(form({ ...full, store_name: 'x'.repeat(121), holder: 'y'.repeat(121) })))
    expect(res).toEqual({ status: 'invalid', message: 'Tối đa 120 ký tự' })
    expect(await value('store_name')).toBe('Đại lý Phân bón Hòa')
    expect(await value('bank_info')).toEqual({ bank: 'Vietcombank', account: '0123456789', holder: 'NGUYEN VAN HOA' })
  })

  test('giữ khóa bank_info khác (vd branch); thay khóa cùng nghĩa kiểu cũ', async () => {
    await adminClient().from('settings').upsert({ key: 'bank_info', value: { bank_name: 'ACB', branch: 'CN Đắk Lắk' } }).throwOnError()
    expect(await asUser(admin, () => saveSettings(form(full)))).toEqual({ status: 'ok' })
    expect(await value('bank_info')).toEqual({ bank: 'Vietcombank', account: '0123456789', holder: 'NGUYEN VAN HOA', branch: 'CN Đắk Lắk' })
    expect(await asUser(admin, () => saveSettings(form({ ...full, bank: '', account: '', holder: '' })))).toEqual({ status: 'ok' })
    expect(await value('bank_info')).toBeUndefined()
  })

  test('từ chối email sai, link Zalo không phải http(s); nhân viên thường bị chặn', async () => {
    expect((await asUser(admin, () => saveSettings(form({ ...full, notify_email: 'khong-phai-email' })))).status).toBe('invalid')
    expect((await asUser(admin, () => saveSettings(form({ ...full, zalo_link: 'javascript:alert(1)' })))).status).toBe('invalid')
    expect(await redirectTarget(asUser(staff, () => saveSettings(form(full))))).toBe('/')
  })
})
