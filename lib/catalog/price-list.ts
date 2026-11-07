import { connection } from 'next/server'
import { getCatalog, getPublicSettings } from '@/lib/catalog/queries'
import { salePrice } from '@/lib/pricing'
import { SITE_NAME } from '@/lib/site'
import { createServerClient } from '@/lib/supabase/server'

export type PriceListRow = { id: string; name: string; unit: string; price: number; updatedPriceAt: Date; inStock: boolean }

export type PriceList = {
  storeName: string
  categories: { id: string; name: string }[]
  /** Nhóm đang lọc (null = tất cả). */
  category: { id: string; name: string } | null
  groups: { categoryName: string; rows: PriceListRow[] }[]
  now: Date
}

/**
 * Bảng giá công khai (/bang-gia, /bang-gia/anh): giá bán lẻ hiện tại (đã áp khuyến mãi) của
 * sản phẩm đang bán, nhóm theo nhóm sản phẩm. Không có hoa hồng/chiết khấu. `nhom` lạ → tất cả.
 */
export async function getPriceList(nhom: unknown): Promise<PriceList> {
  await connection() // giá theo thời điểm xem (khuyến mãi bắt đầu/hết hạn): luôn tính lúc request
  const db = createServerClient()
  const [catalog, settings] = await Promise.all([getCatalog(db), getPublicSettings(db)])
  const now = new Date()
  const category = catalog.categories.find((c) => c.id === nhom) ?? null

  const groups: PriceList['groups'] = []
  for (const p of catalog.products) {
    if (category && p.categoryId !== category.id) continue
    let g = groups.find((x) => x.categoryName === p.categoryName)
    if (!g) groups.push((g = { categoryName: p.categoryName, rows: [] }))
    g.rows.push({
      id: p.id, name: p.name, unit: p.unit, price: salePrice(p, catalog.promos, now).price,
      updatedPriceAt: p.updatedPriceAt, inStock: p.inStock,
    })
  }
  return {
    storeName: settings.storeName ?? SITE_NAME,
    categories: catalog.categories.filter((c) => catalog.products.some((p) => p.categoryId === c.id)),
    category,
    groups,
    now,
  }
}
