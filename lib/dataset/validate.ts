import type { ImageKey } from '@/lib/media/images'

export type CategorySeed = {
  slug: string
  name: string
  sort_order: number
  image_key: ImageKey
  /** % chiết khấu cho bậc "CTV chuẩn" và "Đại lý cấp 1". */
  rates: { ctv: number; dai_ly: number }
}

export type ProductSeed = {
  sku: string
  name: string
  brand: string
  unit: string
  /** slug của nhóm */
  category: string
  list_price: number
  short_desc: string
  composition: string
  benefits: string
  usage: string
  crops: string[]
  is_featured: boolean
}

const REQUIRED_TEXT = ['name', 'brand', 'unit', 'short_desc', 'composition', 'benefits', 'usage'] as const

/** Kiểm tra bộ dữ liệu seed; trả về danh sách lỗi (rỗng = hợp lệ). */
export function validateDataset(categories: CategorySeed[], products: ProductSeed[]): string[] {
  const errors: string[] = []
  const slugs = new Set<string>()

  for (const c of categories) {
    if (slugs.has(c.slug)) errors.push(`Nhóm trùng slug: ${c.slug}`)
    slugs.add(c.slug)
    for (const [tier, rate] of Object.entries(c.rates ?? {})) {
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 100) {
        errors.push(`Nhóm ${c.slug}: rates.${tier} ngoài [0,100] (${rate})`)
      }
    }
  }

  const skus = new Set<string>()
  for (const p of products) {
    const id = p.sku || '(không SKU)'
    if (!p.sku) errors.push('Thiếu sku')
    else if (skus.has(p.sku)) errors.push(`SKU trùng: ${p.sku}`)
    skus.add(p.sku)

    if (!Number.isInteger(p.list_price) || p.list_price <= 0) {
      errors.push(`${id}: Giá không hợp lệ (${p.list_price})`)
    }
    if (!slugs.has(p.category)) errors.push(`${id}: Nhóm không tồn tại (${p.category})`)
    for (const field of REQUIRED_TEXT) {
      const value = p[field]
      if (typeof value !== 'string' || value.trim() === '') errors.push(`${id}: Thiếu ${field}`)
    }
    if (!Array.isArray(p.crops) || p.crops.length === 0) errors.push(`${id}: crops phải có ít nhất 1 cây trồng`)
  }

  return errors
}
