import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { submitPartnerOrder } from '@/lib/orders/actions'
import { cancelMyOrder, editMyOrder } from '@/lib/orders/edit'
import type { SeenLine } from '@/lib/orders/submit'
import {
  adminClient, asUser, createPartner, insertFarmerFor, redirectTarget, resetData, toStatus, type TestPartner,
} from './helpers'

// P1: HC-VISINH 350.000đ, P2: HC-PHANBO 120.000đ — nhóm "Phân hữu cơ" (CTV chuẩn 5%, Đại lý cấp 1 8%).
let P1: string
let P2: string
let ctv: TestPartner
let other: TestPartner
let dl: TestPartner
let F1: string
let F2: string
let FOther: string

const l = (productId: string, qty: number, farmerId: string | null, seenSalePrice: number): SeenLine => ({
  productId, qty, farmerId, seenSalePrice,
})

async function productId(sku: string): Promise<string> {
  const { data } = await adminClient().from('products').select('id').eq('sku', sku).single().throwOnError()
  return data.id
}

async function newOrder(p: TestPartner, lines: SeenLine[]): Promise<string> {
  const res = await asUser(p, () =>
    submitPartnerOrder({ clientKey: randomUUID(), lines, deliveryAddress: 'BMT', acceptChanges: false }),
  )
  if (res.status !== 'ok') throw new Error(`không tạo được đơn: ${JSON.stringify(res)}`)
  return res.orderId
}

async function load(id: string) {
  const { data } = await adminClient()
    .from('orders').select('*, order_lines(*), order_status_log(*)').eq('id', id).single().throwOnError()
  return data
}

beforeAll(async () => {
  await resetData()
  P1 = await productId('HC-VISINH')
  P2 = await productId('HC-PHANBO')
  ;[ctv, other, dl] = await Promise.all([
    createPartner({ kind: 'commission' }),
    createPartner({ kind: 'commission' }),
    createPartner({ kind: 'wholesale' }),
  ])
  F1 = await insertFarmerFor(ctv.partnerId)
  F2 = await insertFarmerFor(ctv.partnerId)
  FOther = await insertFarmerFor(other.partnerId)
})

afterEach(async () => {
  await adminClient().from('products').update({ list_price: 350000 }).eq('id', P1).throwOnError()
})

afterAll(async () => {
  await resetData()
})

describe('cancelMyOrder', () => {
  test('đơn mới của mình → hủy, ghi log với người hủy', async () => {
    const id = await newOrder(ctv, [l(P1, 1, F1, 350000)])
    expect(await asUser(ctv, () => cancelMyOrder(id))).toEqual({ ok: true })
    const o = await load(id)
    expect(o.status).toBe('cancelled')
    expect(o.order_status_log).toContainEqual(
      expect.objectContaining({ from_status: 'new', to_status: 'cancelled', changed_by: ctv.userId }),
    )
  })

  test('đơn đã xác nhận → not_editable, không đổi', async () => {
    const id = await newOrder(ctv, [l(P1, 1, F1, 350000)])
    await toStatus(id, 'confirmed')
    expect(await asUser(ctv, () => cancelMyOrder(id))).toEqual({ error: 'not_editable' })
    expect((await load(id)).status).toBe('confirmed')
  })

  test('đơn của CTV khác, id lạ → not_editable', async () => {
    const id = await newOrder(ctv, [l(P1, 1, F1, 350000)])
    expect(await asUser(other, () => cancelMyOrder(id))).toEqual({ error: 'not_editable' })
    expect((await load(id)).status).toBe('new')
    expect(await asUser(ctv, () => cancelMyOrder(randomUUID()))).toEqual({ error: 'not_editable' })
    expect(await asUser(ctv, () => cancelMyOrder('khong-phai-uuid'))).toEqual({ error: 'not_editable' })
  })

  test('chưa đăng nhập → chuyển tới đăng nhập', async () => {
    const id = await newOrder(ctv, [l(P1, 1, F1, 350000)])
    expect(await redirectTarget(asUser(null, () => cancelMyOrder(id)))).toBe('/dang-nhap')
  })
})

describe('editMyOrder', () => {
  test('đơn của CTV khác bị chặn, dòng hàng giữ nguyên', async () => {
    const id = await newOrder(ctv, [l(P1, 1, F1, 350000)])
    const res = await asUser(other, () => editMyOrder(id, [l(P1, 5, FOther, 350000)], true))
    expect(res).toEqual({ status: 'error', error: 'not_editable' })
    const o = await load(id)
    expect(o.order_lines).toMatchObject([{ product_id: P1, qty: 1, farmer_id: F1 }])
    expect(o.subtotal).toBe(350000)
  })

  test('tính lại tổng và hoa hồng theo giá hiện tại; giá đổi thì báo changed trước', async () => {
    const id = await newOrder(ctv, [l(P1, 1, F1, 350000)])
    await adminClient().from('products').update({ list_price: 400000 }).eq('id', P1).throwOnError()
    const lines = [l(P1, 2, F1, 350000), l(P2, 3, F2, 120000)]

    const first = await asUser(ctv, () => editMyOrder(id, lines, false))
    expect(first).toEqual({ status: 'changed', changes: [{ productId: P1, field: 'price', old: 350000, new: 400000 }] })
    expect((await load(id)).subtotal).toBe(350000)

    const res = await asUser(ctv, () => editMyOrder(id, lines, true))
    const o = await load(id)
    expect(res).toEqual({ status: 'ok', orderId: id, code: o.code })
    // 2×400.000 + 3×120.000 = 1.160.000; hoa hồng 5%: 40.000 + 18.000
    expect(o).toMatchObject({
      status: 'new', subtotal: 1160000, commission_expected: 58000, partner_payable: null, total_qty: 5,
    })
    expect(o.order_lines.map((x) => [x.product_id, x.farmer_id, x.qty, x.sale_price_snap, x.line_commission]).sort())
      .toEqual([[P1, F1, 2, 400000, 40000], [P2, F2, 3, 120000, 18000]].sort())
  })

  test('đại lý sửa đơn: tính lại tiền phải trả', async () => {
    const id = await newOrder(dl, [l(P1, 1, null, 350000)])
    const res = await asUser(dl, () => editMyOrder(id, [l(P1, 2, null, 350000), l(P2, 1, null, 120000)], false))
    expect(res.status).toBe('ok')
    // 8%: 350.000 → 322.000; 120.000 → 110.400
    expect(await load(id)).toMatchObject({ subtotal: 820000, partner_payable: 2 * 322000 + 110400, commission_expected: 0 })
  })

  test('đơn đã xác nhận → not_editable', async () => {
    const id = await newOrder(ctv, [l(P1, 1, F1, 350000)])
    await toStatus(id, 'confirmed')
    expect(await asUser(ctv, () => editMyOrder(id, [l(P1, 2, F1, 350000)], true))).toEqual({
      status: 'error', error: 'not_editable',
    })
    expect((await load(id)).total_qty).toBe(1)
  })

  test('nông dân của CTV khác → farmer_not_owned; đơn rỗng → empty_order', async () => {
    const id = await newOrder(ctv, [l(P1, 1, F1, 350000)])
    expect(await asUser(ctv, () => editMyOrder(id, [l(P1, 1, FOther, 350000)], true))).toEqual({
      status: 'error', error: 'farmer_not_owned',
    })
    expect(await asUser(ctv, () => editMyOrder(id, [], true))).toEqual({ status: 'error', error: 'empty_order' })
    expect((await load(id)).order_lines).toHaveLength(1)
  })
})
