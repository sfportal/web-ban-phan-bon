import type { TierInput } from './types'

export function resolveRate(tier: TierInput, productId: string, categoryId: string): number {
  return tier.byProduct[productId] ?? tier.byCategory[categoryId] ?? 0
}
