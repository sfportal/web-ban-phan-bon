import { describe, expect, test } from 'vitest'
import { PricingError, priceOrder, resolveRate, salePrice } from '@/lib/pricing'
import type { ProductInput, PromotionInput } from '@/lib/pricing'

const now = new Date('2026-11-10T03:00:00Z')
const P1: ProductInput = { id: 'P1', categoryId: 'NPK', listPrice: 350000, inStock: true, isActive: true }
let seq = 0
function promo(o: Partial<PromotionInput> = {}): PromotionInput {
  return {
    id: `promo-${++seq}`, scope: 'product', targetId: 'P1', type: 'percent', value: 10,
    startsAt: new Date('2026-11-01T00:00:00Z'), endsAt: new Date('2026-12-01T00:00:00Z'),
    isActive: true, ...o,
  }
}

describe('salePrice', () => {
  test('không khuyến mãi', () => expect(salePrice(P1, [], now)).toEqual({ price: 350000, promotionId: null }))
  test('giảm 10% theo nhóm', () => expect(salePrice(P1, [promo({ scope: 'category', targetId: 'NPK', type: 'percent', value: 10 })], now).price).toBe(315000))
  test('chọn khuyến mãi tốt nhất', () => {
    const r = salePrice(P1, [promo({ id: 'a', type: 'percent', value: 5 }), promo({ id: 'b', type: 'fixed_price', value: 300000 })], now)
    expect(r).toEqual({ price: 300000, promotionId: 'b' })
  })
  test('fixed_price cao hơn niêm yết bị kẹp, không tính là khuyến mãi', () =>
    expect(salePrice(P1, [promo({ type: 'fixed_price', value: 400000 })], now)).toEqual({ price: 350000, promotionId: null }))
  test('giảm 100% ra 0, không âm', () => expect(salePrice(P1, [promo({ type: 'percent', value: 100 })], now).price).toBe(0))
  test('hết hạn đúng tại endsAt (0h giờ VN)', () => {
    const p = promo({ type: 'percent', value: 10, endsAt: new Date('2026-11-10T17:00:00Z') })
    expect(salePrice(P1, [p], new Date('2026-11-10T16:59:59Z')).price).toBe(315000)
    expect(salePrice(P1, [p], new Date('2026-11-10T17:00:00Z')).price).toBe(350000)
  })
  test('fixed_price theo nhóm bị bỏ qua', () =>
    expect(salePrice(P1, [promo({ scope: 'category', targetId: 'NPK', type: 'fixed_price', value: 1 })], now).price).toBe(350000))
  test('bỏ qua khuyến mãi tắt, chưa bắt đầu hoặc sai đối tượng', () => {
    const ps = [
      promo({ isActive: false }),
      promo({ startsAt: new Date('2026-11-10T03:00:01Z') }),
      promo({ targetId: 'P2' }),
      promo({ scope: 'category', targetId: 'HC' }),
    ]
    expect(salePrice(P1, ps, now)).toEqual({ price: 350000, promotionId: null })
  })
  test('bắt đầu đúng tại startsAt thì có hiệu lực', () =>
    expect(salePrice(P1, [promo({ startsAt: now })], now).price).toBe(315000))
})

describe('resolveRate', () => {
  test('ưu tiên sản phẩm', () => {
    const t = { kind: 'commission', byCategory: { NPK: 5 }, byProduct: { P1: 7 } } as const
    expect(resolveRate(t, 'P1', 'NPK')).toBe(7)
    expect(resolveRate(t, 'P2', 'NPK')).toBe(5)
    expect(resolveRate(t, 'P3', 'HC')).toBe(0)
  })
  test('tỷ lệ sản phẩm bằng 0 vẫn được ưu tiên', () =>
    expect(resolveRate({ kind: 'commission', byCategory: { NPK: 5 }, byProduct: { P1: 0 } }, 'P1', 'NPK')).toBe(0))
})

describe('priceOrder', () => {
  test('CTV: hoa hồng 5% trên 3 bao', () => {
    const o = priceOrder([{ product: P1, qty: 3, farmerId: 'F1' }], [], { kind: 'commission', byCategory: { NPK: 5 }, byProduct: {} }, now)
    expect(o).toMatchObject({ subtotal: 1050000, commissionExpected: 52500, partnerPayable: null })
    expect(o.lines[0]).toMatchObject({ farmerId: 'F1', ratePctSnap: 5, linePartnerPrice: null })
  })
  test('Đại lý: chiết khấu 8% trên giá đã khuyến mãi', () => {
    const o = priceOrder([{ product: P1, qty: 2, farmerId: null }], [promo({ type: 'percent', value: 10 })], { kind: 'wholesale', byCategory: { NPK: 8 }, byProduct: {} }, now)
    expect(o.lines[0]).toMatchObject({ salePriceSnap: 315000, linePartnerPrice: 289800, lineCommission: 0 })
    expect(o).toMatchObject({ subtotal: 630000, partnerPayable: 579600, commissionExpected: 0 })
  })
  test('làm tròn hoa hồng', () =>
    expect(priceOrder([{ product: { ...P1, listPrice: 33333 }, qty: 1, farmerId: null }], [], { kind: 'commission', byCategory: { NPK: 2.5 }, byProduct: {} }, now).commissionExpected).toBe(833))
  test('đơn lẻ không chủ', () => {
    const o = priceOrder([{ product: P1, qty: 1, farmerId: null }], [], null, now)
    expect(o).toMatchObject({ commissionExpected: 0, partnerPayable: null })
    expect(o.lines[0]).toMatchObject({ ratePctSnap: 0, lineCommission: 0, linePartnerPrice: null })
  })
  test('snapshot giá niêm yết và khuyến mãi', () => {
    const o = priceOrder([{ product: P1, qty: 1, farmerId: null }], [promo({ id: 'z' })], null, now)
    expect(o.lines[0]).toMatchObject({ productId: 'P1', listPriceSnap: 350000, salePriceSnap: 315000, promotionIdSnap: 'z', lineTotal: 315000 })
  })
  test.each([0, -1, 1.5])('qty %s không hợp lệ', (q) =>
    expect(() => priceOrder([{ product: P1, qty: q, farmerId: null }], [], null, now)).toThrow(PricingError))
  test('qty không hợp lệ có mã invalid_qty', () =>
    expect(() => priceOrder([{ product: P1, qty: 0, farmerId: null }], [], null, now)).toThrow('invalid_qty'))
  test('đơn rỗng', () => expect(() => priceOrder([], [], null, now)).toThrow('empty_order'))
})
