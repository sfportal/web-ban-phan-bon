import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProductInput, PromotionInput, TierInput } from '@/lib/pricing'
import type { Database } from '@/lib/supabase/database.types'

type Db = SupabaseClient<Database>

export type CatalogProduct = ProductInput & {
  sku: string
  name: string
  unit: string
  imageUrl: string | null
  description: string | null
  categoryName: string
  updatedPriceAt: Date
}

const PRODUCT_COLUMNS =
  'id, sku, name, unit, category_id, list_price, image_url, in_stock, is_active, description, updated_price_at, categories(name, sort_order)'

type ProductRow = Database['public']['Tables']['products']['Row'] & {
  categories: { name: string; sort_order: number } | null
}

// bigint/numeric có thể về dạng chuỗi tùy cấu hình; ép về số nguyên VNĐ / số thực.
function toInt(n: number | string): number {
  return Math.round(Number(n))
}

function toProduct(row: ProductRow): CatalogProduct {
  return {
    id: row.id,
    categoryId: row.category_id,
    listPrice: toInt(row.list_price),
    inStock: row.in_stock,
    isActive: row.is_active,
    sku: row.sku,
    name: row.name,
    unit: row.unit,
    imageUrl: row.image_url,
    description: row.description,
    categoryName: row.categories?.name ?? '',
    updatedPriceAt: new Date(row.updated_price_at),
  }
}

function sortProducts(rows: ProductRow[]): ProductRow[] {
  return [...rows].sort(
    (a, b) =>
      (a.categories?.sort_order ?? 0) - (b.categories?.sort_order ?? 0) ||
      (a.categories?.name ?? '').localeCompare(b.categories?.name ?? '', 'vi') ||
      a.name.localeCompare(b.name, 'vi'),
  )
}

/** Sản phẩm đang bán (is_active), nhóm, khuyến mãi đang bật. Chạy dưới RLS của client truyền vào. */
export async function getCatalog(db: Db): Promise<{
  products: CatalogProduct[]
  categories: { id: string; name: string }[]
  promos: PromotionInput[]
}> {
  const [products, categories, promos] = await Promise.all([
    db.from('products').select(PRODUCT_COLUMNS).eq('is_active', true).throwOnError(),
    db.from('categories').select('id, name').order('sort_order').order('name').throwOnError(),
    getActivePromos(db),
  ])
  return {
    products: sortProducts(products.data as unknown as ProductRow[]).map(toProduct),
    categories: categories.data,
    promos,
  }
}

/** Khuyến mãi đang bật (còn hiệu lực hay không do `salePrice` xét theo `now`). */
export async function getActivePromos(db: Db): Promise<PromotionInput[]> {
  const { data } = await db.from('promotions').select('*').eq('is_active', true).throwOnError()
  return data.map((p) => ({
    id: p.id,
    scope: p.scope,
    targetId: p.target_id,
    type: p.type,
    value: Number(p.value),
    startsAt: new Date(p.starts_at),
    endsAt: new Date(p.ends_at),
    isActive: p.is_active,
  }))
}

/**
 * Lấy sản phẩm theo id, KỂ CẢ sản phẩm không active để server phát hiện hàng bị ẩn.
 * RLS của anon/đối tác ẩn các sản phẩm đó, nên chỉ dùng phía server với `adminClient()`
 * (service role); không bao giờ gọi với client của trình duyệt.
 */
export async function getProductsByIds(db: Db, ids: string[]): Promise<CatalogProduct[]> {
  if (ids.length === 0) return []
  const { data } = await db.from('products').select(PRODUCT_COLUMNS).in('id', ids).throwOnError()
  return (data as unknown as ProductRow[]).map(toProduct)
}

/** Loại bậc và tỷ lệ (%) theo nhóm / theo sản phẩm của một bậc đối tác. */
export async function getTier(db: Db, tierId: string): Promise<TierInput> {
  const [tier, byCategory, byProduct] = await Promise.all([
    db.from('partner_tiers').select('kind').eq('id', tierId).single().throwOnError(),
    db.from('tier_rates').select('category_id, rate_pct').eq('tier_id', tierId).throwOnError(),
    db.from('tier_product_rates').select('product_id, rate_pct').eq('tier_id', tierId).throwOnError(),
  ])
  return {
    kind: tier.data.kind,
    byCategory: Object.fromEntries(byCategory.data.map((r) => [r.category_id, Number(r.rate_pct)])),
    byProduct: Object.fromEntries(byProduct.data.map((r) => [r.product_id, Number(r.rate_pct)])),
  }
}

/** Cài đặt công khai (RLS cho anon đọc store_name, bank_info, zalo_link). */
export async function getPublicSettings(db: Db): Promise<{ storeName: string | null; zaloLink: string | null }> {
  const { data } = await db.from('settings').select('key, value').in('key', ['store_name', 'zalo_link']).throwOnError()
  const str = (key: string) => {
    const v = data.find((r) => r.key === key)?.value
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }
  return { storeName: str('store_name'), zaloLink: str('zalo_link') }
}
