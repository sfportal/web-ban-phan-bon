import { ChevronRight, ShieldCheck, Truck } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AddToCartButton, PriceBlock } from '@/components/ProductCard'
import { ProductImage } from '@/components/ProductImage'
import { ProductGrid } from '@/components/shop/ProductGrid'
import { ProductTabs } from '@/components/shop/ProductTabs'
import { SectionHeader } from '@/components/ui'
import { categoryKey } from '@/lib/catalog/category-key'
import { getCatalog } from '@/lib/catalog/queries'
import { PRODUCT_ASSURANCE } from '@/lib/site-copy'
import { createServerClient } from '@/lib/supabase/server'

// Truy vấn dữ liệu theo từng yêu cầu và chặn render đến khi có kết quả, để sản phẩm
// ẩn/không tồn tại trả về HTTP 404 thật (không phải 200 đã stream).
export const instant = false

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function ProductPage({ params }: PageProps<'/san-pham/[id]'>) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const catalog = await getCatalog(createServerClient())
  // RLS chỉ cho phép đọc sản phẩm đang bán nên sản phẩm ẩn không có trong danh sách.
  const product = catalog.products.find((p) => p.id === id)
  if (!product) notFound()

  const now = new Date()
  const category = catalog.categories.find((c) => c.id === product.categoryId)
  const related = catalog.products.filter((p) => p.categoryId === product.categoryId && p.id !== product.id).slice(0, 4)

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 pb-12 pt-4 text-base md:gap-14 md:pb-16 md:pt-6">
      <nav aria-label="Đường dẫn" className="flex min-w-0 items-center gap-1 text-stone-600">
        <Link href="/" className="flex h-11 shrink-0 items-center font-semibold text-primary hover:underline">
          Tất cả sản phẩm
        </Link>
        {category && (
          <>
            <ChevronRight aria-hidden className="size-4 shrink-0" />
            <Link href={`/?nhom=${encodeURIComponent(categoryKey(category))}#san-pham`} className="flex h-11 min-w-0 items-center hover:text-primary">
              <span className="truncate">{category.name}</span>
            </Link>
          </>
        )}
      </nav>

      <div className="-mt-6 grid gap-6 md:-mt-8 md:grid-cols-2 md:gap-12">
        <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white md:sticky md:top-24 md:self-start">
          <ProductImage
            url={product.imageUrl}
            name={product.name}
            unit={product.unit}
            brand={product.brand}
            categorySlug={product.categorySlug}
            sizes="(min-width: 768px) 50vw, 100vw"
            priority
            className="aspect-square w-full"
          />
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            {product.brand && <p className="text-stone-600">{product.brand}</p>}
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink md:text-4xl">{product.name}</h1>
            <p className="text-stone-600">
              {product.unit} · Mã {product.sku}
            </p>
          </div>
          {product.shortDesc && <p className="max-w-prose text-lg leading-relaxed text-stone-800">{product.shortDesc}</p>}

          <div className="flex flex-col gap-1 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <PriceBlock product={product} promos={catalog.promos} now={now} size="lg" />
            <p className="text-sm text-stone-600">Giá bán lẻ cho 1 {product.unit}, đã gồm khuyến mãi đang áp dụng.</p>
            {!product.inStock && <p className="font-semibold text-red-700">Hết hàng</p>}
          </div>

          {/* Điện thoại: thanh giá + nút dính đáy màn hình; máy tính: nằm trong cột thông tin. */}
          <div data-bottom-bar="md" className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-stone-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
            <div className="min-w-0 flex-1 md:hidden">
              <p className="truncate text-sm text-stone-600">{product.unit}</p>
              <PriceBlock product={product} promos={catalog.promos} now={now} />
            </div>
            <AddToCartButton product={product} size="lg" className="shrink-0 md:w-full" />
          </div>

          <ul className="flex flex-col gap-2 text-stone-700">
            <li className="flex items-center gap-2.5">
              <Truck aria-hidden className="size-5 shrink-0 text-primary" />
              {PRODUCT_ASSURANCE.delivery}
            </li>
            <li className="flex items-center gap-2.5">
              <ShieldCheck aria-hidden className="size-5 shrink-0 text-primary" />
              {PRODUCT_ASSURANCE.info}
            </li>
          </ul>

          <ProductTabs product={product} />
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="cung-nhom" className="flex flex-col gap-4">
          <SectionHeader title={<span id="cung-nhom">Cùng nhóm</span>} subtitle={category?.name} />
          <ProductGrid products={related} promos={catalog.promos} now={now} />
        </section>
      )}
    </main>
  )
}
