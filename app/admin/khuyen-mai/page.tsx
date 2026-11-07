import { Suspense } from 'react'
import { PromotionManager, type PromoRow } from '@/components/admin/PromotionManager'
import { requireStaff } from '@/lib/auth/guards'
import { vnDateInput } from '@/lib/format'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetch-all'

export const metadata = { title: `Khuyến mãi — ${SITE_NAME}` }

async function Promotions() {
  const { role } = await requireStaff()
  const db = adminClient()
  const now = new Date().getTime()
  const [{ data: promos }, { data: cats }, products] = await Promise.all([
    db.from('promotions').select('*').order('starts_at', { ascending: false }).throwOnError(),
    db.from('categories').select('id, name').order('sort_order').order('name').throwOnError(),
    fetchAll((from, to) => db.from('products').select('id, name, is_active').order('name').order('id').range(from, to).throwOnError()),
  ])
  const catName = new Map(cats.map((c) => [c.id, c.name]))
  const prod = new Map(products.map((p) => [p.id, p]))

  const rows: PromoRow[] = promos.map((p) => {
    let targetLabel: string
    if (p.scope === 'category') targetLabel = catName.get(p.target_id) ?? 'Nhóm đã xóa'
    else {
      const pr = prod.get(p.target_id)
      targetLabel = pr ? (pr.is_active ? pr.name : `${pr.name} (đã ẩn)`) : 'Sản phẩm đã xóa'
    }
    const start = new Date(p.starts_at).getTime(), end = new Date(p.ends_at).getTime()
    const statusLabel = !p.is_active ? 'Đang tắt' : now < start ? 'Sắp diễn ra' : now >= end ? 'Đã kết thúc' : 'Đang chạy'
    return {
      id: p.id, name: p.name, scope: p.scope, targetId: p.target_id, targetLabel, type: p.type, value: Number(p.value),
      startDate: vnDateInput(p.starts_at), endDate: vnDateInput(p.ends_at, 1), isActive: p.is_active, statusLabel,
    }
  })
  return (
    <PromotionManager
      readOnly={role !== 'admin'}
      promotions={rows}
      categories={cats}
      products={products.map((p) => ({ id: p.id, name: p.is_active ? p.name : `${p.name} (đã ẩn)` }))}
      today={vnDateInput(new Date())}
    />
  )
}

export default function PromotionsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Khuyến mãi</h1>
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <Promotions />
      </Suspense>
    </main>
  )
}
