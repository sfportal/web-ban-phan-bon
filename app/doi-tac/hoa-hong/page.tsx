import { PiggyBank, Wallet } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { Money } from '@/components/Money'
import { Badge, Card, EmptyState } from '@/components/ui'
import { requirePartner, type PartnerSession } from '@/lib/auth/guards'
import { vnPeriod } from '@/lib/format'
import { SITE_NAME } from '@/lib/site'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { createServerClient } from '@/lib/supabase/server'

export const metadata = { title: `Hoa hồng — ${SITE_NAME}` }

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/

/** "2026-11" → "Tháng 11/2026" */
function periodLabel(p: string): string {
  const [y, m] = p.split('-')
  return `Tháng ${m}/${y}`
}

/** CTV: bút toán hoa hồng theo kỳ YYYY-MM (kỳ = tháng giờ VN lúc đơn được thu đủ tiền / trả hàng). */
async function Commission({ session, requested }: { session: PartnerSession; requested: string | null }) {
  const db = createServerClient()
  const periodRows = await fetchAll((from, to) =>
    db.from('commission_entries').select('period').eq('partner_id', session.partnerId)
      .order('id').range(from, to).throwOnError(),
  )
  const periods = [...new Set([vnPeriod(new Date()), ...periodRows.map((r) => r.period)])].sort().reverse()
  const period = requested && periods.includes(requested) ? requested : periods[0]

  const { data: entries } = await db
    .from('commission_entries').select('id, kind, amount, status, created_at, orders(id, code)')
    .eq('partner_id', session.partnerId).eq('period', period).order('created_at').throwOnError()
  const sum = (pred: (e: (typeof entries)[number]) => boolean) =>
    entries.filter(pred).reduce((s, e) => s + Number(e.amount), 0)

  return (
    <>
      <nav aria-label="Chọn kỳ" className="-mx-4 overflow-x-auto px-4 pb-1">
        <div className="flex min-w-max gap-2">
          {periods.map((p) => (
            <Link
              key={p}
              href={`/doi-tac/hoa-hong?ky=${p}`}
              prefetch={false}
              aria-current={p === period ? 'page' : undefined}
              className={`flex h-11 items-center rounded-full border px-4 font-semibold transition-colors ${
                p === period ? 'border-primary bg-primary text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-primary/50'
              }`}
            >
              {periodLabel(p)}
            </Link>
          ))}
        </div>
      </nav>

      {entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wallet className="size-7" />}
            title={`Chưa có hoa hồng trong ${periodLabel(period).toLowerCase()}.`}
            description="Hoa hồng được ghi khi đơn của bạn đã thu đủ tiền."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left">
            <caption className="sr-only">Hoa hồng {periodLabel(period).toLowerCase()}</caption>
            <thead className="border-b border-stone-200 bg-stone-50 text-sm text-stone-600">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Mã đơn</th>
                <th className="px-2 py-2.5 text-right font-semibold">Số tiền</th>
                <th className="px-4 py-2.5 text-right font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3">
                    {e.orders ? (
                      <Link href={`/doi-tac/don-hang/${e.orders.id}`} prefetch={false} className="font-semibold text-primary underline-offset-4 hover:underline">
                        {e.orders.code}
                      </Link>
                    ) : '—'}
                    {e.kind === 'reversal' && <span className="block text-sm font-semibold text-red-700">Trả hàng</span>}
                  </td>
                  <td className="px-2 py-3 text-right font-semibold tabular-nums text-ink"><Money value={Number(e.amount)} /></td>
                  <td className="px-4 py-3 text-right">
                    {e.status === 'paid' ? <Badge tone="green">Đã chi</Badge> : <Badge tone="yellow">Chờ chi</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-stone-200 bg-primary-soft/40">
              <tr className="text-lg text-ink">
                <th className="px-4 pb-1 pt-3">Tổng kỳ</th>
                <td className="px-2 pb-1 pt-3 text-right font-bold tabular-nums"><Money value={sum(() => true)} /></td>
                <td />
              </tr>
              <tr className="text-sm text-stone-700">
                <td className="px-4 py-0.5">Đã chi</td>
                <td className="px-2 py-0.5 text-right tabular-nums"><Money value={sum((e) => e.status === 'paid')} /></td>
                <td />
              </tr>
              <tr className="text-sm text-stone-700">
                <td className="px-4 pb-3 pt-0.5">Chờ chi</td>
                <td className="px-2 pb-3 pt-0.5 text-right tabular-nums"><Money value={sum((e) => e.status !== 'paid')} /></td>
                <td />
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </>
  )
}

/** Đại lý: tổng tiết kiệm (giá bán lẻ − giá đại lý) theo tháng đặt đơn (giờ VN), bỏ đơn hủy / trả hàng. */
async function Savings({ session }: { session: PartnerSession }) {
  const db = createServerClient()
  const orders = await fetchAll((from, to) =>
    db.from('orders').select('created_at, subtotal, partner_payable')
      .eq('partner_id', session.partnerId).not('status', 'in', '(cancelled,returned)').not('partner_payable', 'is', null)
      .order('id').range(from, to).throwOnError(),
  )
  const months = new Map<string, { saved: number; count: number }>()
  for (const o of orders) {
    const p = vnPeriod(o.created_at)
    const m = months.get(p) ?? { saved: 0, count: 0 }
    m.saved += Number(o.subtotal) - Number(o.partner_payable)
    m.count += 1
    months.set(p, m)
  }
  const rows = [...months].sort(([a], [b]) => b.localeCompare(a))
  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<PiggyBank className="size-7" />}
          title="Chưa có đơn nào."
          description="Mỗi đơn đặt theo giá đại lý sẽ cộng phần tiết kiệm vào tháng đặt đơn."
        />
      </Card>
    )
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map(([p, m]) => (
        <li key={p}>
          <Card className="flex items-center gap-3 p-4">
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <PiggyBank className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">{periodLabel(p)}</span>
              <span className="text-sm text-stone-600">{m.count} đơn</span>
            </span>
            <Money value={m.saved} className="shrink-0 text-lg font-bold tabular-nums text-primary" />
          </Card>
        </li>
      ))}
    </ul>
  )
}

async function Content({ searchParams }: Pick<PageProps<'/doi-tac/hoa-hong'>, 'searchParams'>) {
  const session = await requirePartner()
  const raw = (await searchParams).ky
  const requested = typeof raw === 'string' && PERIOD.test(raw) ? raw : null
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-ink">{session.kind === 'commission' ? 'Hoa hồng' : 'Tiết kiệm theo tháng'}</h1>
      {session.kind === 'commission' ? <Commission session={session} requested={requested} /> : <Savings session={session} />}
    </>
  )
}

export default function CommissionPage({ searchParams }: PageProps<'/doi-tac/hoa-hong'>) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 pb-8 pt-5 text-base">
      <Suspense fallback={<p className="py-8 text-center text-stone-600">Đang tải...</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
