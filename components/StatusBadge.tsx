import { STATUS_LABEL, type OrderStatus } from '@/lib/orders/status'

const COLOR: Record<OrderStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  shipping: 'bg-amber-100 text-amber-900',
  delivered: 'bg-teal-100 text-teal-800',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-200 text-gray-700',
  returned: 'bg-red-100 text-red-800',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold ${COLOR[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}
