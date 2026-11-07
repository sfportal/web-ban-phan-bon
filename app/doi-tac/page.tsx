import Link from 'next/link'
import { Suspense } from 'react'
import { Money } from '@/components/Money'
import { SharePriceButton } from '@/components/SharePriceButton'
import { requirePartner } from '@/lib/auth/guards'
import { getCatalog } from '@/lib/catalog/queries'
import { formatDate, formatVnd, vnDayStart } from '@/lib/format'
import { salePrice } from '@/lib/pricing'
import { SITE_NAME } from '@/lib/site'
import { createServerClient } from '@/lib/supabase/server'
import { ORDER_SUMMARY_COLUMNS, OrderList, type OrderSummary } from './don-hang/OrderList'

export const metadata = { title: `Đối tác — ${SITE_NAME}` }

/** "Đổi giá gần đây": 14 ngày theo lịch giờ VN, tính cả hôm nay. */
const RECENT_DAYS = 14

async function Home() {
  const session = await requirePartner()
  const db = createServerClient()
  const now = new Date()
  const [catalog, promoRows, orders] = await Promise.all([
    getCatalog(db),
    db.from('promotions').select('id, name, scope, target_id, type, value, ends_at')
      .eq('is_active', true).lte('starts_at', now.toISOString()).gt('ends_at', now.toISOString())
      .order('ends_at').throwOnError(),
    db.from('orders').select(ORDER_SUMMARY_COLUMNS).eq('partner_id', session.partnerId)
      .order('created_at', { ascending: false }).limit(5).throwOnError(),
  ])

  const productName = new Map(catalog.products.map((p) => [p.id, p.name]))
  const categoryName = new Map(catalog.categories.map((c) => [c.id, c.name]))
  const promos = promoRows.data.flatMap((p) => {
    const target = p.scope === 'product' ? productName.get(p.target_id) : categoryName.get(p.target_id)
    if (!target) return [] // sản phẩm đã ẩn
    const value = Number(p.value)
    const offer = p.type === 'percent' ? `Giảm ${value.toLocaleString('vi-VN')}%` : `Giá còn ${formatVnd(value)}`
    return [{ id: p.id, name: p.name, target, offer, endsAt: p.ends_at }]
  })

  const since = vnDayStart(RECENT_DAYS - 1, now)
  const repriced = catalog.products
    .filter((p) => p.updatedPriceAt >= since)
    .sort((a, b) => b.updatedPriceAt.getTime() - a.updatedPriceAt.getTime())

  return (
    <>
      <Link
        href="/doi-tac/don-moi"
        className="flex h-16 items-center justify-center rounded-xl bg-green-700 text-xl font-bold text-white"
      >
        + Đơn mới
      </Link>

      {promos.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl bg-amber-50 p-4">
          <h2 className="text-lg font-bold text-amber-900">Khuyến mãi đang chạy</h2>
          <ul className="flex flex-col gap-2">
            {promos.map((p) => (
              <li key={p.id}>
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-gray-700">
                  {p.target}: {p.offer} · đến {formatDate(p.endsAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Đổi giá gần đây</h2>
        {repriced.length === 0 ? (
          <p className="text-gray-600">Không có sản phẩm đổi giá trong {RECENT_DAYS} ngày qua.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border border-gray-200">
            {repriced.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-3">
                <span className="min-w-0">
                  <span className="block font-semibold">{p.name}</span>
                  <span className="text-sm text-gray-600">{p.unit} · {formatDate(p.updatedPriceAt)}</span>
                </span>
                <Money value={salePrice(p, catalog.promos, now).price} className="shrink-0 font-semibold" />
              </li>
            ))}
          </ul>
        )}
        <SharePriceButton />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Đơn gần đây</h2>
          <Link href="/doi-tac/don-hang" className="flex h-11 items-center font-semibold text-green-800">Xem tất cả</Link>
        </div>
        {orders.data.length === 0 ? (
          <p className="text-gray-600">Chưa có đơn nào.</p>
        ) : (
          <OrderList orders={orders.data as OrderSummary[]} kind={session.kind} />
        )}
      </section>
    </>
  )
}

export default function PartnerHome() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 p-4 text-base">
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <Home />
      </Suspense>
    </main>
  )
}
