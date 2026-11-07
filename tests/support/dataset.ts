// Bộ dữ liệu seed (data/*.json) cho test tích hợp và E2E: lấy tên/giá/tỷ lệ từ đây thay vì hằng số cứng.
import categoriesJson from '../../data/categories.json'
import productsJson from '../../data/products.json'
import type { CategorySeed, ProductSeed } from '../../lib/dataset/validate'
import { seedOverride } from '../../scripts/gen-seed'

export const CATEGORIES = categoriesJson as CategorySeed[]
export const PRODUCTS = productsJson as ProductSeed[]

export function category(slug: string): CategorySeed {
  const c = CATEGORIES.find((x) => x.slug === slug)
  if (!c) throw new Error(`Không có nhóm ${slug} trong data/categories.json`)
  return c
}

export function productsIn(slug: string): ProductSeed[] {
  return PRODUCTS.filter((p) => p.category === slug)
}

export function product(sku: string): ProductSeed {
  const p = PRODUCTS.find((x) => x.sku === sku)
  if (!p) throw new Error(`Không có SKU ${sku} trong data/products.json`)
  return p
}

/** Mức "CTV chuẩn" riêng theo sản phẩm mà seed tạo (ghi đè mức theo nhóm). */
export const OVERRIDE = seedOverride(CATEGORIES, PRODUCTS)
