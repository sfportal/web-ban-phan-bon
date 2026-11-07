import { Suspense } from 'react'
import { Money } from '@/components/Money'
import { requirePartner } from '@/lib/auth/guards'
import { searchMyFarmers, type FarmerSummary } from '@/lib/farmers/actions'
import { formatDate } from '@/lib/format'
import { SITE_NAME } from '@/lib/site'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { createServerClient } from '@/lib/supabase/server'

export const metadata = { title: `Nông dân — ${SITE_NAME}` }

type Stat = { total: number; last: string }

/** Tổng đã mua và ngày mua gần nhất theo nông dân, trên đơn của đối tác (bỏ đơn hủy / trả hàng). */
async function purchaseStats(partnerId: string): Promise<Map<string, Stat>> {
  const db = createServerClient()
  const rows = await fetchAll((from, to) =>
    db.from('order_lines')
      .select('farmer_id, line_total, orders!inner(created_at, status, partner_id)')
      .eq('orders.partner_id', partnerId).not('orders.status', 'in', '(cancelled,returned)')
      .not('farmer_id', 'is', null).order('id').range(from, to).throwOnError(),
  )
  const stats = new Map<string, Stat>()
  for (const r of rows) {
    const s = stats.get(r.farmer_id!) ?? { total: 0, last: '' }
    s.total += Number(r.line_total)
    if (r.orders.created_at > s.last) s.last = r.orders.created_at
    stats.set(r.farmer_id!, s)
  }
  return stats
}

async function Farmers({ searchParams }: Pick<PageProps<'/doi-tac/nong-dan'>, 'searchParams'>) {
  const session = await requirePartner()
  if (session.kind !== 'commission') {
    return <p className="py-8 text-center text-gray-600">Tài khoản đại lý không quản lý danh sách nông dân.</p>
  }
  const raw = (await searchParams).q
  const q = typeof raw === 'string' ? raw.trim().slice(0, 100) : ''

  const db = createServerClient()
  const [farmers, stats] = await Promise.all([
    q
      ? searchMyFarmers(q)
      : fetchAll<FarmerSummary>((from, to) =>
          db.from('farmers').select('id, name, phone').eq('owner_partner_id', session.partnerId)
            .order('name').order('phone').range(from, to).throwOnError(),
        ),
    purchaseStats(session.partnerId),
  ])

  return (
    <>
      <form action="/doi-tac/nong-dan" className="flex gap-2" role="search">
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Tên hoặc số điện thoại"
          aria-label="Tìm nông dân"
          className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-base"
        />
        <button type="submit" className="h-11 rounded-lg bg-green-700 px-4 font-semibold text-white">Tìm</button>
      </form>
      {q && <p className="text-sm text-gray-600">Kết quả cho “{q}” (tối đa 20).</p>}
      {farmers.length === 0 ? (
        <p className="py-8 text-center text-gray-600">{q ? 'Không tìm thấy nông dân nào.' : 'Chưa có nông dân nào.'}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border border-gray-200">
          {farmers.map((f) => {
            const s = stats.get(f.id)
            return (
              <li key={f.id} className="flex items-center justify-between gap-3 p-3">
                <span className="min-w-0">
                  <span className="block font-semibold">{f.name}</span>
                  <a href={`tel:${f.phone}`} className="text-gray-700">{f.phone}</a>
                </span>
                <span className="shrink-0 text-right">
                  <Money value={s?.total ?? 0} className="block font-semibold" />
                  <span className="text-sm text-gray-600">{s ? `Mua gần nhất ${formatDate(s.last)}` : 'Chưa mua'}</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

export default function FarmersPage({ searchParams }: PageProps<'/doi-tac/nong-dan'>) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 text-base">
      <h1 className="text-2xl font-bold">Nông dân</h1>
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <Farmers searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
