import { randomUUID } from 'node:crypto'
import { after } from 'next/server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { submitPartnerOrder, submitRetailOrder } from '@/lib/orders/actions'
import { priceAndDiff, type SeenLine } from '@/lib/orders/submit'
import {
  adminClient, asUser, countOrders, createPartner, insertFarmerFor, randomPhone, redirectTarget, resetData,
  type TestPartner,
} from './helpers'

// P1: HC-VISINH 350.000đ, P2: HC-PHANBO 120.000đ — cùng nhóm "Phân hữu cơ"
// (CTV chuẩn 5%, Đại lý cấp 1 8%).
let P1: string
let P2: string
let ctv: TestPartner
let other: TestPartner
let dl: TestPartner
let F1: string
let F2: string
let FOther: string

const k = () => randomUUID()
const l = (productId: string, qty: number, farmerId: string | null, seenSalePrice: number): SeenLine => ({
  productId, qty, farmerId, seenSalePrice,
})
const r = (productId: string, qty: number, seenSalePrice: number) => ({ productId, qty, seenSalePrice })

async function productId(sku: string): Promise<string> {
  const { data } = await adminClient().from('products').select('id').eq('sku', sku).single().throwOnError()
  return data.id
}

async function order(res: { status: string } & Partial<{ orderId: string }>) {
  expect(res.status).toBe('ok')
  const { data } = await adminClient()
    .from('orders').select('*, order_lines(*), order_status_log(*)').eq('id', res.orderId!).single().throwOnError()
  return data
}

async function setProduct(id: string, patch: { in_stock?: boolean; is_active?: boolean; list_price?: number }) {
  await adminClient().from('products').update(patch).eq('id', id).throwOnError()
}

function retail(over: Partial<Parameters<typeof submitRetailOrder>[0]> = {}) {
  return {
    clientKey: k(), lines: [r(P1, 1, 350000)], name: 'Chị Lan', phone: randomPhone(),
    address: 'Krông Pắc, Đắk Lắk', paymentMethod: 'cod' as const, ...over,
  }
}

beforeAll(async () => {
  await resetData()
  P1 = await productId('HC-VISINH')
  P2 = await productId('HC-PHANBO')
  ctv = await createPartner({ kind: 'commission' })
  other = await createPartner({ kind: 'commission' })
  dl = await createPartner({ kind: 'wholesale' })
  F1 = await insertFarmerFor(ctv.partnerId)
  F2 = await insertFarmerFor(ctv.partnerId)
  FOther = await insertFarmerFor(other.partnerId)
})

beforeEach(() => {
  vi.mocked(after).mockClear()
})

afterEach(async () => {
  for (const id of [P1, P2]) await setProduct(id, { in_stock: true, is_active: true })
  await setProduct(P1, { list_price: 350000 })
  await setProduct(P2, { list_price: 120000 })
})

afterAll(async () => {
  await resetData()
})

describe('submitPartnerOrder', () => {
  test('CTV gửi đơn 2 nông dân, server tự tính hoa hồng', async () => {
    const res = await asUser(ctv, () =>
      submitPartnerOrder({
        clientKey: k(), lines: [l(P1, 3, F1, 350000), l(P2, 1, F2, 120000)], deliveryAddress: 'x', acceptChanges: false,
      }),
    )
    const o = await order(res)
    // 3×350.000×5% + 1×120.000×5% = 52.500 + 6.000
    expect(o).toMatchObject({
      source: 'partner', partner_id: ctv.partnerId, subtotal: 1170000, commission_expected: 58500,
      partner_payable: null, total_qty: 4, delivery_address: 'x', status: 'new',
    })
    expect(o.order_lines.map((x) => [x.product_id, x.farmer_id, x.qty, x.line_commission]).sort()).toEqual(
      [[P1, F1, 3, 52500], [P2, F2, 1, 6000]].sort(),
    )
    expect(o.order_status_log).toMatchObject([{ from_status: null, to_status: 'new', changed_by: ctv.userId }])
    expect(after).toHaveBeenCalledTimes(1)
  })

  test('giá trình duyệt gửi lên bị bỏ qua: giá đổi → changed', async () => {
    const res = await asUser(ctv, () =>
      submitPartnerOrder({ clientKey: k(), lines: [l(P1, 1, F1, 1)], deliveryAddress: 'x', acceptChanges: false }),
    )
    expect(res).toEqual({ status: 'changed', changes: [{ productId: P1, field: 'price', old: 1, new: 350000 }] })
    expect(after).not.toHaveBeenCalled()
  })

  test('acceptChanges=true thì tạo đơn theo giá server', async () => {
    const res = await asUser(ctv, () =>
      submitPartnerOrder({ clientKey: k(), lines: [l(P1, 2, F1, 1)], deliveryAddress: 'x', acceptChanges: true }),
    )
    const o = await order(res)
    expect(o.subtotal).toBe(700000)
    expect(o.order_lines).toMatchObject([{ sale_price_snap: 350000, list_price_snap: 350000, line_total: 700000 }])
  })

  test('sản phẩm hết hàng không gửi được kể cả khi acceptChanges', async () => {
    await setProduct(P2, { in_stock: false })
    const lines = [l(P1, 1, F1, 350000), l(P2, 1, F2, 120000)]
    const before = await countOrders()
    const a = await asUser(ctv, () => submitPartnerOrder({ clientKey: k(), lines, deliveryAddress: 'x', acceptChanges: false }))
    expect(a).toEqual({ status: 'changed', changes: [{ productId: P2, field: 'stock', old: true, new: false }] })
    const b = await asUser(ctv, () => submitPartnerOrder({ clientKey: k(), lines, deliveryAddress: 'x', acceptChanges: true }))
    expect(b).toEqual({ status: 'error', error: 'unavailable' })
    expect(await countOrders()).toBe(before)
  })

  test('sản phẩm bị ẩn → changed field inactive, kèm cả dòng đổi giá', async () => {
    await setProduct(P2, { is_active: false })
    const res = await asUser(ctv, () =>
      submitPartnerOrder({
        clientKey: k(), lines: [l(P1, 1, F1, 300000), l(P2, 1, F2, 120000)], deliveryAddress: 'x', acceptChanges: false,
      }),
    )
    expect(res).toEqual({
      status: 'changed',
      changes: [
        { productId: P1, field: 'price', old: 300000, new: 350000 },
        { productId: P2, field: 'inactive', old: false, new: true },
      ],
    })
  })

  test('gửi lại cùng clientKey ra cùng đơn', async () => {
    const input = { clientKey: k(), lines: [l(P1, 1, F1, 350000)], deliveryAddress: 'x', acceptChanges: false }
    const before = await countOrders()
    const a = await asUser(ctv, () => submitPartnerOrder(input))
    const b = await asUser(ctv, () => submitPartnerOrder(input))
    expect(a.status).toBe('ok')
    expect(b).toEqual(a)
    expect(await countOrders()).toBe(before + 1)
    // Giá đổi sau lần gửi đầu vẫn trả lại đơn cũ (không báo changed).
    await setProduct(P1, { list_price: 400000 })
    expect(await asUser(ctv, () => submitPartnerOrder(input))).toEqual(a)
  })

  test('clientKey của đơn đối tác khác không trả về đơn đó', async () => {
    const input = { clientKey: k(), lines: [l(P1, 1, F1, 350000)], deliveryAddress: 'x', acceptChanges: false }
    expect((await asUser(ctv, () => submitPartnerOrder(input))).status).toBe('ok')
    const stolen = await asUser(other, () =>
      submitPartnerOrder({ ...input, lines: [l(P1, 1, FOther, 350000)] }),
    )
    expect(stolen).toEqual({ status: 'error', error: 'missing_fields' })
  })

  test('farmerId của CTV khác → farmer_not_owned', async () => {
    const res = await asUser(ctv, () =>
      submitPartnerOrder({
        clientKey: k(), lines: [l(P1, 1, F1, 350000), l(P2, 1, FOther, 120000)], deliveryAddress: 'x', acceptChanges: false,
      }),
    )
    expect(res).toEqual({ status: 'error', error: 'farmer_not_owned' })
  })

  test('CTV thiếu farmerId → farmer_not_owned', async () => {
    const res = await asUser(ctv, () =>
      submitPartnerOrder({ clientKey: k(), lines: [l(P1, 1, null, 350000)], deliveryAddress: 'x', acceptChanges: false }),
    )
    expect(res).toEqual({ status: 'error', error: 'farmer_not_owned' })
  })

  test('đại lý: farmerId phải null; đơn tính giá đại lý', async () => {
    const bad = await asUser(dl, () =>
      submitPartnerOrder({ clientKey: k(), lines: [l(P1, 1, F1, 350000)], deliveryAddress: 'x', acceptChanges: false }),
    )
    expect(bad).toEqual({ status: 'error', error: 'farmer_not_owned' })

    const res = await asUser(dl, () =>
      submitPartnerOrder({
        clientKey: k(), lines: [l(P1, 2, null, 350000), l(P2, 1, null, 120000)], deliveryAddress: 'Kho A', acceptChanges: false,
      }),
    )
    const o = await order(res)
    // 8%: 350.000 → 322.000; 120.000 → 110.400
    expect(o).toMatchObject({
      source: 'partner', partner_id: dl.partnerId, subtotal: 820000, partner_payable: 2 * 322000 + 110400,
      commission_expected: 0,
    })
  })

  test('thiếu địa chỉ giao, đơn rỗng, số lượng sai', async () => {
    const base = { clientKey: k(), lines: [l(P1, 1, F1, 350000)], deliveryAddress: 'x', acceptChanges: false }
    expect(await asUser(ctv, () => submitPartnerOrder({ ...base, deliveryAddress: '  ' }))).toEqual({
      status: 'error', error: 'missing_fields',
    })
    expect(await asUser(ctv, () => submitPartnerOrder({ ...base, lines: [] }))).toEqual({
      status: 'error', error: 'empty_order',
    })
    for (const qty of [0, 1.5, -1]) {
      expect(await asUser(ctv, () => submitPartnerOrder({ ...base, lines: [l(P1, qty, F1, 350000)] }))).toEqual({
        status: 'error', error: 'invalid_qty',
      })
    }
    expect(await asUser(ctv, () => submitPartnerOrder({ ...base, clientKey: 'abc' }))).toEqual({
      status: 'error', error: 'missing_fields',
    })
  })

  test('sản phẩm không tồn tại → changed inactive', async () => {
    const ghost = randomUUID()
    const res = await asUser(ctv, () =>
      submitPartnerOrder({ clientKey: k(), lines: [l(ghost, 1, F1, 1000)], deliveryAddress: 'x', acceptChanges: false }),
    )
    expect(res).toEqual({ status: 'changed', changes: [{ productId: ghost, field: 'inactive', old: false, new: true }] })
  })

  test('chưa đăng nhập → chuyển tới /dang-nhap', async () => {
    const target = await redirectTarget(
      asUser(null, () =>
        submitPartnerOrder({ clientKey: k(), lines: [l(P1, 1, F1, 350000)], deliveryAddress: 'x', acceptChanges: false }),
      ),
    )
    expect(target).toBe('/dang-nhap')
  })
})

describe('submitRetailOrder', () => {
  test('SĐT mới → tạo nông dân không chủ, dòng hàng gắn nông dân đó', async () => {
    const input = retail({ phone: '+84 912 345 678', paymentMethod: 'transfer', note: 'Giao buổi sáng' })
    const res = await asUser(null, () => submitRetailOrder(input), { ip: '203.0.113.7, 10.0.0.1' })
    const o = await order(res)
    expect(o).toMatchObject({
      source: 'retail', partner_id: null, retail_name: 'Chị Lan', retail_phone: '0912345678',
      retail_address: 'Krông Pắc, Đắk Lắk', payment_method: 'transfer', note: 'Giao buổi sáng',
      subtotal: 350000, commission_expected: 0, partner_payable: null, client_ip: '203.0.113.7',
    })
    const { data: farmer } = await adminClient()
      .from('farmers').select('id, name, address, owner_partner_id').eq('phone', '0912345678').single().throwOnError()
    expect(farmer).toMatchObject({ name: 'Chị Lan', address: 'Krông Pắc, Đắk Lắk', owner_partner_id: null })
    expect(o.order_lines).toMatchObject([{ farmer_id: farmer.id, product_id: P1, qty: 1 }])
    expect(o.order_status_log).toMatchObject([{ to_status: 'new', changed_by: null }])
    expect(after).toHaveBeenCalledTimes(1)
  })

  test('SĐT đã có (không chủ) → dùng lại nông dân, không đổi tên', async () => {
    const phone = randomPhone()
    const farmerId = await insertFarmerFor(null, phone)
    const res = await asUser(null, () => submitRetailOrder(retail({ phone, name: 'Tên khác' })), { ip: '198.51.100.1' })
    const o = await order(res)
    expect(o.partner_id).toBeNull()
    expect(o.order_lines).toMatchObject([{ farmer_id: farmerId }])
    const { data } = await adminClient().from('farmers').select('name').eq('id', farmerId).single().throwOnError()
    expect(data.name).toBe(`Nông dân ${phone}`)
  })

  test('đơn lẻ có SĐT thuộc CTV → tính hoa hồng cho CTV đó', async () => {
    const phone = randomPhone()
    const farmerId = await insertFarmerFor(ctv.partnerId, phone)
    const res = await asUser(null, () =>
      submitRetailOrder(retail({ phone, lines: [r(P1, 2, 350000), r(P2, 1, 120000)] })),
      { ip: '198.51.100.2' },
    )
    const o = await order(res)
    expect(o).toMatchObject({
      source: 'retail', partner_id: ctv.partnerId, subtotal: 820000, commission_expected: 35000 + 6000,
      partner_payable: null,
    })
    expect(o.order_lines.every((x) => x.farmer_id === farmerId)).toBe(true)
  })

  test('đơn lẻ: giá đổi → changed; gửi lại với giá mới thì ok', async () => {
    const input = retail({ lines: [r(P1, 1, 300000)] })
    const a = await asUser(null, () => submitRetailOrder(input), { ip: '198.51.100.3' })
    expect(a).toEqual({ status: 'changed', changes: [{ productId: P1, field: 'price', old: 300000, new: 350000 }] })
    const b = await asUser(null, () => submitRetailOrder({ ...input, lines: [r(P1, 1, 350000)] }), { ip: '198.51.100.3' })
    expect(b.status).toBe('ok')
  })

  test('đơn lẻ lần thứ 4 trong 10 phút → rate_limited', async () => {
    const phone = randomPhone()
    for (let i = 0; i < 3; i++) {
      const ok = await asUser(null, () => submitRetailOrder(retail({ phone })), { ip: `192.0.2.${10 + i}` })
      expect(ok.status).toBe('ok')
    }
    const before = await countOrders()
    const res = await asUser(null, () => submitRetailOrder(retail({ phone })), { ip: '192.0.2.99' })
    expect(res).toEqual({ status: 'error', error: 'rate_limited' })
    expect(await countOrders()).toBe(before)
  })

  test('cùng IP, SĐT khác nhau: lần thứ 4 → rate_limited', async () => {
    for (let i = 0; i < 3; i++) {
      expect((await asUser(null, () => submitRetailOrder(retail()), { ip: '192.0.2.200' })).status).toBe('ok')
    }
    expect(await asUser(null, () => submitRetailOrder(retail()), { ip: '192.0.2.200' })).toEqual({
      status: 'error', error: 'rate_limited',
    })
  })

  test('gửi lại cùng clientKey (kể cả đã chạm giới hạn) ra cùng đơn', async () => {
    const phone = randomPhone()
    const input = retail({ phone })
    const a = await asUser(null, () => submitRetailOrder(input), { ip: '192.0.2.150' })
    for (let i = 0; i < 2; i++) await asUser(null, () => submitRetailOrder(retail({ phone })), { ip: '192.0.2.150' })
    expect(await asUser(null, () => submitRetailOrder(input), { ip: '192.0.2.150' })).toEqual(a)
  })

  test('honeypot có giá trị → không tạo đơn', async () => {
    const before = await countOrders()
    const res = await asUser(null, () => submitRetailOrder(retail({ honeypot: 'http://spam' })), { ip: '192.0.2.1' })
    expect(res.status).toBe('ok')
    expect(await countOrders()).toBe(before)
    expect(after).not.toHaveBeenCalled()
  })

  test('SĐT sai, thiếu tên/địa chỉ, phương thức thanh toán lạ', async () => {
    const ip = { ip: '192.0.2.2' }
    expect(await asUser(null, () => submitRetailOrder(retail({ phone: '12345' })), ip)).toEqual({
      status: 'error', error: 'invalid_phone',
    })
    expect(await asUser(null, () => submitRetailOrder(retail({ name: ' ' })), ip)).toEqual({
      status: 'error', error: 'missing_fields',
    })
    expect(await asUser(null, () => submitRetailOrder(retail({ address: '' })), ip)).toEqual({
      status: 'error', error: 'missing_fields',
    })
    expect(
      await asUser(null, () => submitRetailOrder({ ...retail(), paymentMethod: 'card' as unknown as 'cod' }), ip),
    ).toEqual({ status: 'error', error: 'missing_fields' })
  })
})

describe('priceAndDiff', () => {
  test('trả đơn đã tính khi giá khớp', async () => {
    const res = await priceAndDiff({ lines: [l(P1, 1, null, 350000)], tierId: null, acceptChanges: false })
    expect(res).toMatchObject({ status: 'ok', priced: { subtotal: 350000, commissionExpected: 0 } })
  })
})
