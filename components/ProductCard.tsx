'use client'

import { Check, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Badge, buttonClass, type ButtonSize } from '@/components/ui'
import { useCart } from '@/lib/cart/use-cart'
import type { CatalogProduct } from '@/lib/catalog/queries'
import { salePrice, type PromotionInput } from '@/lib/pricing'
import { Money } from './Money'
import { ProductImage } from './ProductImage'

/** Phần trăm giảm làm tròn; 0 khi không giảm. */
export function discountPct(listPrice: number, price: number): number {
  return price < listPrice ? Math.round((1 - price / listPrice) * 100) : 0
}

export function PriceBlock({ product, promos, now, size = 'md' }: { product: CatalogProduct; promos: PromotionInput[]; now: Date; size?: 'md' | 'lg' }) {
  const { price } = salePrice(product, promos, now)
  const pct = discountPct(product.listPrice, price)
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <Money value={price} className={`font-bold tabular-nums text-primary ${size === 'lg' ? 'text-3xl tracking-tight' : 'text-lg'}`} />
      {price < product.listPrice && (
        <>
          <Money value={product.listPrice} className={`tabular-nums text-stone-500 line-through ${size === 'lg' ? 'text-lg' : 'text-sm'}`} />
          {pct > 0 && <Badge tone="red">-{pct}%</Badge>}
        </>
      )}
    </div>
  )
}

export function AddToCartButton({ product, className = '', size = 'md', compact = false }: {
  product: CatalogProduct
  className?: string
  size?: ButtonSize
  /** Thẻ hẹp (lưới 2 cột điện thoại): bỏ icon để chữ nằm một dòng. */
  compact?: boolean
}) {
  const icon = `size-5 shrink-0 ${compact ? 'max-sm:hidden' : ''}`
  const { add } = useCart()
  const [added, setAdded] = useState(false)
  if (!product.inStock) {
    return (
      <button
        type="button"
        disabled
        className={`inline-flex items-center justify-center rounded-xl bg-stone-200 font-semibold text-stone-500 ${size === 'lg' ? 'h-[52px] px-6 text-lg' : 'h-11 px-5'} ${className}`}
      >
        Hết hàng
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={() => {
        add(product.id, 1)
        setAdded(true)
        setTimeout(() => setAdded(false), 1200)
      }}
      className={buttonClass({ size, className: `whitespace-nowrap ${className}` })}
    >
      {added ? <Check aria-hidden className={icon} /> : <ShoppingCart aria-hidden className={icon} />}
      {added ? 'Đã thêm' : 'Thêm vào giỏ'}
    </button>
  )
}

export function ProductCard({ product, promos, now }: { product: CatalogProduct; promos: PromotionInput[]; now: Date }) {
  return (
    <li className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(22,101,52,0.35)]">
      <Link href={`/san-pham/${product.id}`} className="flex flex-1 flex-col">
        <div className="relative bg-stone-50">
          <ProductImage url={product.imageUrl} name={product.name} unit={product.unit} brand={product.brand} categorySlug={product.categorySlug} className="aspect-square w-full" />
          {!product.inStock && (
            <span className="absolute left-2 top-2 rounded-lg bg-ink/85 px-2 py-1 text-sm font-semibold text-white">Hết hàng</span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          {product.brand && <p className="truncate text-sm text-stone-500">{product.brand}</p>}
          <h3 className="line-clamp-2 min-h-12 text-base font-semibold leading-6 text-ink group-hover:text-primary">{product.name}</h3>
          <p className="text-sm text-stone-600">{product.unit}</p>
          <div className="mt-auto pt-1">
            <PriceBlock product={product} promos={promos} now={now} />
          </div>
        </div>
      </Link>
      <div className="p-3 pt-0">
        <AddToCartButton product={product} compact className="w-full px-2" />
      </div>
    </li>
  )
}
