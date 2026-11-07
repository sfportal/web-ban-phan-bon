'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Money } from '@/components/Money'
import { StatusBadge } from '@/components/StatusBadge'
import { bulkSetStatus } from '@/lib/admin/orders-actions'
import { formatDateTime } from '@/lib/format'
import { STATUS_LABEL, TRANSITIONS, type OrderStatus } from '@/lib/orders/status'

export type OrderRow = {
  id: string
  code: string
  createdAt: string
  status: OrderStatus
  who: string
  phone: string | null
  /** Số tiền thu: giá đại lý nếu là đơn đại lý, ngược lại tổng giá bán. */
  total: number
}

const ERROR_LABEL: Record<string, string> = {
  invalid_transition: 'không chuyển được từ trạng thái hiện tại',
  not_found: 'không tìm thấy đơn',
}
const ORDER = Object.keys(STATUS_LABEL) as OrderStatus[]

/** Danh sách đơn có ô chọn; đổi trạng thái hàng loạt chỉ với các trạng thái đích hợp lệ. */
export function OrderBulkList({ rows }: { rows: OrderRow[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [target, setTarget] = useState<OrderStatus | ''>('')
  const [result, setResult] = useState<{ ok: number; failed: { code: string; reason: string }[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const chosen = rows.filter((r) => selected.has(r.id))
  // Trạng thái đích có thể áp cho ít nhất một đơn đã chọn; đơn không hợp lệ sẽ báo lỗi riêng.
  const targets = ORDER.filter((s) => chosen.some((r) => TRANSITIONS[r.status].includes(s)))
  const effectiveTarget = target && targets.includes(target) ? target : ''

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))

  const apply = () => {
    if (!effectiveTarget) return
    const n = chosen.length
    if (!window.confirm(`Chuyển ${n} đơn sang "${STATUS_LABEL[effectiveTarget]}"?`)) return
    start(async () => {
      setError(null)
      try {
        const res = await bulkSetStatus(chosen.map((r) => r.id), effectiveTarget)
        const codeOf = new Map(rows.map((r) => [r.id, r.code]))
        setResult({
          ok: res.ok.length,
          failed: res.failed.map((f) => ({ code: codeOf.get(f.id) ?? f.id, reason: ERROR_LABEL[f.code] ?? f.code })),
        })
        setSelected(new Set(res.failed.map((f) => f.id)))
        router.refresh()
      } catch {
        setError('Không đổi được trạng thái. Kiểm tra kết nối mạng rồi thử lại.')
      }
    })
  }

  if (rows.length === 0) return <p className="py-8 text-center text-gray-600">Không có đơn nào.</p>

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3">
        <span className="font-semibold">Đã chọn {chosen.length}</span>
        <select
          value={effectiveTarget}
          onChange={(e) => setTarget(e.target.value as OrderStatus)}
          aria-label="Trạng thái mới"
          disabled={targets.length === 0}
          className="h-11 rounded-lg border border-gray-300 px-3 text-base"
        >
          <option value="">Chuyển sang…</option>
          {targets.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <button
          type="button"
          onClick={apply}
          disabled={pending || !effectiveTarget}
          className="h-11 rounded-lg bg-green-700 px-4 font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'Đang đổi…' : 'Áp dụng'}
        </button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      {result && (
        <div role="status" className="rounded-lg bg-gray-50 p-3">
          <p>Đã đổi {result.ok} đơn.{result.failed.length > 0 && ` ${result.failed.length} đơn lỗi:`}</p>
          {result.failed.length > 0 && (
            <ul className="list-disc pl-5 text-red-800">
              {result.failed.map((f) => <li key={f.code}>{f.code}: {f.reason}</li>)}
            </ul>
          )}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full min-w-[44rem] text-left">
          <thead className="bg-gray-50 text-sm text-gray-600">
            <tr>
              <th className="w-12 p-3">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="size-5"
                />
              </th>
              <th className="p-3">Mã đơn</th><th className="p-3">Ngày</th><th className="p-3">Người đặt</th>
              <th className="p-3 text-right">Tổng</th><th className="p-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? 'bg-green-50' : undefined}>
                <td className="p-3">
                  <input type="checkbox" aria-label={`Chọn ${r.code}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="size-5" />
                </td>
                <td className="p-3 whitespace-nowrap">
                  <Link href={`/admin/don-hang/${r.id}`} className="font-semibold text-green-800 underline">{r.code}</Link>
                </td>
                <td className="p-3 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                <td className="p-3">
                  {r.who}
                  {r.phone && <span className="block text-sm text-gray-600">{r.phone}</span>}
                </td>
                <td className="p-3 text-right whitespace-nowrap"><Money value={r.total} /></td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
