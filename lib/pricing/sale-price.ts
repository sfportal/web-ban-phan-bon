import type { ProductInput, PromotionInput } from './types'

function isEffective(p: PromotionInput, now: Date): boolean {
  return p.isActive && p.startsAt.getTime() <= now.getTime() && now.getTime() < p.endsAt.getTime()
}

function appliesTo(p: PromotionInput, product: ProductInput): boolean {
  return (
    (p.scope === 'product' && p.targetId === product.id) ||
    (p.scope === 'category' && p.targetId === product.categoryId)
  )
}

export function salePrice(
  p: ProductInput,
  promos: PromotionInput[],
  now: Date,
): { price: number; promotionId: string | null } {
  let best = p.listPrice
  let bestId: string | null = null
  for (const promo of promos) {
    if (!isEffective(promo, now) || !appliesTo(promo, p)) continue
    if (promo.type === 'fixed_price' && promo.scope === 'category') continue
    const raw =
      promo.type === 'percent' ? Math.round(p.listPrice * (1 - promo.value / 100)) : promo.value
    const price = Math.min(Math.max(raw, 0), p.listPrice)
    if (price < best) {
      best = price
      bestId = promo.id
    }
  }
  return { price: best, promotionId: bestId }
}
