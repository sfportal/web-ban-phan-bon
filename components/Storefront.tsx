'use client'

import { SearchX } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { Button, EmptyState, SectionHeader } from '@/components/ui'
import { categoryKey } from '@/lib/catalog/category-key'
import type { CatalogCategory, CatalogProduct } from '@/lib/catalog/queries'
import type { PromotionInput } from '@/lib/pricing'
import { ProductGrid } from './shop/ProductGrid'

/** Chuỗi so khớp tìm kiếm: bỏ dấu tiếng Việt, chữ thường. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
}

/** Ghi bộ lọc lên URL trang chủ (?nhom=&q=) mà không tải lại trang; useSearchParams tự cập nhật. */
export function replaceShopParams(patch: { nhom?: string | null; q?: string | null }) {
  const params = new URLSearchParams(window.location.search)
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    if (v) params.set(k, v)
    else params.delete(k)
  }
  const qs = params.toString()
  window.history.replaceState(null, '', `/${qs ? `?${qs}` : ''}${window.location.hash}`)
}

/** Lưới sản phẩm trang chủ: lọc theo nhóm (?nhom=) và từ khóa (?q=, ô tìm trên header). */
export function Storefront({
  products,
  categories,
  promos,
}: {
  products: CatalogProduct[]
  categories: CatalogCategory[]
  promos: PromotionInput[]
}) {
  const params = useSearchParams()
  const nhom = params.get('nhom')
  const query = params.get('q') ?? ''
  const category = categories.find((c) => categoryKey(c) === nhom) ?? null
  const now = useMemo(() => new Date(), [])

  const shown = useMemo(() => {
    const q = normalize(query.trim())
    return products.filter(
      (p) =>
        (!category || p.categoryId === category.id) &&
        (!q || normalize(`${p.name} ${p.sku} ${p.brand ?? ''}`).includes(q)),
    )
  }, [products, category, query])

  const chip = (active: boolean) =>
    `flex h-11 shrink-0 items-center rounded-full border px-4 font-semibold transition-colors ${
      active ? 'border-primary bg-primary text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-primary/40'
    }`

  const trimmed = query.trim()
  const subtitle = trimmed
    ? `${shown.length} kết quả cho “${trimmed}”`
    : `${shown.length} sản phẩm`

  return (
    <section id="san-pham" aria-label="Danh sách sản phẩm" className="flex scroll-mt-36 flex-col gap-4 md:scroll-mt-24">
      <SectionHeader title={category ? category.name : 'Tất cả sản phẩm'} subtitle={subtitle} />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Lọc theo nhóm">
        <button type="button" aria-pressed={!category} className={chip(!category)} onClick={() => replaceShopParams({ nhom: null })}>
          Tất cả
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={category?.id === c.id}
            className={chip(category?.id === c.id)}
            onClick={() => replaceShopParams({ nhom: categoryKey(c) })}
          >
            {c.name}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-7" />}
          title="Không tìm thấy sản phẩm phù hợp"
          description="Thử từ khóa ngắn hơn, ví dụ “urê” hay “NPK”, hoặc xem tất cả nhóm hàng."
          action={<Button variant="secondary" onClick={() => replaceShopParams({ nhom: null, q: null })}>Xem tất cả sản phẩm</Button>}
        />
      ) : (
        <ProductGrid products={shown} promos={promos} now={now} />
      )}
    </section>
  )
}
