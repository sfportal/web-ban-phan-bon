'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
import { useState, useTransition } from 'react'
import { TableCard, tbody, td, th, thead } from '@/components/admin/table'
import { Money } from '@/components/Money'
import { StatusBadge } from '@/components/StatusBadge'
import { Badge, Button, Card, EmptyState, Select } from '@/components/ui'
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
  isDemo?: boolean
}

const ERROR_LABEL: Record<string, string> = {
  invalid_transition: 'không chuyển được từ trạng thái hiện tại',
  not_found: 'không tìm thấy đơn',
  error: 'lỗi hệ thống, hãy thử lại',
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

  if (rows.length === 0)
    return (
      <Card>
        <EmptyState icon={<ClipboardList className="size-7" />} title="Không có đơn nào" description="Thử bỏ bớt điều kiện lọc hoặc chọn khoảng ngày khác." />
      </Card>
    )

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-2xl border p-3 transition-colors ${
          chosen.length > 0 ? 'border-primary/30 bg-primary-soft' : 'border-stone-200 bg-white'
        }`}
      >
        <span className="w-full font-semibold sm:mr-auto sm:w-auto">Đã chọn {chosen.length}<span className="font-normal text-stone-600"> / {rows.length} đơn</span></span>
        <Select
          value={effectiveTarget}
          onChange={(e) => setTarget(e.target.value as OrderStatus)}
          aria-label="Trạng thái mới"
          disabled={targets.length === 0}
          className="min-w-0 flex-1 sm:w-64 sm:flex-none"
        >
          <option value="">Chuyển sang…</option>
          {targets.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </Select>
        <Button onClick={apply} disabled={pending || !effectiveTarget}>
          {pending ? 'Đang đổi…' : 'Áp dụng'}
        </Button>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
      {result && (
        <div role="status" className="rounded-xl border border-stone-200 bg-white p-3">
          <p>Đã đổi {result.ok} đơn.{result.failed.length > 0 && ` ${result.failed.length} đơn lỗi:`}</p>
          {result.failed.length > 0 && (
            <ul className="list-disc pl-5 text-red-800">
              {result.failed.map((f) => <li key={f.code}>{f.code}: {f.reason}</li>)}
            </ul>
          )}
        </div>
      )}
      <TableCard>
        <table className="w-full min-w-[44rem] text-left">
          <thead className={thead}>
            <tr>
              <th className={`${th} w-12`}>
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="size-5 accent-primary"
                />
              </th>
              <th className={th}>Mã đơn</th><th className={th}>Ngày</th><th className={th}>Người đặt</th>
              <th className={`${th} text-right`}>Tổng</th><th className={th}>Trạng thái</th>
            </tr>
          </thead>
          <tbody className={tbody}>
            {rows.map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? 'bg-primary-soft!' : undefined}>
                <td className={td}>
                  <input type="checkbox" aria-label={`Chọn ${r.code}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="size-5 accent-primary" />
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  <Link href={`/admin/don-hang/${r.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">{r.code}</Link>
                  {r.isDemo && <Badge tone="gray" className="ml-2">Thử</Badge>}
                </td>
                <td className={`${td} whitespace-nowrap text-stone-700`}>{formatDateTime(r.createdAt)}</td>
                <td className={td}>
                  {r.who}
                  {r.phone && <span className="block text-sm text-stone-600">{r.phone}</span>}
                </td>
                <td className={`${td} text-right font-semibold tabular-nums whitespace-nowrap`}><Money value={r.total} /></td>
                <td className={td}><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  )
}
