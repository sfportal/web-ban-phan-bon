export type OrderStatus =
  | 'new' | 'confirmed' | 'shipping' | 'delivered' | 'paid' | 'cancelled' | 'returned'

export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['delivered', 'cancelled'],
  delivered: ['paid', 'returned'],
  paid: ['returned'],
  cancelled: [],
  returned: [],
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Mới',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  paid: 'Đã thu đủ tiền',
  cancelled: 'Đã hủy',
  returned: 'Trả hàng',
}

export function canTransition(
  from: OrderStatus, to: OrderStatus, actor: 'partner' | 'staff',
): boolean {
  if (actor === 'partner') return from === 'new' && to === 'cancelled'
  return TRANSITIONS[from].includes(to)
}
