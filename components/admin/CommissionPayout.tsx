'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Money } from '@/components/Money'
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

const th = 'p-3'
const td = 'p-3 text-right whitespace-nowrap'

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

  if (report.length === 0) return <p className="py-8 text-center text-gray-600">Kỳ {period} chưa có hoa hồng.</p>

  const sum = (k: keyof Omit<CommissionRow, 'partnerId' | 'partnerName' | 'phone'>) => report.reduce((s, r) => s + r[k], 0)
  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="flex flex-col gap-6">
      {msg && <p role="status" className="rounded-lg bg-gray-50 p-3">{msg}</p>}
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">Theo CTV · kỳ {period}</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[48rem] text-left">
            <thead className="bg-gray-50 text-sm text-gray-600">
              <tr>
                <th className={th}>CTV</th><th className={`${th} text-right`}>Ghi nhận</th><th className={`${th} text-right`}>Hoàn</th>
                <th className={`${th} text-right`}>Thực nhận</th><th className={`${th} text-right`}>Chờ chi</th><th className={`${th} text-right`}>Đã chi</th>
                {canPay && <th className={th} />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.map((r) => {
                const ids = entries.filter((e) => e.partnerId === r.partnerId && e.status === 'pending').map((e) => e.id)
                return (
                  <tr key={r.partnerId}>
                    <td className="p-3">
                      <Link href={`/admin/doi-tac/${r.partnerId}`} className="font-semibold text-green-800 underline">{r.partnerName}</Link>
                      <span className="block text-sm text-gray-600">{r.phone}</span>
                    </td>
                    <td className={td}><Money value={r.earned} /></td>
                    <td className={td}><Money value={r.reversed} /></td>
                    <td className={`${td} font-semibold`}><Money value={r.net} /></td>
                    <td className={td}><Money value={r.pending} /></td>
                    <td className={td}><Money value={r.paid} /></td>
                    {canPay && (
                      <td className="p-3">
                        <button type="button" disabled={pending || ids.length === 0} onClick={() => pay(ids, `toàn bộ hoa hồng chờ chi của ${r.partnerName}`)}
                          className="h-11 whitespace-nowrap rounded-lg border border-green-700 px-3 font-semibold text-green-800 disabled:opacity-40">
                          Đã chi
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50 font-bold">
              <tr>
                <td className="p-3">Tổng</td>
                <td className={td}><Money value={sum('earned')} /></td>
                <td className={td}><Money value={sum('reversed')} /></td>
                <td className={td}><Money value={sum('net')} /></td>
                <td className={td}><Money value={sum('pending')} /></td>
                <td className={td}><Money value={sum('paid')} /></td>
                {canPay && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">Chi tiết</h2>
          {canPay && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={pending || pendingIds.length === 0}
                onClick={() => setSelected(new Set(pendingIds))}
                className="h-11 rounded-lg border border-gray-300 px-3 font-semibold disabled:opacity-40">
                Chọn tất cả chờ chi
              </button>
              <button type="button" disabled={pending || selected.size === 0}
                onClick={() => pay([...selected], `${selected.size} dòng đã chọn`)}
                className="h-11 rounded-lg bg-green-700 px-4 font-semibold text-white disabled:opacity-40">
                Đánh dấu đã chi ({selected.size})
              </button>
            </div>
          )}
        </div>
        <ul className="divide-y rounded-xl border border-gray-200">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-3 p-3">
              {canPay && (
                <input type="checkbox" className="size-5" aria-label={`Chọn ${e.orderCode}`} disabled={e.status !== 'pending'}
                  checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
              )}
              <span className="flex flex-1 flex-col">
                <span>
                  <Link href={`/admin/don-hang/${e.orderId}`} className="font-semibold text-green-800 underline">{e.orderCode}</Link>
                  {' '}· {nameOf.get(e.partnerId)}
                </span>
                <span className="text-sm text-gray-600">
                  {e.kind === 'earn' ? 'Ghi nhận' : 'Hoàn (trả hàng)'} {formatDate(e.createdAt)} ·{' '}
                  {e.status === 'paid' ? `Đã chi${e.paidAt ? ` ${formatDate(e.paidAt)}` : ''}` : 'Chờ chi'}
                </span>
              </span>
              <Money value={e.amount} className={`font-semibold ${e.amount < 0 ? 'text-red-700' : ''}`} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
