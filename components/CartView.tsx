'use client'

import { ShoppingBag, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useSyncExternalStore } from 'react'
import { Button, EmptyState } from '@/components/ui'
import { useCart } from '@/lib/cart/use-cart'
import type { CatalogProduct } from '@/lib/catalog/queries'
import { Money } from './Money'
import { ProductImage } from './ProductImage'
import { QtyStepper } from './QtyStepper'

const subscribeNoop = () => () => {}

/** Giỏ hàng: danh sách dòng, chỉnh số lượng, tổng tiền theo giá bán server đã tính (`prices`). */
export function CartView({ products, prices }: { products: CatalogProduct[]; prices: Record<string, number> }) {
  const { items, setQty, remove } = useCart()
  // Giỏ đọc từ localStorage chỉ có sau khi hydrate; tránh nháy "giỏ trống".
  const hydrated = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  )
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  if (!hydrated) return <p className="py-8 text-center text-stone-600">Đang tải giỏ hàng...</p>
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="size-7" />}
        title="Giỏ hàng đang trống"
        description="Chọn phân bón, thuốc hay vật tư cần mua rồi bấm “Thêm vào giỏ”."
        action={<Button href="/">Xem sản phẩm</Button>}
        className="rounded-2xl border border-dashed border-stone-300 bg-white lg:col-span-2"
      />
    )
  }

  const rows = items.map(({ productId, qty }) => {
    const product = byId.get(productId)
    if (!product) return { productId, qty, product: null, unitPrice: 0, orderable: false }
    const unitPrice = prices[product.id] ?? product.listPrice
    const orderable = product.inStock
    return { productId, qty, product, unitPrice, orderable }
  })
  const total = rows.reduce((sum, r) => (r.orderable ? sum + r.unitPrice * r.qty : sum), 0)

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {rows.map(({ productId, qty, product, unitPrice, orderable }) => (
          <li key={productId} className="flex gap-3 p-3 sm:gap-4 sm:p-4">
            {product ? (
              <Link
                href={`/san-pham/${product.id}`}
                className="shrink-0 self-start overflow-hidden rounded-xl bg-stone-50 ring-1 ring-stone-200"
              >
                <ProductImage
                  url={product.imageUrl}
                  name={product.name}
                  unit={product.unit}
                  brand={product.brand}
                  categorySlug={product.categorySlug}
                  sizes="96px"
                  className="size-20 sm:size-24"
                />
              </Link>
            ) : (
              <div aria-hidden className="size-20 shrink-0 self-start rounded-xl bg-stone-100 sm:size-24" />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {product ? (
                <>
                  <div className="min-w-0">
                    {product.brand && <p className="truncate text-sm text-stone-500">{product.brand}</p>}
                    <p className="font-semibold leading-snug text-ink">{product.name}</p>
                    <p className="text-sm text-stone-600">
                      {product.unit}
                      {orderable && (
                        <>
                          {' '}
                          · <Money value={unitPrice} className="tabular-nums" />
                        </>
                      )}
                    </p>
                  </div>
                  {orderable ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <QtyStepper value={qty} onChange={(n) => setQty(productId, n)} label={`Số lượng ${product.name}`} />
                      <p className="text-right">
                        <span className="sr-only">Thành tiền: </span>
                        <Money value={unitPrice * qty} className="text-lg font-bold tabular-nums text-ink" />
                      </p>
                    </div>
                  ) : (
                    <p className="font-semibold text-red-700">Hết hàng — sẽ không tính vào đơn</p>
                  )}
                </>
              ) : (
                <p className="font-semibold text-red-700">Sản phẩm không còn được bán</p>
              )}
              <button
                type="button"
                onClick={() => remove(productId)}
                className="-ml-2 flex h-11 items-center gap-1.5 self-start rounded-lg px-2 font-semibold text-stone-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 aria-hidden className="size-4" />
                Xóa
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between rounded-2xl bg-primary-soft px-4 py-4 text-lg">
        <span className="font-semibold text-primary-hover">Tổng cộng</span>
        <Money value={total} className="text-2xl font-bold tabular-nums text-primary" />
      </div>
    </div>
  )
}
