import { Suspense } from 'react'
import { CategoryTiles } from '@/components/shop/CategoryTiles'
import { Hero } from '@/components/shop/Hero'
import { ProductGrid } from '@/components/shop/ProductGrid'
import { TrustStrip } from '@/components/shop/TrustStrip'
import { Storefront } from '@/components/Storefront'
import { SectionHeader } from '@/components/ui'
import { getCatalog } from '@/lib/catalog/queries'
import { createServerClient } from '@/lib/supabase/server'

async function Shop() {
  const catalog = await getCatalog(createServerClient())
  const featured = catalog.products.filter((p) => p.isFeatured && p.inStock).slice(0, 8)
  const counts: Record<string, number> = {}
  for (const p of catalog.products) counts[p.categoryId] = (counts[p.categoryId] ?? 0) + 1
  const now = new Date()
  return (
    <>
      <CategoryTiles categories={catalog.categories} counts={counts} />
      {featured.length > 0 && (
        <section aria-labelledby="noi-bat" className="flex flex-col gap-4">
          <SectionHeader title={<span id="noi-bat">Sản phẩm nổi bật</span>} subtitle="Mặt hàng cửa hàng giới thiệu" />
          <ProductGrid products={featured} promos={catalog.promos} now={now} rail />
        </section>
      )}
      <TrustStrip />
      <Storefront products={catalog.products} categories={catalog.categories} promos={catalog.promos} />
    </>
  )
}

function ShopSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className="h-7 w-40 rounded-lg bg-stone-200/70" />
      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="aspect-square rounded-2xl bg-stone-200/60" />)}
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col pb-16 text-base">
      <Hero />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pt-8 md:gap-16 md:pt-12">
        <Suspense fallback={<ShopSkeleton />}>
          <Shop />
        </Suspense>
      </div>
    </main>
  )
}
