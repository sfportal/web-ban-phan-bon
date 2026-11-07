import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { CartView } from '@/components/CartView'
import { getCatalog } from '@/lib/catalog/queries'
import { salePrice } from '@/lib/pricing'
import { SITE_NAME } from '@/lib/site'
import { createServerClient } from '@/lib/supabase/server'
import { RetailForm } from './RetailForm'

export const metadata = { title: `Giỏ hàng — ${SITE_NAME}` }

async function Cart() {
  const { products, promos } = await getCatalog(createServerClient())
  // Giá bán tính theo đồng hồ server (không tin đồng hồ máy khách khi sát mốc khuyến mãi).
  const now = new Date()
  const prices = Object.fromEntries(products.map((p) => [p.id, salePrice(p, promos, now).price]))
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8">
      <CartView products={products} prices={prices} />
      <div className="lg:sticky lg:top-24">
        <RetailForm products={products} prices={prices} />
      </div>
    </div>
  )
}

export default function CartPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pb-12 pt-4 text-base md:pt-6 lg:pb-16">
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <h1 className="text-3xl font-bold tracking-tight text-ink">Giỏ hàng</h1>
        <Link href="/" className="flex h-11 items-center gap-1.5 font-semibold text-primary hover:underline">
          <ArrowLeft aria-hidden className="size-5" />
          Tiếp tục mua
        </Link>
      </div>
      <Suspense fallback={<p className="py-8 text-center text-stone-600">Đang tải giỏ hàng...</p>}>
        <Cart />
      </Suspense>
    </main>
  )
}
