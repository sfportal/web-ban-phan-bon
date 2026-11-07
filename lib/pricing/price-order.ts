import { resolveRate } from './rates'
import { salePrice } from './sale-price'
import { PricingError } from './types'
import type { LineInput, PricedLine, PricedOrder, PromotionInput, TierInput } from './types'

export function priceOrder(
  lines: LineInput[],
  promos: PromotionInput[],
  tier: TierInput | null,
  now: Date,
): PricedOrder {
  if (lines.length === 0) throw new PricingError('empty_order')

  let subtotal = 0
  let commissionExpected = 0
  let partnerPayable = 0
  const priced: PricedLine[] = lines.map(({ product, qty, farmerId }) => {
    if (!Number.isInteger(qty) || qty < 1) throw new PricingError('invalid_qty')
    const { price: sale, promotionId } = salePrice(product, promos, now)
    const rate = tier ? resolveRate(tier, product.id, product.categoryId) : 0
    const lineTotal = sale * qty
    const lineCommission = tier?.kind === 'commission' ? Math.round((sale * qty * rate) / 100) : 0
    const linePartnerPrice =
      tier?.kind === 'wholesale' ? Math.round(sale * (1 - rate / 100)) : null

    subtotal += lineTotal
    commissionExpected += lineCommission
    if (linePartnerPrice !== null) partnerPayable += linePartnerPrice * qty
    return {
      productId: product.id,
      farmerId,
      qty,
      listPriceSnap: product.listPrice,
      salePriceSnap: sale,
      promotionIdSnap: promotionId,
      ratePctSnap: rate,
      lineTotal,
      lineCommission,
      linePartnerPrice,
    }
  })

  return {
    lines: priced,
    subtotal,
    partnerPayable: tier?.kind === 'wholesale' ? partnerPayable : null,
    commissionExpected,
  }
}
