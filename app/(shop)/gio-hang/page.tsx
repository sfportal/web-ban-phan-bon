import Link from 'next/link'
import { Suspense } from 'react'
import { CartView } from '@/components/CartView'
import { getCatalog } from '@/lib/catalog/queries'
import { SITE_NAME } from '@/lib/site'
import { createServerClient } from '@/lib/supabase/server'

export const metadata = { title: `Giỏ hàng — ${SITE_NAME}` }

async function Cart() {
  const { products, promos } = await getCatalog(createServerClient())
  return (
    <>
      <CartView products={products} promos={promos} />
      {/* Task 8: form đặt hàng bán lẻ (tên, SĐT, địa chỉ, ghi chú) đặt tại đây, dưới giỏ. */}
    </>
  )
}

export default function CartPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 pb-24 text-base">
      <Link href="/" className="flex h-11 items-center font-semibold text-green-700">
        ← Tiếp tục mua
      </Link>
      <h1 className="text-2xl font-bold">Giỏ hàng</h1>
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải giỏ hàng...</p>}>
        <Cart />
      </Suspense>
    </main>
  )
}
