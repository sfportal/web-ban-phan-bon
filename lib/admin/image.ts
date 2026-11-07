// Kiểm tra ảnh sản phẩm (thuần, dùng cả ở test). Việc tải lên nằm ở product-image.ts.
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Trả về thông báo lỗi (tiếng Việt) hoặc null nếu ảnh hợp lệ. */
export function validateImage(file: { type: string; size: number }): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return 'Ảnh phải là JPG, PNG hoặc WebP'
  if (file.size <= 0) return 'File ảnh rỗng'
  if (file.size > MAX_IMAGE_BYTES) return 'Ảnh tối đa 2MB'
  return null
}

export function imageExtension(type: string): string {
  return EXT[type] ?? 'bin'
}

/** Link ảnh nhập tay: rỗng → null; chỉ nhận http/https, ngược lại ném lỗi. */
export function parseImageLink(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Link ảnh không hợp lệ')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Link ảnh phải bắt đầu bằng http hoặc https')
  return value
}
