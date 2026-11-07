'use client'

import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Money } from '@/components/Money'
import { ProductImage } from '@/components/ProductImage'
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
    `h-11 shrink-0 whitespace-nowrap rounded-full border px-4 font-semibold transition-colors ${
      active ? 'border-primary bg-primary text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-primary/50'
    }`

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-stone-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm sản phẩm..."
          aria-label="Tìm sản phẩm"
          className="h-12 w-full rounded-xl border border-stone-300 bg-white pl-11 pr-3 text-base text-ink placeholder:text-stone-400"
        />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5" role="tablist" aria-label="Lọc sản phẩm">
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
        <p className="py-8 text-center text-stone-600">Không tìm thấy sản phẩm phù hợp.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {shown.map((p) => {
            const sale = salePrice(p, promos, now).price
            const rate = resolveRate(tier, p.id, p.categoryId)
            const qty = qtyOf(p.id)
            return (
              <li
                key={p.id}
                className={`flex gap-3 rounded-2xl border bg-white p-3 transition-colors ${qty > 0 ? 'border-primary/50 ring-1 ring-primary/20' : 'border-stone-200'}`}
              >
                <ProductImage
                  url={p.imageUrl}
                  name={p.name}
                  unit={p.unit}
                  brand={p.brand}
                  categorySlug={p.categorySlug}
                  sizes="72px"
                  className={`size-[72px] shrink-0 self-start overflow-hidden rounded-xl ring-1 ring-stone-200 ${p.inStock ? '' : 'opacity-50'}`}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="font-semibold leading-snug text-ink">{p.name}</span>
                    <span className="text-sm text-stone-600">{p.unit}</span>
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <Money value={sale} className="font-bold tabular-nums text-primary" />
                        {sale < p.listPrice && <Money value={p.listPrice} className="text-sm text-stone-500 line-through" />}
                      </span>
                      {tier.kind === 'commission' ? (
                        <span className="text-sm text-stone-700">HH: <Money value={Math.round((sale * rate) / 100)} />/đv</span>
                      ) : (
                        <span className="text-sm text-stone-700">Bạn trả: <Money value={Math.round(sale * (1 - rate / 100))} />/đv</span>
                      )}
                    </div>
                    {!p.inStock ? (
                      <span className="flex h-11 items-center font-semibold text-stone-500">Hết hàng</span>
                    ) : qty > 0 ? (
                      <QtyStepper value={qty} min={0} onChange={(n) => onQty(p.id, n)} label={`Số lượng ${p.name}`} />
                    ) : (
                      <button type="button" onClick={() => onQty(p.id, 1)}
                        className="h-11 rounded-xl border border-primary bg-white px-5 font-semibold text-primary transition-colors hover:bg-primary-soft">
                        + Thêm
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
