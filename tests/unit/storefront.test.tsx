// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))

import { Storefront } from '@/components/Storefront'
import type { CatalogProduct } from '@/lib/catalog/queries'
import type { PromotionInput } from '@/lib/pricing'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const product: CatalogProduct = {
  id: 'p1', categoryId: 'c1', listPrice: 100_000, inStock: true, isActive: true,
  sku: 'SP-1', name: 'Phân thử', unit: 'bao', imageUrl: null, description: null,
  categoryName: 'Nhóm', categorySlug: 'npk', updatedPriceAt: new Date('2026-01-01T00:00:00Z'),
  brand: null, shortDesc: null, composition: null, benefits: null, usage: null, crops: [], isFeatured: false,
}
const serverNow = new Date('2026-11-07T03:00:00Z')
const promo: PromotionInput = {
  id: 'km', scope: 'product', targetId: 'p1', type: 'percent', value: 10,
  startsAt: new Date('2026-11-01T00:00:00Z'), endsAt: new Date('2026-12-01T00:00:00Z'), isActive: true,
}

describe('Storefront', () => {
  // Giá trên lưới phải theo giờ server (như HTML đã render sẵn), không theo đồng hồ máy khách:
  // lệch giờ thì React hydrate không khớp, vứt DOM server và có thể nuốt cú bấm đầu tiên.
  test('giá khuyến mãi tính theo `now` của server dù đồng hồ máy khách sai', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2020-01-01T00:00:00Z'))
    render(<Storefront products={[product]} categories={[]} promos={[promo]} now={serverNow} />)
    const grid = screen.getByRole('region', { name: 'Danh sách sản phẩm' })
    expect(within(grid).getByText('90.000 đ')).toBeTruthy()
    expect(within(grid).getByText('-10%')).toBeTruthy()
  })
})
