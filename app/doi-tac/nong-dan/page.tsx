import { Phone, Search, Users } from 'lucide-react'
import { Suspense } from 'react'
import { Money } from '@/components/Money'
import { Button, Card, EmptyState, Input } from '@/components/ui'
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
    return (
      <Card>
        <EmptyState icon={<Users className="size-7" />} title="Tài khoản đại lý không quản lý danh sách nông dân." />
      </Card>
    )
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
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-stone-500" />
          <Input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Tên hoặc số điện thoại"
            aria-label="Tìm nông dân"
            className="pl-11"
          />
        </div>
        <Button type="submit">Tìm</Button>
      </form>
      {q && <p className="text-sm text-stone-600">Kết quả cho “{q}” (tối đa 20).</p>}
      {farmers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="size-7" />}
            title={q ? 'Không tìm thấy nông dân nào' : 'Chưa có nông dân nào'}
            description={q ? 'Thử tìm bằng số điện thoại hoặc một phần tên.' : 'Nông dân được thêm khi bạn lên đơn cho họ.'}
            action={q ? undefined : <Button href="/doi-tac/don-moi" prefetch={false}>Lên đơn mới</Button>}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {farmers.map((f) => {
            const s = stats.get(f.id)
            return (
              <li key={f.id}>
                <Card className="flex items-start gap-3 p-4">
                  <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary">
                    {f.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 font-semibold text-ink">{f.name}</span>
                      <Money value={s?.total ?? 0} className="shrink-0 font-bold tabular-nums text-ink" />
                    </span>
                    <span className="text-sm text-stone-600">{s ? `Mua gần nhất ${formatDate(s.last)}` : 'Chưa mua'}</span>
                    <a href={`tel:${f.phone}`} className="inline-flex min-h-11 items-center gap-1.5 self-start text-primary underline-offset-4 hover:underline">
                      <Phone aria-hidden className="size-4" />
                      {f.phone}
                    </a>
                  </span>
                </Card>
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 pb-8 pt-5 text-base">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Nông dân</h1>
      <Suspense fallback={<p className="py-8 text-center text-stone-600">Đang tải...</p>}>
        <Farmers searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
