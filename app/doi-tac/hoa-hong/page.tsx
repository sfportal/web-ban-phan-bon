import Link from 'next/link'
import { Suspense } from 'react'
import { Money } from '@/components/Money'
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
      <nav aria-label="Chọn kỳ" className="-mx-4 overflow-x-auto px-4">
        <div className="flex min-w-max gap-2">
          {periods.map((p) => (
            <Link
              key={p}
              href={`/doi-tac/hoa-hong?ky=${p}`}
              aria-current={p === period ? 'page' : undefined}
              className={`flex h-11 items-center rounded-full border px-4 font-semibold ${
                p === period ? 'border-green-700 bg-green-700 text-white' : 'border-gray-300 text-gray-700'
              }`}
            >
              {periodLabel(p)}
            </Link>
          ))}
        </div>
      </nav>

      {entries.length === 0 ? (
        <p className="py-8 text-center text-gray-600">Chưa có hoa hồng trong {periodLabel(period).toLowerCase()}.</p>
      ) : (
        <table className="w-full text-left">
          <thead className="border-b text-sm text-gray-600">
            <tr><th className="py-2 font-semibold">Mã đơn</th><th className="py-2 text-right font-semibold">Số tiền</th><th className="py-2 text-right font-semibold">Trạng thái</th></tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="py-3">
                  {e.orders ? (
                    <Link href={`/doi-tac/don-hang/${e.orders.id}`} className="font-semibold text-green-800">{e.orders.code}</Link>
                  ) : '—'}
                  {e.kind === 'reversal' && <span className="block text-sm text-red-700">Trả hàng</span>}
                </td>
                <td className="py-3 text-right"><Money value={Number(e.amount)} /></td>
                <td className={`py-3 text-right ${e.status === 'paid' ? 'text-green-800' : 'text-amber-800'}`}>
                  {e.status === 'paid' ? 'Đã chi' : 'Chờ chi'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2">
            <tr><th className="py-2">Tổng kỳ</th><td className="py-2 text-right font-bold"><Money value={sum(() => true)} /></td><td /></tr>
            <tr className="text-sm text-gray-700"><td className="py-1">Đã chi</td><td className="py-1 text-right"><Money value={sum((e) => e.status === 'paid')} /></td><td /></tr>
            <tr className="text-sm text-gray-700"><td className="py-1">Chờ chi</td><td className="py-1 text-right"><Money value={sum((e) => e.status !== 'paid')} /></td><td /></tr>
          </tfoot>
        </table>
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
  if (rows.length === 0) return <p className="py-8 text-center text-gray-600">Chưa có đơn nào.</p>
  return (
    <ul className="flex flex-col divide-y rounded-xl border border-gray-200">
      {rows.map(([p, m]) => (
        <li key={p} className="flex items-center justify-between gap-3 p-3">
          <span>
            <span className="block font-semibold">{periodLabel(p)}</span>
            <span className="text-sm text-gray-600">{m.count} đơn</span>
          </span>
          <Money value={m.saved} className="font-bold text-green-800" />
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
      <h1 className="text-2xl font-bold">{session.kind === 'commission' ? 'Hoa hồng' : 'Tiết kiệm theo tháng'}</h1>
      {session.kind === 'commission' ? <Commission session={session} requested={requested} /> : <Savings session={session} />}
    </>
  )
}

export default function CommissionPage({ searchParams }: PageProps<'/doi-tac/hoa-hong'>) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 text-base">
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
