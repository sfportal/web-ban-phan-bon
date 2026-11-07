'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Wallet } from 'lucide-react'
import { useState, useTransition } from 'react'
import { TableCard, tbody, th as thBase, thead } from '@/components/admin/table'
import { Money } from '@/components/Money'
import { Badge, Button, Card, EmptyState, SectionHeader } from '@/components/ui'
import { markCommissionsPaid } from '@/lib/admin/commission-actions'
import type { CommissionRow } from '@/lib/excel/export'
import { formatDate } from '@/lib/format'

export type EntryRow = {
  id: string
  partnerId: string
  kind: 'earn' | 'reversal'
  amount: number
  status: 'pending' | 'paid'
  paidAt: string | null
  createdAt: string
  orderId: string
  orderCode: string
}

const th = thBase
const td = 'px-4 py-3 text-right tabular-nums whitespace-nowrap'

/** Bảng tổng theo CTV của kỳ và danh sách dòng hoa hồng; admin đánh dấu đã chi (từng dòng / theo CTV). */
export function CommissionPayout({
  period, report, entries, canPay,
}: { period: string; report: CommissionRow[]; entries: EntryRow[]; canPay: boolean }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const nameOf = new Map(report.map((r) => [r.partnerId, r.partnerName]))
  const pendingIds = entries.filter((e) => e.status === 'pending').map((e) => e.id)

  const pay = (ids: string[], label: string) => {
    if (ids.length === 0) return
    if (!window.confirm(`Đánh dấu đã chi ${label}?`)) return
    start(async () => {
      setMsg(null)
      try {
        const { updated } = await markCommissionsPaid(ids)
        setMsg(`Đã đánh dấu đã chi ${updated} dòng.`)
        setSelected(new Set())
        router.refresh()
      } catch {
        setMsg('Không lưu được. Kiểm tra kết nối mạng rồi thử lại.')
      }
    })
  }

  if (report.length === 0)
    return (
      <Card>
        <EmptyState icon={<Wallet className="size-7" />} title={`Kỳ ${period} chưa có hoa hồng`} description="Hoa hồng xuất hiện khi đơn của CTV chuyển sang “Đã thu đủ tiền”." />
      </Card>
    )

  const sum = (k: keyof Omit<CommissionRow, 'partnerId' | 'partnerName' | 'phone'>) => report.reduce((s, r) => s + r[k], 0)
  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="flex flex-col gap-8">
      {msg && <p role="status" className="rounded-xl border border-stone-200 bg-white p-3">{msg}</p>}
      <section className="flex flex-col gap-3">
        <SectionHeader title={`Theo CTV, kỳ ${period}`} />
        <TableCard>
          <table className="w-full min-w-[48rem] text-left">
            <thead className={thead}>
              <tr>
                <th className={th}>CTV</th><th className={`${th} text-right`}>Ghi nhận</th><th className={`${th} text-right`}>Hoàn</th>
                <th className={`${th} text-right`}>Thực nhận</th><th className={`${th} text-right`}>Chờ chi</th><th className={`${th} text-right`}>Đã chi</th>
                {canPay && <th className={th}><span className="sr-only">Thao tác</span></th>}
              </tr>
            </thead>
            <tbody className={tbody}>
              {report.map((r) => {
                const ids = entries.filter((e) => e.partnerId === r.partnerId && e.status === 'pending').map((e) => e.id)
                return (
                  <tr key={r.partnerId}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/doi-tac/${r.partnerId}`} className="font-semibold text-primary underline-offset-4 hover:underline">{r.partnerName}</Link>
                      <span className="block text-sm text-stone-600">{r.phone}</span>
                    </td>
                    <td className={td}><Money value={r.earned} /></td>
                    <td className={`${td} ${r.reversed ? 'text-red-700' : 'text-stone-500'}`}><Money value={r.reversed} /></td>
                    <td className={`${td} font-semibold`}><Money value={r.net} /></td>
                    <td className={`${td} ${r.pending ? 'font-semibold text-yellow-900' : 'text-stone-500'}`}><Money value={r.pending} /></td>
                    <td className={td}><Money value={r.paid} /></td>
                    {canPay && (
                      <td className="px-4 py-2 text-right">
                        <Button variant="secondary" disabled={pending || ids.length === 0} onClick={() => pay(ids, `toàn bộ hoa hồng chờ chi của ${r.partnerName}`)}
                          className="whitespace-nowrap">
                          Đã chi
                        </Button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-stone-200 bg-primary-soft/50 font-bold">
              <tr>
                <td className="px-4 py-3">Tổng</td>
                <td className={td}><Money value={sum('earned')} /></td>
                <td className={td}><Money value={sum('reversed')} /></td>
                <td className={td}><Money value={sum('net')} /></td>
                <td className={td}><Money value={sum('pending')} /></td>
                <td className={td}><Money value={sum('paid')} /></td>
                {canPay && <td />}
              </tr>
            </tfoot>
          </table>
        </TableCard>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeader title="Chi tiết" subtitle={`${entries.length} dòng, ${pendingIds.length} dòng chờ chi`} />
          {canPay && (
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" disabled={pending || pendingIds.length === 0} onClick={() => setSelected(new Set(pendingIds))}>
                Chọn tất cả chờ chi
              </Button>
              <Button disabled={pending || selected.size === 0} onClick={() => pay([...selected], `${selected.size} dòng đã chọn`)}>
                Đánh dấu đã chi ({selected.size})
              </Button>
            </div>
          )}
        </div>
        <Card as="div" className="overflow-hidden">
          <ul className="divide-y divide-stone-100">
            {entries.map((e) => (
              <li key={e.id} className={`flex items-center gap-3 px-4 py-3 ${selected.has(e.id) ? 'bg-primary-soft' : ''}`}>
                {canPay && (
                  <input type="checkbox" className="size-5 shrink-0 accent-primary" aria-label={`Chọn ${e.orderCode}`} disabled={e.status !== 'pending'}
                    checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span>
                    <Link href={`/admin/don-hang/${e.orderId}`} className="font-semibold text-primary underline-offset-4 hover:underline">{e.orderCode}</Link>
                    <span className="text-stone-700"> {nameOf.get(e.partnerId)}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
                    <span>{e.kind === 'earn' ? 'Ghi nhận' : 'Hoàn (trả hàng)'} {formatDate(e.createdAt)}</span>
                    {e.status === 'paid'
                      ? <Badge tone="green">Đã chi{e.paidAt ? ` ${formatDate(e.paidAt)}` : ''}</Badge>
                      : <Badge tone="yellow">Chờ chi</Badge>}
                  </span>
                </span>
                <Money value={e.amount} className={`shrink-0 font-semibold tabular-nums ${e.amount < 0 ? 'text-red-700' : ''}`} />
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  )
}
