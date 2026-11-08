// Kiểm tra dữ liệu ví / chi trả (thuần, dùng cả ở client và test): chứng từ, số tiền, ngân hàng,
// nhãn trạng thái và thông báo lỗi tiếng Việt cho các mã lỗi của Server Action.

export type PayoutStatus = 'requested' | 'approved' | 'paid' | 'rejected'
export type PayoutSource = 'request' | 'batch' | 'legacy'
export type BatchKind = 'weekly' | 'monthly' | 'custom'

export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  requested: 'Chờ duyệt',
  approved: 'Đã duyệt',
  paid: 'Đã chuyển',
  rejected: 'Từ chối',
}

/** Nguồn khoản chi (góc nhìn đối tác). 'legacy' = hoa hồng đã chi theo cách cũ, trước khi có ví (0008). */
export const PAYOUT_SOURCE_LABEL: Record<PayoutSource, string> = {
  request: 'Yêu cầu rút',
  batch: 'Cửa hàng chi',
  legacy: 'Đã chi trước khi có ví',
}
/** Nguồn khoản chi (góc nhìn admin, đứng trước ngày). */
export const ADMIN_PAYOUT_SOURCE_LABEL: Record<PayoutSource, string> = {
  request: 'Yêu cầu',
  batch: 'Đợt chi',
  legacy: 'Đã chi trước khi có ví',
}

export const BATCH_KINDS = ['weekly', 'monthly', 'custom'] as const satisfies readonly BatchKind[]
export const BATCH_KIND_LABEL: Record<BatchKind, string> = {
  weekly: 'theo tuần',
  monthly: 'theo tháng',
  custom: 'tùy chọn',
}

export const DEFAULT_MIN_PAYOUT = 100000

// Chứng từ chuyển khoản ------------------------------------------------------------

export const MAX_PROOF_BYTES = 5 * 1024 * 1024
export const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const
const PROOF_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf',
}

/** jpg/png/webp/pdf, 1 byte … 5MB. File rỗng coi như sai loại (người gọi bỏ qua ô file trống trước). */
export function validateProof(file: { type: string; size: number }): 'ok' | 'bad_type' | 'too_large' {
  if (!(PROOF_TYPES as readonly string[]).includes(file.type) || file.size <= 0) return 'bad_type'
  if (file.size > MAX_PROOF_BYTES) return 'too_large'
  return 'ok'
}

export function proofExtension(type: string): string {
  return PROOF_EXT[type] ?? 'bin'
}

// Số tiền ----------------------------------------------------------------------------

/**
 * Số tiền VNĐ nguyên dương từ ô nhập: "1500000", "1.500.000", "1,500,000", "1 500 000",
 * có thể kèm "đ"/"₫". Nhóm nghìn phải đủ 3 chữ số và dùng một loại dấu. Sai → null.
 */
export function parseAmount(input: string): number | null {
  const s = String(input).replace(/\s+/g, '').replace(/(đ|₫|vnđ|vnd)$/i, '')
  if (!/^\d+$/.test(s) && !/^\d{1,3}(\.\d{3})+$/.test(s) && !/^\d{1,3}(,\d{3})+$/.test(s)) return null
  const n = Number(s.replace(/[.,]/g, ''))
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

// Ngân hàng ---------------------------------------------------------------------------

export type BankInfo = { bank_name: string; bank_account: string; bank_holder: string }
const BANK_TEXT_MAX = 120

/** Số tài khoản: chỉ chữ số và khoảng trắng, 6–20 chữ số (lưu không khoảng trắng). */
export function parseBankInfo(raw: { bank_name?: unknown; bank_account?: unknown; bank_holder?: unknown }):
  { ok: true; value: BankInfo } | { error: 'missing_fields' | 'invalid_account' } {
  const text = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '')
  const bank_name = text(raw.bank_name)
  const bank_holder = text(raw.bank_holder)
  const account = text(raw.bank_account)
  if (!bank_name || !bank_holder || !account || bank_name.length > BANK_TEXT_MAX || bank_holder.length > BANK_TEXT_MAX) {
    return { error: 'missing_fields' }
  }
  if (!/^[\d ]+$/.test(account)) return { error: 'invalid_account' }
  const bank_account = account.replace(/ /g, '')
  if (bank_account.length < 6 || bank_account.length > 20) return { error: 'invalid_account' }
  return { ok: true, value: { bank_name, bank_account, bank_holder } }
}

// Ngày ---------------------------------------------------------------------------------

/** yyyy-mm-dd là ngày lịch hợp lệ. */
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string') return false
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
}

/** Hôm nay (giờ VN) dạng yyyy-mm-dd. */
export function vnToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now)
}

// Thông báo lỗi -------------------------------------------------------------------------

export type PayoutErrorCode =
  | 'missing_fields' | 'invalid_account'
  | 'not_active' | 'not_commission' | 'missing_bank' | 'below_min' | 'insufficient_balance' | 'invalid_amount'
  | 'not_found' | 'no_proof'
  | 'invalid_state' | 'reason_required' | 'ref_required' | 'invalid_date' | 'bad_type' | 'too_large'
  | 'upload_failed' | 'invalid_kind'

export const PAYOUT_ERROR_MESSAGES: Record<PayoutErrorCode, string> = {
  missing_fields: 'Nhập đủ tên ngân hàng, số tài khoản và chủ tài khoản (mỗi ô tối đa 120 ký tự)',
  invalid_account: 'Số tài khoản chỉ gồm chữ số, từ 6 đến 20 số',
  not_active: 'Tài khoản đối tác chưa được duyệt hoặc đã bị khóa',
  not_commission: 'Chỉ cộng tác viên hưởng hoa hồng mới rút tiền được',
  missing_bank: 'Khai thông tin ngân hàng trước khi rút tiền',
  below_min: 'Số tiền thấp hơn mức rút tối thiểu',
  insufficient_balance: 'Số dư không đủ',
  invalid_amount: 'Số tiền không hợp lệ',
  not_found: 'Không tìm thấy khoản chi',
  no_proof: 'Khoản chi này chưa có chứng từ',
  invalid_state: 'Khoản chi không ở trạng thái cho phép thao tác này',
  reason_required: 'Nhập lý do từ chối',
  ref_required: 'Nhập mã giao dịch',
  invalid_date: 'Ngày không hợp lệ (không được sau hôm nay)',
  bad_type: 'Chứng từ phải là ảnh JPG, PNG, WebP hoặc file PDF',
  too_large: 'Chứng từ tối đa 5MB',
  upload_failed: 'Không tải được chứng từ lên. Thử lại sau.',
  invalid_kind: 'Loại đợt chi không hợp lệ',
}
