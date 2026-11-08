import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { MAX_PROOF_BYTES, PROOF_TYPES, proofExtension, validateProof } from './validate'

// Chứng từ chuyển khoản trong bucket riêng tư `payout-proofs`. Đường dẫn trong bucket:
// <partner_id>/<payout_id>.<ext> (lưu ở payouts.proof_path). Chỉ server (service role) đọc/ghi;
// người dùng xem qua signed URL 300 giây sau khi Server Action kiểm tra quyền.
export const PROOF_BUCKET = 'payout-proofs'
export const SIGNED_URL_SECONDS = 300

export function proofPath(partnerId: string, payoutId: string, type: string): string {
  return `${partnerId}/${payoutId}.${proofExtension(type)}`
}

/**
 * Tải chứng từ (đã kiểm tra bằng validateProof) lên; ghi đè nếu đã có. Trả đường dẫn trong
 * bucket hoặc ném lỗi. Bucket chưa có (môi trường mới) thì tạo (private) rồi thử lại một lần.
 */
export async function uploadProof(partnerId: string, payoutId: string, file: File): Promise<string> {
  const invalid = validateProof(file)
  if (invalid !== 'ok') throw new Error(invalid)
  const storage = adminClient().storage
  const path = proofPath(partnerId, payoutId, file.type)
  const body = new Uint8Array(await file.arrayBuffer())
  const put = () => storage.from(PROOF_BUCKET).upload(path, body, { contentType: file.type, upsert: true })

  let { error } = await put()
  if (error && /bucket not found/i.test(error.message)) {
    const created = await storage.createBucket(PROOF_BUCKET, {
      public: false, fileSizeLimit: MAX_PROOF_BYTES, allowedMimeTypes: [...PROOF_TYPES],
    })
    if (created.error && !/already exists/i.test(created.error.message)) throw created.error
    ;({ error } = await put())
  }
  if (error) throw error
  return path
}

/** Xóa chứng từ (dọn file mồ côi khi ghi DB lỗi). Không throw. */
export async function removeProof(path: string): Promise<void> {
  try {
    const { error } = await adminClient().storage.from(PROOF_BUCKET).remove([path])
    if (error) console.error('removeProof', error)
  } catch (e) {
    console.error('removeProof', e)
  }
}

/** Signed URL 300 giây cho `path`; người gọi phải kiểm tra quyền trước. Ném lỗi nếu Storage lỗi. */
export async function signedProofUrl(path: string): Promise<string> {
  const { data, error } = await adminClient().storage.from(PROOF_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS)
  if (error) throw error
  return data.signedUrl
}
