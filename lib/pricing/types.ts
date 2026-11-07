export type PromotionInput = {
  id: string
  scope: 'product' | 'category'
  targetId: string
  type: 'percent' | 'fixed_price'
  value: number
  startsAt: Date
  endsAt: Date
  isActive: boolean
}

export type ProductInput = {
  id: string
  categoryId: string
  listPrice: number
  inStock: boolean
  isActive: boolean
}

export type TierInput = {
  kind: 'commission' | 'wholesale'
  byCategory: Record<string, number>
  byProduct: Record<string, number>
}

export type LineInput = { product: ProductInput; qty: number; farmerId: string | null }

export type PricedLine = {
  productId: string
  farmerId: string | null
  qty: number
  listPriceSnap: number
  salePriceSnap: number
  promotionIdSnap: string | null
  ratePctSnap: number
  lineTotal: number
  lineCommission: number
  linePartnerPrice: number | null
}

export type PricedOrder = {
  lines: PricedLine[]
  subtotal: number
  partnerPayable: number | null
  commissionExpected: number
}

export class PricingError extends Error {
  constructor(code: 'invalid_qty' | 'empty_order') {
    super(code)
    this.name = 'PricingError'
    Object.setPrototypeOf(this, PricingError.prototype)
  }
}
