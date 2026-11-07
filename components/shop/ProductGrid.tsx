import { ProductCard } from '@/components/ProductCard'
import type { CatalogProduct } from '@/lib/catalog/queries'
import type { PromotionInput } from '@/lib/pricing'

/**
 * Lưới thẻ sản phẩm. `rail`: trên điện thoại là dải cuộn ngang (bắt dính từng thẻ),
 * từ md trở lên thành lưới 4 cột như thường.
 */
export function ProductGrid({ products, promos, now, rail = false, className = '' }: {
  products: CatalogProduct[]
  promos: PromotionInput[]
  now: Date
  rail?: boolean
  className?: string
}) {
  const layout = rail
    ? '-mx-4 flex snap-x scroll-px-4 md:scroll-px-0 snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 md:pb-0 [&>li]:w-[44vw] [&>li]:max-w-[220px] [&>li]:shrink-0 [&>li]:snap-start md:[&>li]:w-auto md:[&>li]:max-w-none'
    : 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4'
  return (
    <ul className={`${layout} ${className}`.trim()}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} promos={promos} now={now} />
      ))}
    </ul>
  )
}
