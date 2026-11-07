import { Suspense } from 'react'
import { ProductRates } from '@/components/admin/ProductRates'
import { RateGrid } from '@/components/admin/RateGrid'
import { TierManager } from '@/components/admin/TierManager'
import { requireStaff } from '@/lib/auth/guards'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetch-all'

export const metadata = { title: `Bậc đối tác — ${SITE_NAME}` }

async function Tiers() {
  const { role } = await requireStaff()
  const readOnly = role !== 'admin'
  const db = adminClient()
  const [{ data: tiers }, { data: cats }, { data: rates }, { data: prodRates }, { data: products }, partners] = await Promise.all([
    db.from('partner_tiers').select('id, name, kind').order('name').throwOnError(),
    db.from('categories').select('id, name').order('sort_order').order('name').throwOnError(),
    db.from('tier_rates').select('tier_id, category_id, rate_pct').throwOnError(),
    db.from('tier_product_rates').select('tier_id, product_id, rate_pct').throwOnError(),
    db.from('products').select('id, name').order('name').throwOnError(),
    fetchAll((from, to) => db.from('partners').select('tier_id').order('id').range(from, to).throwOnError()),
  ])
  const counts = new Map<string, number>()
  for (const p of partners) if (p.tier_id) counts.set(p.tier_id, (counts.get(p.tier_id) ?? 0) + 1)
  const tierName = new Map(tiers.map((t) => [t.id, t.name]))
  const productName = new Map(products.map((p) => [p.id, p.name]))
  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">Bậc</h2>
        <TierManager readOnly={readOnly} tiers={tiers.map((t) => ({ ...t, partnerCount: counts.get(t.id) ?? 0 }))} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">Tỷ lệ theo nhóm</h2>
        <p className="text-sm text-gray-600">CTV: % hoa hồng. Đại lý: % chiết khấu so với giá niêm yết. Ô trống = chưa có mức.</p>
        <RateGrid
          readOnly={readOnly}
          tiers={tiers}
          categories={cats}
          rates={Object.fromEntries(rates.map((r) => [`${r.tier_id}|${r.category_id}`, String(Number(r.rate_pct))]))}
        />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">Mức riêng theo sản phẩm</h2>
        <ProductRates
          readOnly={readOnly}
          tiers={tiers}
          products={products}
          rows={prodRates
            .map((r) => ({ tierId: r.tier_id, tierName: tierName.get(r.tier_id) ?? '', productId: r.product_id, productName: productName.get(r.product_id) ?? '', rate: String(Number(r.rate_pct)) }))
            .sort((a, b) => a.productName.localeCompare(b.productName, 'vi') || a.tierName.localeCompare(b.tierName, 'vi'))}
        />
      </section>
    </>
  )
}

export default function TiersPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4">
      <h1 className="text-2xl font-bold">Bậc đối tác và tỷ lệ</h1>
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <Tiers />
      </Suspense>
    </main>
  )
}
