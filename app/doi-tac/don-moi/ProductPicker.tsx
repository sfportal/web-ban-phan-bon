'use client'

import { useMemo, useState } from 'react'
import { Money } from '@/components/Money'
import { QtyStepper } from '@/components/QtyStepper'
import { normalize } from '@/components/Storefront'
import type { CatalogProduct } from '@/lib/catalog/queries'
import { resolveRate, salePrice, type PromotionInput, type TierInput } from '@/lib/pricing'

type Filter = { kind: 'frequent' } | { kind: 'all' } | { kind: 'category'; id: string }

/** Bước 2: chọn sản phẩm cho nhóm đang chọn. Giá ở đây chỉ để hiển thị; server tính lại. */
export function ProductPicker({
  products,
  categories,
  promos,
  tier,
  frequent,
  now,
  qtyOf,
  onQty,
}: {
  products: CatalogProduct[]
  categories: { id: string; name: string }[]
  promos: PromotionInput[]
  tier: TierInput
  frequent: string[]
  now: Date
  qtyOf: (productId: string) => number
  onQty: (productId: string, qty: number) => void
}) {
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const frequentProducts = useMemo(
    () => frequent.flatMap((id) => byId.get(id) ?? []),
    [frequent, byId],
  )
  const [filter, setFilter] = useState<Filter>(() =>
    frequentProducts.length > 0 ? { kind: 'frequent' } : { kind: 'all' },
  )
  const [query, setQuery] = useState('')

  const shown = useMemo(() => {
    const base =
      filter.kind === 'frequent'
        ? frequentProducts
        : filter.kind === 'category'
          ? products.filter((p) => p.categoryId === filter.id)
          : products
    const q = normalize(query.trim())
    return q ? base.filter((p) => normalize(`${p.name} ${p.sku}`).includes(q)) : base
  }, [filter, frequentProducts, products, query])

  const chip = (active: boolean) =>
    `h-11 shrink-0 rounded-full px-4 font-semibold ${active ? 'bg-green-700 text-white' : 'bg-gray-100'}`

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm sản phẩm..."
        aria-label="Tìm sản phẩm"
        className="h-12 w-full rounded-lg border border-gray-300 px-3 text-base"
      />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Lọc sản phẩm">
        {frequentProducts.length > 0 && (
          <button type="button" role="tab" aria-selected={filter.kind === 'frequent'} className={chip(filter.kind === 'frequent')}
            onClick={() => setFilter({ kind: 'frequent' })}>
            Hay đặt
          </button>
        )}
        <button type="button" role="tab" aria-selected={filter.kind === 'all'} className={chip(filter.kind === 'all')}
          onClick={() => setFilter({ kind: 'all' })}>
          Tất cả
        </button>
        {categories.map((c) => {
          const active = filter.kind === 'category' && filter.id === c.id
          return (
            <button key={c.id} type="button" role="tab" aria-selected={active} className={chip(active)}
              onClick={() => setFilter({ kind: 'category', id: c.id })}>
              {c.name}
            </button>
          )
        })}
      </div>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-gray-600">Không tìm thấy sản phẩm phù hợp.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border border-gray-200">
          {shown.map((p) => {
            const sale = salePrice(p, promos, now).price
            const rate = resolveRate(tier, p.id, p.categoryId)
            const qty = qtyOf(p.id)
            return (
              <li key={p.id} className="flex flex-col gap-2 p-3">
                <div className="flex flex-col">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-sm text-gray-600">{p.unit}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <Money value={sale} className="font-bold text-green-700" />
                      {sale < p.listPrice && <Money value={p.listPrice} className="text-sm text-gray-500 line-through" />}
                    </span>
                    {tier.kind === 'commission' ? (
                      <span className="text-sm text-gray-700">HH: <Money value={Math.round((sale * rate) / 100)} />/đv</span>
                    ) : (
                      <span className="text-sm text-gray-700">Bạn trả: <Money value={Math.round(sale * (1 - rate / 100))} />/đv</span>
                    )}
                  </div>
                  {!p.inStock ? (
                    <span className="font-semibold text-gray-500">Hết hàng</span>
                  ) : qty > 0 ? (
                    <QtyStepper value={qty} min={0} onChange={(n) => onQty(p.id, n)} label={`Số lượng ${p.name}`} />
                  ) : (
                    <button type="button" onClick={() => onQty(p.id, 1)}
                      className="h-11 rounded-lg border border-green-700 px-5 font-semibold text-green-700">
                      + Thêm
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
