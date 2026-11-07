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

/** Danh sách đơn rút gọn (trang chủ đối tác, trang Đơn hàng). */
export function OrderList({ orders, kind }: { orders: OrderSummary[]; kind: 'commission' | 'wholesale' }) {
  return (
    <ul className="flex flex-col gap-2">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/doi-tac/don-hang/${o.id}`} className="flex flex-col gap-1 rounded-xl border border-gray-200 p-3">
            <span className="flex items-center justify-between gap-2">
              <span className="font-semibold">{o.code}</span>
              <StatusBadge status={o.status} />
            </span>
            <span className="text-sm text-gray-600">
              {formatDateTime(o.created_at)} · {o.total_qty} sản phẩm
              {o.source === 'retail' && ' · Khách tự đặt'}
            </span>
            <span className="flex flex-wrap justify-between gap-x-3">
              {kind === 'wholesale' && o.partner_payable !== null ? (
                <span>Phải trả <Money value={Number(o.partner_payable)} className="font-semibold" /></span>
              ) : (
                <span>Tổng <Money value={Number(o.subtotal)} className="font-semibold" /></span>
              )}
              {Number(o.commission_expected) > 0 && (
                <span className="text-green-800">HH <Money value={Number(o.commission_expected)} /></span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
