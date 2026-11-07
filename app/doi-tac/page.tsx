import { BadgePercent, ChevronDown, ClipboardList, PiggyBank, SquarePlus, Tag, Wallet } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { Money } from '@/components/Money'
import { SharePriceButton } from '@/components/SharePriceButton'
import { Card, EmptyState, SectionHeader, StatCard } from '@/components/ui'
import { requirePartner, type PartnerSession } from '@/lib/auth/guards'
import { getCatalog, type CatalogProduct } from '@/lib/catalog/queries'
import { formatDate, formatVnd, vnDateStart, vnDayStart, vnPeriod } from '@/lib/format'
import { salePrice, type PromotionInput } from '@/lib/pricing'
import { SITE_NAME } from '@/lib/site'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { createServerClient } from '@/lib/supabase/server'
import { ORDER_SUMMARY_COLUMNS, OrderList, type OrderSummary } from './don-hang/OrderList'

export const metadata = { title: `Đối tác — ${SITE_NAME}` }

/** "Đổi giá gần đây": 14 ngày theo lịch giờ VN, tính cả hôm nay. */
const RECENT_DAYS = 14
/** Số dòng đổi giá hiện sẵn; phần còn lại mở bằng "Xem thêm". */
const REPRICED_SHOWN = 5
/** Đơn còn đang được cửa hàng xử lý (chưa giao xong). */
const PROCESSING = ['new', 'confirmed', 'shipping'] as const

type Db = ReturnType<typeof createServerClient>

/**
 * Số liệu cho thẻ tổng quan, chỉ đọc (RLS + lọc partner_id). Tháng = tháng hiện tại giờ VN.
 * CTV: hoa hồng ghi nhận trong kỳ này (giống trang Hoa hồng), số nông dân.
 * Đại lý: tiết kiệm và số đơn đặt trong tháng (bỏ đơn hủy / trả hàng, giống trang Tiết kiệm).
 */
async function partnerStats(db: Db, session: PartnerSession, now: Date) {
  const period = vnPeriod(now)
  const monthStart = vnDateStart(`${period}-01`)!.toISOString()
  const processing = db.from('orders').select('id', { count: 'exact', head: true })
    .eq('partner_id', session.partnerId).in('status', PROCESSING).throwOnError()

  if (session.kind === 'commission') {
    const [entries, { count: open }, { count: farmers }] = await Promise.all([
      fetchAll((from, to) =>
        db.from('commission_entries').select('amount').eq('partner_id', session.partnerId).eq('period', period)
          .order('id').range(from, to).throwOnError(),
      ),
      processing,
      db.from('farmers').select('id', { count: 'exact', head: true }).eq('owner_partner_id', session.partnerId).throwOnError(),
    ])
    return {
      kind: 'commission' as const,
      commission: entries.reduce((s, e) => s + Number(e.amount), 0),
      open: open ?? 0,
      farmers: farmers ?? 0,
    }
  }

  const [monthOrders, { count: open }] = await Promise.all([
    fetchAll((from, to) =>
      db.from('orders').select('subtotal, partner_payable').eq('partner_id', session.partnerId)
        .gte('created_at', monthStart).not('status', 'in', '(cancelled,returned)')
        .order('id').range(from, to).throwOnError(),
    ),
    processing,
  ])
  return {
    kind: 'wholesale' as const,
    saved: monthOrders.reduce(
      (s, o) => s + (o.partner_payable === null ? 0 : Number(o.subtotal) - Number(o.partner_payable)), 0,
    ),
    open: open ?? 0,
    monthOrders: monthOrders.length,
  }
}

function Stats({ stats, monthLabel }: { stats: Awaited<ReturnType<typeof partnerStats>>; monthLabel: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {stats.kind === 'commission' ? (
        <>
          <StatCard
            className="col-span-2 md:col-span-1"
            label="Hoa hồng tháng này"
            value={<Money value={stats.commission} />}
            hint={monthLabel}
            icon={<Wallet className="size-5" />}
          />
          <StatCard label="Đơn đang xử lý" value={stats.open} />
          <StatCard label="Nông dân" value={stats.farmers} />
        </>
      ) : (
        <>
          <StatCard
            className="col-span-2 md:col-span-1"
            label="Tiết kiệm tháng này"
            value={<Money value={stats.saved} />}
            hint={monthLabel}
            icon={<PiggyBank className="size-5" />}
          />
          <StatCard label="Đơn đang xử lý" value={stats.open} />
          <StatCard label="Đơn tháng này" value={stats.monthOrders} />
        </>
      )}
    </div>
  )
}

function RepricedList({ items, promos, now }: { items: CatalogProduct[]; promos: PromotionInput[]; now: Date }) {
  return (
    <ul className="flex flex-col divide-y divide-stone-100">
      {items.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="min-w-0">
            <span className="block font-semibold text-ink">{p.name}</span>
            <span className="text-sm text-stone-600">{p.unit}, đổi ngày {formatDate(p.updatedPriceAt)}</span>
          </span>
          <Money value={salePrice(p, promos, now).price} className="shrink-0 font-bold tabular-nums text-primary" />
        </li>
      ))}
    </ul>
  )
}

async function Home() {
  const session = await requirePartner()
  const db = createServerClient()
  const now = new Date()
  const [catalog, promoRows, orders, stats] = await Promise.all([
    getCatalog(db),
    db.from('promotions').select('id, name, scope, target_id, type, value, ends_at')
      .eq('is_active', true).lte('starts_at', now.toISOString()).gt('ends_at', now.toISOString())
      .order('ends_at').throwOnError(),
    db.from('orders').select(ORDER_SUMMARY_COLUMNS).eq('partner_id', session.partnerId)
      .order('created_at', { ascending: false }).limit(5).throwOnError(),
    partnerStats(db, session, now),
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
  const [y, m] = vnPeriod(now).split('-')

  return (
    <>
      <Stats stats={stats} monthLabel={`Tháng ${m}/${y}`} />

      <Link
        href="/doi-tac/don-moi"
        className="flex h-16 items-center justify-center gap-2.5 rounded-2xl bg-accent text-xl font-bold text-ink shadow-[0_6px_20px_-8px_rgba(202,138,4,0.7)] transition-colors hover:bg-yellow-500"
      >
        <SquarePlus aria-hidden className="size-6" />
        Lên đơn mới
      </Link>

      {promos.length > 0 && (
        <section aria-labelledby="promos" className="flex flex-col gap-3">
          <SectionHeader title={<span id="promos">Khuyến mãi đang chạy</span>} />
          <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
            {promos.map((p) => (
              <li
                key={p.id}
                className="flex w-[78%] max-w-xs shrink-0 snap-start flex-col gap-2 rounded-2xl border border-accent/30 bg-accent-soft p-4"
              >
                <span className="flex items-center gap-2 font-bold text-yellow-900">
                  <BadgePercent aria-hidden className="size-5 shrink-0" />
                  {p.offer}
                </span>
                <span className="font-semibold text-ink">{p.name}</span>
                <span className="text-sm text-stone-700">Áp dụng: {p.target}</span>
                <span className="mt-auto text-sm text-stone-600">Đến {formatDate(p.endsAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="recent-orders" className="flex flex-col gap-3">
        <SectionHeader
          title={<span id="recent-orders">Đơn gần đây</span>}
          action={
            <Link href="/doi-tac/don-hang" prefetch={false} className="flex h-11 items-center font-semibold text-primary">
              Xem tất cả
            </Link>
          }
        />
        {orders.data.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ClipboardList className="size-7" />}
              title="Chưa có đơn nào"
              description="Đơn bạn gửi sẽ hiện ở đây kèm trạng thái giao hàng."
            />
          </Card>
        ) : (
          <OrderList orders={orders.data as OrderSummary[]} kind={session.kind} />
        )}
      </section>
      <section aria-labelledby="repriced" className="flex flex-col gap-3">
        <SectionHeader title={<span id="repriced">Đổi giá gần đây</span>} subtitle={`${RECENT_DAYS} ngày qua`} />
        {repriced.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Tag className="size-7" />}
              title="Giá ổn định"
              description={`Không có sản phẩm đổi giá trong ${RECENT_DAYS} ngày qua.`}
            />
          </Card>
        ) : (
          <Card as="div" className="overflow-hidden">
            <RepricedList items={repriced.slice(0, REPRICED_SHOWN)} promos={catalog.promos} now={now} />
            {repriced.length > REPRICED_SHOWN && (
              <details className="group border-t border-stone-100">
                <summary className="flex h-11 cursor-pointer list-none items-center justify-center gap-1.5 font-semibold text-primary [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">Xem thêm {repriced.length - REPRICED_SHOWN} sản phẩm</span>
                  <span className="hidden group-open:inline">Thu gọn</span>
                  <ChevronDown aria-hidden className="size-5 transition-transform group-open:rotate-180" />
                </summary>
                <RepricedList items={repriced.slice(REPRICED_SHOWN)} promos={catalog.promos} now={now} />
              </details>
            )}
          </Card>
        )}
        <SharePriceButton className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/25 bg-white px-4 font-semibold text-primary hover:bg-primary-soft" />
      </section>

    </>
  )
}

export default function PartnerHome() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-8 pt-5 text-base">
      <Suspense fallback={<p className="py-8 text-center text-stone-600">Đang tải...</p>}>
        <Home />
      </Suspense>
    </main>
  )
}
