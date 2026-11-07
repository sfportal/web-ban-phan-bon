import { Suspense } from 'react'
import { AdminMain, Loading, PageHeader } from '@/components/admin/AdminPage'
import { CategoryManager } from '@/components/admin/CategoryManager'
import { requireStaff } from '@/lib/auth/guards'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetch-all'

export const metadata = { title: `Nhóm sản phẩm — ${SITE_NAME}` }

async function Categories() {
  const { role } = await requireStaff()
  const db = adminClient()
  const [{ data: cats }, prods] = await Promise.all([
    db.from('categories').select('id, name, sort_order, image_url').order('sort_order').order('name').throwOnError(),
    fetchAll((from, to) => db.from('products').select('category_id').order('id').range(from, to).throwOnError()),
  ])
  const counts = new Map<string, number>()
  for (const p of prods) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1)
  return (
    <CategoryManager
      readOnly={role !== 'admin'}
      categories={cats.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sort_order, imageUrl: c.image_url, productCount: counts.get(c.id) ?? 0 }))}
    />
  )
}

export default function CategoriesPage() {
  return (
    <AdminMain width="narrow">
      <PageHeader title="Nhóm sản phẩm" subtitle="Nhóm hiện thành ô có ảnh trên trang chủ cửa hàng, theo thứ tự bên dưới." />
      <Suspense fallback={<Loading />}>
        <Categories />
      </Suspense>
    </AdminMain>
  )
}
