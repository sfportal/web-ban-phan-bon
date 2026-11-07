import { Suspense } from 'react'
import { CategoryManager } from '@/components/admin/CategoryManager'
import { requireStaff } from '@/lib/auth/guards'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'

export const metadata = { title: `Nhóm sản phẩm — ${SITE_NAME}` }

async function Categories() {
  const { role } = await requireStaff()
  const db = adminClient()
  const [{ data: cats }, { data: prods }] = await Promise.all([
    db.from('categories').select('id, name, sort_order').order('sort_order').order('name').throwOnError(),
    db.from('products').select('category_id').limit(100000).throwOnError(),
  ])
  const counts = new Map<string, number>()
  for (const p of prods) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1)
  return (
    <CategoryManager
      readOnly={role !== 'admin'}
      categories={cats.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sort_order, productCount: counts.get(c.id) ?? 0 }))}
    />
  )
}

export default function CategoriesPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Nhóm sản phẩm</h1>
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <Categories />
      </Suspense>
    </main>
  )
}
