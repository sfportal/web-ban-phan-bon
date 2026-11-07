import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Money } from '@/components/Money'
import { StatusBadge } from '@/components/StatusBadge'
import { formatDateTime } from '@/lib/format'
import type { OrderStatus } from '@/lib/orders/status'

export type OrderSummary = {
  id: string
  code: string
  source: 'partner' | 'retail'
  status: OrderStatus
  created_at: string
  subtotal: number
  partner_payable: number | null
  commission_expected: number
  total_qty: number
}

export const ORDER_SUMMARY_COLUMNS =
  'id, code, source, status, created_at, subtotal, partner_payable, commission_expected, total_qty'

/** Danh sách đơn rút gọn (trang chủ đối tác, trang Đơn hàng): mỗi đơn một thẻ. */
export function OrderList({ orders, kind }: { orders: OrderSummary[]; kind: 'commission' | 'wholesale' }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {orders.map((o) => (
        <li key={o.id}>
          <Link
            href={`/doi-tac/don-hang/${o.id}`}
            prefetch={false}
            className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 transition-colors hover:border-primary/40"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold tracking-tight text-ink">{o.code}</span>
                <StatusBadge status={o.status} />
              </span>
              <span className="text-sm text-stone-600">
                {formatDateTime(o.created_at)} · {o.total_qty} sản phẩm
                {o.source === 'retail' && ' · Khách tự đặt'}
              </span>
              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                {kind === 'wholesale' && o.partner_payable !== null ? (
                  <span className="text-stone-700">Phải trả <Money value={Number(o.partner_payable)} className="font-bold tabular-nums text-ink" /></span>
                ) : (
                  <span className="text-stone-700">Tổng <Money value={Number(o.subtotal)} className="font-bold tabular-nums text-ink" /></span>
                )}
                {Number(o.commission_expected) > 0 && (
                  <span className="font-semibold text-primary">HH <Money value={Number(o.commission_expected)} className="tabular-nums" /></span>
                )}
              </span>
            </span>
            <ChevronRight aria-hidden className="size-5 shrink-0 text-stone-400" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
