import 'server-only'
import { randomUUID } from 'node:crypto'
import { adminClient } from '@/lib/supabase/admin'
import { IMAGE_TYPES, imageExtension, MAX_IMAGE_BYTES, validateImage } from './image'

const BUCKET = 'products'

/**
 * Tải ảnh lên bucket public `products`; trả URL công khai hoặc ném lỗi (đã kiểm tra hợp lệ).
 * Bucket chưa có (môi trường mới) thì tạo rồi thử lại một lần.
 */
export async function uploadProductImage(productId: string, file: File): Promise<string> {
  const invalid = validateImage(file)
  if (invalid) throw new Error(invalid)
  const storage = adminClient().storage
  const path = `${productId}/${randomUUID()}.${imageExtension(file.type)}`
  const body = new Uint8Array(await file.arrayBuffer())
  const put = () => storage.from(BUCKET).upload(path, body, { contentType: file.type, cacheControl: '31536000' })

  let { error } = await put()
  if (error && /bucket not found/i.test(error.message)) {
    const created = await storage.createBucket(BUCKET, {
      public: true, fileSizeLimit: MAX_IMAGE_BYTES, allowedMimeTypes: [...IMAGE_TYPES],
    })
    if (created.error && !/already exists/i.test(created.error.message)) throw created.error
    ;({ error } = await put())
  }
  if (error) throw error
  return storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
