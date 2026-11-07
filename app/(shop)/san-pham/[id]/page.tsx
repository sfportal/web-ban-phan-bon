import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FloatingActions } from '@/components/CartFab'
import { AddToCartButton, PriceBlock } from '@/components/ProductCard'
import { ProductImage } from '@/components/ProductImage'
import { getCatalog, getPublicSettings } from '@/lib/catalog/queries'
import { createServerClient } from '@/lib/supabase/server'

// Truy vấn dữ liệu theo từng yêu cầu và chặn render đến khi có kết quả, để sản phẩm
// ẩn/không tồn tại trả về HTTP 404 thật (không phải 200 đã stream).
export const instant = false

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function ProductPage({ params }: PageProps<'/san-pham/[id]'>) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const db = createServerClient()
  const [catalog, settings] = await Promise.all([getCatalog(db), getPublicSettings(db)])
  // RLS chỉ cho phép đọc sản phẩm đang bán nên sản phẩm ẩn không có trong danh sách.
  const product = catalog.products.find((p) => p.id === id)
  if (!product) notFound()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 pb-24 text-base">
      <Link href="/" className="flex h-11 items-center font-semibold text-green-700">
        ← Tất cả sản phẩm
      </Link>
      <ProductImage url={product.imageUrl} name={product.name} className="aspect-square w-full rounded-xl sm:aspect-video" />
      <p className="text-sm text-gray-600">{product.categoryName}</p>
      <h1 className="text-2xl font-bold">{product.name}</h1>
      <p className="text-gray-600">
        {product.unit} · Mã {product.sku}
      </p>
      <PriceBlock product={product} promos={catalog.promos} now={new Date()} />
      {!product.inStock && <p className="font-semibold text-red-700">Hết hàng</p>}
      {product.description && <p className="whitespace-pre-line">{product.description}</p>}
      <AddToCartButton product={product} className="w-full" />
      <FloatingActions zaloLink={settings.zaloLink} />
    </main>
  )
}
