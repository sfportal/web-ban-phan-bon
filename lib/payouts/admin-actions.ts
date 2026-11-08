'use server'
// Server Actions chi trả của admin: duyệt / từ chối, đánh dấu đã chuyển (kèm chứng từ), đợt chi,
// xem chứng từ, xuất Excel. Mọi hàm gọi requireStaff('admin') trước (nhân viên chỉ xem trang).
import { requireStaff } from '@/lib/auth/guards'
import { buildBalancesSheet, buildPayoutBatchSheet, buildPayoutRequestsSheet, type PayoutExportRow } from '@/lib/excel/export'
import { adminClient } from '@/lib/supabase/admin'
import { removeProof, signedProofUrl, uploadProof } from './proof-storage'
import { BATCH_KINDS, isIsoDate, validateProof, vnToday, type BatchKind, type PayoutStatus } from './validate'
import { getBatch, getMinPayout, listBalances, listPayoutRequests, type AdminPayoutRow } from './wallet'

type Fields = FormData | Record<string, unknown>
const field = (form: Fields, key: string): unknown => (form instanceof FormData ? form.get(key) : form[key])
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)

/** Mã lỗi nghiệp vụ của RPC (error.message) nằm trong `known`; lỗi khác ném lại. */
function rpcCode<T extends string>(error: { message: string }, known: readonly T[]): T {
  const code = known.find((c) => c === error.message)
  if (!code) throw error
  return code
}

async function decide(id: string, action: 'approve' | 'reject', actor: string, reason: string | null) {
  const { error } = await adminClient().rpc('decide_payout', { p_payout_id: id, p_action: action, p_actor: actor, p_reason: reason })
  if (!error) return null
  const code = rpcCode(error, ['invalid_state', 'reason_required', 'payout_not_found'] as const)
  return code === 'payout_not_found' ? 'not_found' : code
}

/** Duyệt yêu cầu rút: requested → approved. */
export async function approvePayout(id: string): Promise<{ ok: true } | { error: 'invalid_state' | 'not_found' }> {
  const { userId } = await requireStaff('admin')
  if (!isUuid(id)) return { error: 'not_found' }
  const code = await decide(id, 'approve', userId, null)
  if (code === 'reason_required') throw new Error('decide_payout approve: reason_required')
  return code ? { error: code } : { ok: true }
}

/** Từ chối (requested|approved → rejected), bắt buộc lý do; tiền trở lại số dư. */
export async function rejectPayout(
  id: string, reason: string,
): Promise<{ ok: true } | { error: 'reason_required' | 'invalid_state' | 'not_found' }> {
  const { userId } = await requireStaff('admin')
  if (!isUuid(id)) return { error: 'not_found' }
  const r = text(reason).slice(0, 500)
  if (!r) return { error: 'reason_required' }
  const code = await decide(id, 'reject', userId, r)
  return code ? { error: code } : { ok: true }
}

export type MarkPaidError =
  | 'not_found' | 'invalid_state' | 'ref_required' | 'invalid_date' | 'bad_type' | 'too_large' | 'upload_failed'
const MARK_ERRORS = ['invalid_state', 'ref_required', 'invalid_date', 'payout_not_found'] as const

type PaidInput = { ref: string; date: string }

/** Kiểm tra trước khi gọi RPC (để không tải file lên vô ích). */
function checkPaidInput(ref: unknown, date: unknown): PaidInput | { error: 'ref_required' | 'invalid_date' } {
  const r = text(ref)
  if (!r) return { error: 'ref_required' }
  if (!isIsoDate(date) || date > vnToday()) return { error: 'invalid_date' }
  return { ref: r, date }
}

async function markPaidRpc(id: string, actor: string, input: PaidInput, proofPath: string | null) {
  const { error } = await adminClient().rpc('mark_payout_paid', {
    p_payout_id: id, p_actor: actor, p_ref: input.ref, p_date: input.date, p_proof_path: proofPath,
  })
  if (!error) return null
  const code = rpcCode(error, MARK_ERRORS)
  return code === 'payout_not_found' ? 'not_found' : code
}

/**
 * Đánh dấu đã chuyển: mã GD (bắt buộc), ngày (≤ hôm nay giờ VN), chứng từ tùy chọn
 * (ô file trống = không có). Có file → kiểm tra → tải lên payout-proofs/<partner>/<id>.<ext>
 * → RPC; tải lỗi → upload_failed, trạng thái không đổi. Khoản đã chuyển → ok, không đổi gì.
 */
export async function markPayoutPaid(form: Fields): Promise<{ ok: true } | { error: MarkPaidError }> {
  const { userId } = await requireStaff('admin')
  const id = field(form, 'id')
  if (!isUuid(id)) return { error: 'not_found' }
  const input = checkPaidInput(field(form, 'ref'), field(form, 'date'))
  if ('error' in input) return input
  const rawProof = field(form, 'proof')
  const proof = rawProof instanceof File && rawProof.size > 0 ? rawProof : null
  if (proof) {
    const invalid = validateProof(proof)
    if (invalid !== 'ok') return { error: invalid }
  }

  const { data: row } = await adminClient().from('payouts').select('partner_id, status').eq('id', id).maybeSingle().throwOnError()
  if (!row) return { error: 'not_found' }
  // Đã chuyển rồi: gửi lại không kèm file thì coi như xong; kèm file thì báo để admin biết chứng từ không được gắn.
  if (row.status === 'paid') return proof ? { error: 'invalid_state' } : { ok: true }
  if (row.status !== 'requested' && row.status !== 'approved') return { error: 'invalid_state' }

  let path: string | null = null
  if (proof) {
    try {
      path = await uploadProof(row.partner_id, id, proof)
    } catch (e) {
      console.error('uploadProof', e)
      return { error: 'upload_failed' }
    }
  }
  let failed: Awaited<ReturnType<typeof markPaidRpc>>
  try {
    failed = await markPaidRpc(id, userId, input, path)
  } catch (e) {
    if (path) await removeProof(path)
    throw e
  }
  if (failed) {
    if (path) await removeProof(path)
    return { error: failed }
  }
  return { ok: true }
}

/** Đánh dấu mọi khoản chưa chuyển của đợt (requested|approved) với cùng mã GD và ngày; không chứng từ. */
export async function markBatchPaid(
  batchId: string, input: { ref: string; date: string },
): Promise<{ ok: number; failed: { id: string; code: string }[] }> {
  const { userId } = await requireStaff('admin')
  if (!isUuid(batchId)) return { ok: 0, failed: [] }
  const { data: rows } = await adminClient().from('payouts').select('id').eq('batch_id', batchId)
    .in('status', ['requested', 'approved']).order('id').throwOnError()
  const checked = checkPaidInput(input?.ref, input?.date)
  if ('error' in checked) return { ok: 0, failed: rows.map((r) => ({ id: r.id, code: checked.error })) }
  let ok = 0
  const failed: { id: string; code: string }[] = []
  for (const r of rows) {
    try {
      const code = await markPaidRpc(r.id, userId, checked, null)
      if (code) failed.push({ id: r.id, code })
      else ok++
    } catch (e) {
      console.error('markBatchPaid', r.id, e)
      failed.push({ id: r.id, code: 'error' })
    }
  }
  return { ok, failed }
}

export type CreateBatchResult =
  | { ok: true; batchId: string; created: number; skippedNoBank: number; skippedBelowMin: number }
  | { error: 'invalid_kind' | 'invalid_date' }

/** Tạo đợt chi (kind weekly|monthly|custom, ngày chốt ≤ hôm nay, ghi chú ≤ 200 ký tự). */
export async function createBatch(form: Fields): Promise<CreateBatchResult> {
  const { userId } = await requireStaff('admin')
  const kind = field(form, 'kind')
  if (!(BATCH_KINDS as readonly unknown[]).includes(kind)) return { error: 'invalid_kind' }
  const cutoff = field(form, 'cutoff')
  if (!isIsoDate(cutoff) || cutoff > vnToday()) return { error: 'invalid_date' }
  const note = text(field(form, 'note')).slice(0, 200) || null

  const { data, error } = await adminClient().rpc('create_payout_batch', {
    p_kind: kind as BatchKind, p_cutoff: cutoff, p_min: await getMinPayout(), p_actor: userId, p_note: note, p_is_demo: false,
  })
  if (error) throw error
  const r = data as { batch_id: string; created: number; skipped_no_bank: number; skipped_below_min: number }
  return {
    ok: true, batchId: r.batch_id, created: r.created, skippedNoBank: r.skipped_no_bank, skippedBelowMin: r.skipped_below_min,
  }
}

/** Signed URL (300 giây) chứng từ của bất kỳ khoản chi nào (admin). */
export async function getAdminProofUrl(id: string): Promise<{ url: string } | { error: 'not_found' | 'no_proof' }> {
  await requireStaff('admin')
  if (!isUuid(id)) return { error: 'not_found' }
  const { data } = await adminClient().from('payouts').select('proof_path').eq('id', id).maybeSingle().throwOnError()
  if (!data) return { error: 'not_found' }
  if (!data.proof_path) return { error: 'no_proof' }
  return { url: await signedProofUrl(data.proof_path) }
}

// Xuất Excel ----------------------------------------------------------------------------

function exportRow(r: AdminPayoutRow): PayoutExportRow {
  return {
    partnerName: r.partnerName, phone: r.phone, amount: r.amount, status: r.status, bankName: r.bankName,
    bankAccount: r.bankAccount, bankHolder: r.bankHolder, requestedAt: r.requestedAt.toISOString(),
    transferRef: r.transferRef, transferredOn: r.transferredOn, rejectReason: r.rejectReason,
  }
}

export async function exportPayoutRequests(status?: PayoutStatus): Promise<Buffer> {
  await requireStaff('admin')
  return buildPayoutRequestsSheet((await listPayoutRequests(status)).map(exportRow))
}

/** null nếu không có đợt `batchId`. */
export async function exportPayoutBatch(batchId: string): Promise<{ file: Buffer; cutoffDate: string } | null> {
  await requireStaff('admin')
  if (!isUuid(batchId)) return null
  const found = await getBatch(batchId)
  if (!found) return null
  const { batch, payouts } = found
  return { file: await buildPayoutBatchSheet(batch, payouts.map(exportRow)), cutoffDate: batch.cutoffDate }
}

export async function exportBalances(): Promise<Buffer> {
  await requireStaff('admin')
  return buildBalancesSheet(await listBalances())
}
