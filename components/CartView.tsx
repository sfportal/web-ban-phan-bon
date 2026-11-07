'use client'

import Link from 'next/link'
import { useMemo, useSyncExternalStore } from 'react'
import { useCart } from '@/lib/cart/use-cart'
import type { CatalogProduct } from '@/lib/catalog/queries'
import { salePrice, type PromotionInput } from '@/lib/pricing'
import { Money } from './Money'
import { ProductImage } from './ProductImage'
import { QtyStepper } from './QtyStepper'

const subscribeNoop = () => () => {}

/** Giỏ hàng: danh sách dòng, chỉnh số lượng, tổng tiền theo giá bán hiện tại. */
export function CartView({ products, promos }: { products: CatalogProduct[]; promos: PromotionInput[] }) {
  const { items, setQty, remove } = useCart()
  // Giỏ đọc từ localStorage chỉ có sau khi hydrate; tránh nháy "giỏ trống".
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const now = useMemo(() => new Date(), [])
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  if (!hydrated) return <p className="py-8 text-center text-gray-600">Đang tải giỏ hàng...</p>
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-gray-600">Giỏ hàng đang trống.</p>
        <Link href="/" className="flex h-11 items-center rounded-lg bg-green-700 px-5 font-semibold text-white">
          Xem sản phẩm
        </Link>
      </div>
    )
  }

  const rows = items.map(({ productId, qty }) => {
    const product = byId.get(productId)
    if (!product) return { productId, qty, product: null, unitPrice: 0, orderable: false }
    const unitPrice = salePrice(product, promos, now).price
    const orderable = product.inStock
    return { productId, qty, product, unitPrice, orderable }
  })
  const total = rows.reduce((sum, r) => (r.orderable ? sum + r.unitPrice * r.qty : sum), 0)

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {rows.map(({ productId, qty, product, unitPrice, orderable }) => (
          <li key={productId} className="flex gap-3 rounded-xl border border-gray-200 p-3">
            {product && <ProductImage url={product.imageUrl} name={product.name} className="h-20 w-20 shrink-0 rounded-lg" />}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {product ? (
                <>
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-sm text-gray-600">{product.unit}</p>
                  {orderable ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Money value={unitPrice} className="font-semibold text-green-700" />
                      <QtyStepper value={qty} onChange={(n) => setQty(productId, n)} label={`Số lượng ${product.name}`} />
                    </div>
                  ) : (
                    <p className="font-semibold text-red-700">Hết hàng — sẽ không tính vào đơn</p>
                  )}
                  {orderable && (
                    <p className="text-right">
                      Thành tiền: <Money value={unitPrice * qty} className="font-bold" />
                    </p>
                  )}
                </>
              ) : (
                <p className="font-semibold text-red-700">Sản phẩm không còn được bán</p>
              )}
              <button type="button" onClick={() => remove(productId)} className="h-11 self-start font-semibold text-red-700">
                Xóa
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t pt-4 text-lg">
        <span className="font-semibold">Tổng cộng</span>
        <Money value={total} className="text-xl font-bold text-green-700" />
      </div>
    </div>
  )
}
