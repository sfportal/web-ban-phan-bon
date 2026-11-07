'use server'
// Server Actions của đối tác trên đơn của chính mình: hủy / sửa khi đơn còn `new`.
// RPC change_order_status / replace_order_lines không biết đơn thuộc ai, nên luôn kiểm tra
// orders.partner_id = đối tác của phiên trước khi gọi.
import { z } from 'zod'
import { requirePartner, type PartnerSession } from '@/lib/auth/guards'
import { adminClient } from '@/lib/supabase/admin'
import {
  farmersAllowed, linesPayload, parseSeenLines, priceAndDiff, type SeenLine, type SubmitResult,
} from './submit'

export type EditResult = SubmitResult | { status: 'error'; error: 'not_editable' }

const orderId = z.guid()

/** Đơn đối tác (source partner) của chính `session` đang ở trạng thái `new`; ngược lại null. */
async function editableOrder(session: PartnerSession, id: unknown) {
  const parsed = orderId.safeParse(id)
  if (!parsed.success) return null
  const { data } = await adminClient()
    .from('orders').select('id, code, status')
    .eq('id', parsed.data).eq('partner_id', session.partnerId).eq('source', 'partner')
    .maybeSingle().throwOnError()
  return data?.status === 'new' ? data : null
}

/** Lỗi nghiệp vụ của RPC (đơn vừa đổi trạng thái / bị xóa giữa chừng) → not_editable. */
function isNotEditable(message: string): boolean {
  return ['not_editable', 'invalid_transition', 'order_not_found'].includes(message)
}

/** Đối tác hủy đơn `new` của mình. */
export async function cancelMyOrder(id: string): Promise<{ ok: true } | { error: 'not_editable' }> {
  const session = await requirePartner()
  const order = await editableOrder(session, id)
  if (!order) return { error: 'not_editable' }
  const { error } = await adminClient().rpc('change_order_status', {
    p_order_id: order.id, p_to: 'cancelled', p_actor: session.userId, p_actor_kind: 'partner', p_note: null,
  })
  if (error) {
    if (isNotEditable(error.message)) return { error: 'not_editable' }
    throw error
  }
  return { ok: true }
}

/**
 * Đối tác thay toàn bộ dòng hàng của đơn `new`: tính lại theo giá/khuyến mãi/bậc hiện tại
 * (priceAndDiff, như khi gửi đơn) rồi replace_order_lines.
 */
export async function editMyOrder(id: string, lines: SeenLine[], acceptChanges: boolean): Promise<EditResult> {
  const session = await requirePartner()
  const order = await editableOrder(session, id)
  if (!order) return { status: 'error', error: 'not_editable' }
  const parsed = parseSeenLines(lines)
  if (!parsed || typeof acceptChanges !== 'boolean') return { status: 'error', error: 'missing_fields' }
  if (!(await farmersAllowed(session, parsed))) return { status: 'error', error: 'farmer_not_owned' }

  const result = await priceAndDiff({ lines: parsed, tierId: session.tierId, acceptChanges })
  if (result.status !== 'ok') return result
  const { priced } = result

  const { error } = await adminClient().rpc('replace_order_lines', {
    p_order_id: order.id,
    p_lines: linesPayload(priced),
    p_totals: {
      subtotal: priced.subtotal,
      partner_payable: priced.partnerPayable,
      commission_expected: priced.commissionExpected,
    },
    p_actor: session.userId,
    p_actor_kind: 'partner',
  })
  if (error) {
    if (isNotEditable(error.message)) return { status: 'error', error: 'not_editable' }
    throw error
  }
  return { status: 'ok', orderId: order.id, code: order.code }
}
