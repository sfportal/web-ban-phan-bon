'use client'

import { useMemo, useState } from 'react'
import type { CatalogProduct } from '@/lib/catalog/queries'
import type { PromotionInput } from '@/lib/pricing'
import { ProductCard } from './ProductCard'

function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
}

export function Storefront({
  products,
  categories,
  promos,
}: {
  products: CatalogProduct[]
  categories: { id: string; name: string }[]
  promos: PromotionInput[]
}) {
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const now = useMemo(() => new Date(), [])

  const shown = useMemo(() => {
    const q = normalize(query.trim())
    return products.filter(
      (p) => (!categoryId || p.categoryId === categoryId) && (!q || normalize(`${p.name} ${p.sku}`).includes(q)),
    )
  }, [products, categoryId, query])

  const tab = (active: boolean) =>
    `h-11 shrink-0 rounded-full px-4 font-semibold ${active ? 'bg-green-700 text-white' : 'bg-gray-100'}`

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm sản phẩm..."
        aria-label="Tìm sản phẩm"
        className="h-11 w-full rounded-lg border border-gray-300 px-3 text-base"
      />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Nhóm sản phẩm">
        <button type="button" role="tab" aria-selected={!categoryId} className={tab(!categoryId)} onClick={() => setCategoryId(null)}>
          Tất cả
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={categoryId === c.id}
            className={tab(categoryId === c.id)}
            onClick={() => setCategoryId(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="py-8 text-center text-gray-600">Không tìm thấy sản phẩm phù hợp.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} promos={promos} now={now} />
          ))}
        </ul>
      )}
    </div>
  )
}
