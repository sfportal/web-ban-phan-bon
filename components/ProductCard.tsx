'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useCart } from '@/lib/cart/use-cart'
import type { CatalogProduct } from '@/lib/catalog/queries'
import { salePrice, type PromotionInput } from '@/lib/pricing'
import { Money } from './Money'
import { ProductImage } from './ProductImage'

export function PriceBlock({ product, promos, now }: { product: CatalogProduct; promos: PromotionInput[]; now: Date }) {
  const { price } = salePrice(product, promos, now)
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <Money value={price} className="text-lg font-bold text-green-700" />
      {price < product.listPrice && (
        <Money value={product.listPrice} className="text-sm text-gray-500 line-through" />
      )}
    </div>
  )
}

export function AddToCartButton({ product, className = '' }: { product: CatalogProduct; className?: string }) {
  const { add } = useCart()
  const [added, setAdded] = useState(false)
  if (!product.inStock) {
    return (
      <button type="button" disabled className={`h-11 rounded-lg bg-gray-200 font-semibold text-gray-500 ${className}`}>
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
      className={`h-11 rounded-lg bg-green-700 font-semibold text-white ${className}`}
    >
      {added ? 'Đã thêm' : 'Thêm vào giỏ'}
    </button>
  )
}

export function ProductCard({ product, promos, now }: { product: CatalogProduct; promos: PromotionInput[]; now: Date }) {
  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-gray-200">
      <Link href={`/san-pham/${product.id}`} className="block">
        <div className="relative">
          <ProductImage url={product.imageUrl} name={product.name} className="aspect-square w-full" />
          {!product.inStock && (
            <span className="absolute left-2 top-2 rounded bg-gray-800 px-2 py-1 text-sm font-semibold text-white">
              Hết hàng
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1 p-3">
          <h3 className="text-base font-semibold">{product.name}</h3>
          <p className="text-sm text-gray-600">{product.unit}</p>
          <PriceBlock product={product} promos={promos} now={now} />
        </div>
      </Link>
      <div className="mt-auto p-3 pt-0">
        <AddToCartButton product={product} className="w-full" />
      </div>
    </li>
  )
}
