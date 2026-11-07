import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ProductForm, type ProductFormValues } from '@/components/admin/ProductForm'
import { requireStaff } from '@/lib/auth/guards'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'

export const metadata = { title: `Sửa sản phẩm — ${SITE_NAME}` }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function Editor({ params }: Pick<PageProps<'/admin/san-pham/[id]'>, 'params'>) {
  await requireStaff('admin')
  const { id } = await params
  const db = adminClient()
  const { data: categories } = await db.from('categories').select('id, name').order('sort_order').order('name').throwOnError()

  let initial: ProductFormValues = {
    sku: '', name: '', unit: '', categoryId: '', listPrice: 0, imageUrl: null, inStock: true, isActive: true, description: '',
    brand: '', shortDesc: '', composition: '', benefits: '', usage: '', crops: '', isFeatured: false,
  }
  if (id !== 'moi') {
    if (!UUID.test(id)) notFound()
    const { data } = await db.from('products').select('*').eq('id', id).maybeSingle().throwOnError()
    if (!data) notFound()
    initial = {
      id: data.id, sku: data.sku, name: data.name, unit: data.unit, categoryId: data.category_id,
      listPrice: Number(data.list_price), imageUrl: data.image_url, inStock: data.in_stock,
      isActive: data.is_active, description: data.description ?? '',
      brand: data.brand ?? '', shortDesc: data.short_desc ?? '', composition: data.composition ?? '',
      benefits: data.benefits ?? '', usage: data.usage ?? '', crops: (data.crops ?? []).join(', '), isFeatured: data.is_featured,
    }
  }
  return (
    <>
      <h1 className="text-2xl font-bold">{initial.id ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h1>
      <ProductForm initial={initial} categories={categories} />
    </>
  )
}

export default function ProductEditPage({ params }: PageProps<'/admin/san-pham/[id]'>) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <Editor params={params} />
      </Suspense>
    </main>
  )
}
