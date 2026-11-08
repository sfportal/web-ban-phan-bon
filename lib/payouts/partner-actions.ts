'use server'
// Server Actions ví hoa hồng của đối tác đang đăng nhập: khai ngân hàng, rút tiền, xem chứng từ.
// Mọi hàm gọi requirePartner() trước; chỉ thao tác trên partnerId của phiên. Ghi bằng service role.
import { after } from 'next/server'
import { requirePartner } from '@/lib/auth/guards'
import { notifyPayoutRequest } from '@/lib/notify'
import { adminClient } from '@/lib/supabase/admin'
import { signedProofUrl } from './proof-storage'
import { parseAmount, parseBankInfo } from './validate'
import { getMinPayout } from './wallet'

type Fields = FormData | Record<string, unknown>
const field = (form: Fields, key: string): unknown => (form instanceof FormData ? form.get(key) : form[key])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Khai / sửa ngân hàng nhận hoa hồng: bank_name, bank_account (6–20 chữ số), bank_holder. */
export async function saveBankInfo(form: Fields): Promise<{ ok: true } | { error: 'missing_fields' | 'invalid_account' }> {
  const session = await requirePartner()
  const parsed = parseBankInfo({
    bank_name: field(form, 'bank_name'), bank_account: field(form, 'bank_account'), bank_holder: field(form, 'bank_holder'),
  })
  if ('error' in parsed) return parsed
  await adminClient().from('partners').update(parsed.value).eq('id', session.partnerId).throwOnError()
  return { ok: true }
}

const REQUEST_ERRORS = ['not_active', 'not_commission', 'missing_bank', 'below_min', 'insufficient_balance'] as const
type RequestError = (typeof REQUEST_ERRORS)[number] | 'invalid_amount'

/**
 * Yêu cầu rút `amount` (chuỗi kiểu "1.500.000" hoặc số nguyên). Mức tối thiểu đọc từ setting
 * min_payout bằng service role. Thành công → báo admin trong after().
 */
export async function requestPayout(form: Fields): Promise<{ ok: true; id: string } | { error: RequestError }> {
  const session = await requirePartner()
  const raw = field(form, 'amount')
  const amount = typeof raw === 'number' ? (Number.isSafeInteger(raw) && raw > 0 ? raw : null) : parseAmount(String(raw ?? ''))
  if (amount === null) return { error: 'invalid_amount' }
  if (session.kind !== 'commission') return { error: 'not_commission' }

  const db = adminClient()
  const min = await getMinPayout()
  const { data: id, error } = await db.rpc('request_payout', { p_partner_id: session.partnerId, p_amount: amount, p_min: min })
  if (error) {
    const code = REQUEST_ERRORS.find((c) => c === error.message)
    if (code) return { error: code }
    throw error
  }

  after(async () => {
    try {
      const { data } = await db.from('payouts')
        .select('amount, bank_name, bank_account, bank_holder, is_demo, partners(name, phone)').eq('id', id).single().throwOnError()
      await notifyPayoutRequest({
        partnerName: data.partners?.name ?? session.name, phone: data.partners?.phone ?? '', amount: Number(data.amount),
        bankName: data.bank_name, bankAccount: data.bank_account, bankHolder: data.bank_holder, isDemo: data.is_demo,
      })
    } catch (e) {
      console.error('notifyPayoutRequest', e)
    }
  })
  return { ok: true, id }
}

/** Signed URL (300 giây) của chứng từ — chỉ khoản chi của chính đối tác. */
export async function getProofUrl(payoutId: string): Promise<{ url: string } | { error: 'not_found' | 'no_proof' }> {
  const session = await requirePartner()
  if (typeof payoutId !== 'string' || !UUID.test(payoutId)) return { error: 'not_found' }
  const { data } = await adminClient().from('payouts').select('proof_path')
    .eq('id', payoutId).eq('partner_id', session.partnerId).maybeSingle().throwOnError()
  if (!data) return { error: 'not_found' }
  if (!data.proof_path) return { error: 'no_proof' }
  return { url: await signedProofUrl(data.proof_path) }
}
