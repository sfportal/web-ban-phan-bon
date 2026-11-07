'use server'
// Server Actions gửi đơn. Chỉ là lớp mỏng; logic ở lib/orders/submit.ts (server-only).
import * as submit from './submit'
import type { PartnerOrderInput, RetailOrderInput, SubmitResult } from './submit'

/** Đối tác (CTV/đại lý) đang đăng nhập gửi đơn. Xem submit.submitPartnerOrder. */
export async function submitPartnerOrder(input: PartnerOrderInput): Promise<SubmitResult> {
  return submit.submitPartnerOrder(input)
}

/** Khách lẻ gửi đơn từ giỏ hàng. Xem submit.submitRetailOrder. */
export async function submitRetailOrder(input: RetailOrderInput): Promise<SubmitResult> {
  return submit.submitRetailOrder(input)
}
