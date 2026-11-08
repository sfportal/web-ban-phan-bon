// npm run data:gen — sinh SQL từ data/categories.json + data/products.json:
//   supabase/seed.sql                    (local/test: db:reset chạy sau migrations)
//   supabase/data-update-production.sql  (bản thật đang chạy: chuyển dữ liệu mẫu MỘT LẦN — xem README)
//   supabase/setup-production.sql        (dự án Supabase mới: migrations + seed + bucket ảnh)
// Thứ tự trong SQL theo đúng thứ tự file JSON để diff dễ đọc.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import categoriesJson from '../data/categories.json'
import productsJson from '../data/products.json'
import { validateDataset, type CategorySeed, type ProductSeed } from '../lib/dataset/validate'
import { IMAGES, type ImageKey } from '../lib/media/images'

type Images = Record<ImageKey, { url: string }>

const GENERATED = '-- Sinh tự động bởi scripts/gen-seed.ts từ data/*.json (npm run data:gen) — không sửa tay.'

// Bậc đối tác giữ tên cũ (đối tác hiện có đã gán theo các bậc này).
const TIERS = [
  { name: 'CTV chuẩn', kind: 'commission', rate: 'ctv' },
  { name: 'Đại lý cấp 1', kind: 'wholesale', rate: 'dai_ly' },
] as const

// Tên nhóm trong bản thật cũ → slug mới.
const LEGACY_CATEGORY_NAMES: [oldName: string, slug: string][] = [
  ['Phân NPK', 'npk'],
  ['Phân hữu cơ', 'huu-co'],
  ['Phân bón lá', 'phan-bon-la'],
  ['Thuốc BVTV', 'thuoc-bvtv'],
  ['Vật tư', 'vat-tu'],
]

const STORE_NAME = 'Cửa hàng vật tư'
const BUCKET_SQL = `insert into storage.buckets (id, name, public) values ('products', 'products', true) on conflict (id) do nothing;`
// Chứng từ chi trả: riêng tư, chỉ xem qua signed URL do server tạo; jpg/png/webp/pdf ≤ 5MB.
const PROOF_BUCKET_SQL = `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payout-proofs', 'payout-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;`
/** Mức rút tối thiểu mặc định (VNĐ), setting min_payout. */
export const MIN_PAYOUT = 100000

// ---------------------------------------------------------------------------
// Literal SQL

/** Chuỗi SQL; có xuống dòng/gạch chéo thì dùng E'...' với \n. */
export function sqlString(s: string): string {
  const quoted = s.replace(/'/g, "''")
  if (!/[\n\r\\]/.test(s)) return `'${quoted}'`
  return `E'${quoted.replace(/\\/g, '\\\\').replace(/\r/g, '').replace(/\n/g, '\\n')}'`
}

function sqlTextArray(items: string[]): string {
  return items.length ? `array[${items.map(sqlString).join(', ')}]::text[]` : `'{}'::text[]`
}

function sqlInt(n: number): string {
  if (!Number.isSafeInteger(n)) throw new Error(`Không phải số nguyên: ${n}`)
  return String(n)
}

function sqlRate(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`Tỷ lệ không hợp lệ: ${n}`)
  return n.toFixed(2)
}

const rows = (items: string[][]) => items.map((r) => `  (${r.join(', ')})`).join(',\n')

// ---------------------------------------------------------------------------
// Khối dùng chung

function imageUrl(c: CategorySeed, images: Images): string {
  const img = images[c.image_key]
  if (!img) throw new Error(`Nhóm ${c.slug}: không có ảnh ${c.image_key}`)
  return img.url
}

function categoryValues(categories: CategorySeed[], images: Images): string {
  return rows(categories.map((c) => [sqlString(c.slug), sqlString(c.name), sqlInt(c.sort_order), sqlString(imageUrl(c, images))]))
}

const PRODUCT_COLS = 'sku, name, brand, unit, category_id, list_price, short_desc, composition, benefits, usage, crops, is_featured'

function productSelect(products: ProductSeed[], backdate = false): string {
  const values = rows(products.map((p) => [
    sqlString(p.sku), sqlString(p.name), sqlString(p.brand), sqlString(p.unit), sqlString(p.category),
    sqlInt(p.list_price), sqlString(p.short_desc), sqlString(p.composition), sqlString(p.benefits),
    sqlString(p.usage), sqlTextArray(p.crops), String(p.is_featured),
  ]))
  const extraCol = backdate ? ', updated_price_at' : ''
  const extraVal = backdate ? ", now() - interval '30 days'" : ''
  return `insert into public.products (${PRODUCT_COLS}${extraCol})
select v.sku, v.name, v.brand, v.unit, c.id, v.list_price, v.short_desc, v.composition, v.benefits, v.usage, v.crops, v.is_featured${extraVal}
from (values
${values}
) as v(sku, name, brand, unit, category, list_price, short_desc, composition, benefits, usage, crops, is_featured)
join public.categories c on c.slug = v.category`
}

function tierRateSelect(categories: CategorySeed[]): string {
  const values = rows(TIERS.flatMap((t) => categories.map((c) => [sqlString(t.name), sqlString(c.slug), sqlRate(c.rates[t.rate])])))
  return `insert into public.tier_rates (tier_id, category_id, rate_pct)
select t.id, c.id, v.rate_pct
from (values
${values}
) as v(tier, category, rate_pct)
join public.partner_tiers t on t.name = v.tier
join public.categories c on c.slug = v.category`
}

const tierValues = () => rows(TIERS.map((t) => [sqlString(t.name), sqlString(t.kind)]))

/** Mức "CTV chuẩn" riêng theo sản phẩm có trong seed: sản phẩm phân bón lá đầu tiên, = mức nhóm + 2. */
export function seedOverride(categories: CategorySeed[], products: ProductSeed[]): { sku: string; ratePct: number } {
  const p = products.find((x) => x.category === 'phan-bon-la')
  const c = categories.find((x) => x.slug === 'phan-bon-la')
  if (!p || !c) throw new Error('Cần nhóm phan-bon-la có ít nhất 1 sản phẩm để tạo mức riêng theo sản phẩm')
  return { sku: p.sku, ratePct: Math.min(100, c.rates.ctv + 2) }
}

// ---------------------------------------------------------------------------
// seed.sql

export function buildSeedSql(categories: CategorySeed[], products: ProductSeed[], images: Images): string {
  const override = seedOverride(categories, products)
  return `${GENERATED}
-- Dữ liệu cho local/test: nhóm (slug, ảnh), sản phẩm (giá tham khảo thị trường), 2 bậc đối tác
-- kèm tỷ lệ theo nhóm (và 1 mức riêng theo sản phẩm), tên cửa hàng, mức rút tối thiểu.
-- Không tạo user (auth.users giữ nguyên qua db:reset).

insert into public.categories (slug, name, sort_order, image_url) values
${categoryValues(categories, images)};

${productSelect(products)};

insert into public.partner_tiers (name, kind) values
${tierValues()};

${tierRateSelect(categories)};

-- Một mức riêng theo sản phẩm (ghi đè mức theo nhóm) làm mẫu.
insert into public.tier_product_rates (tier_id, product_id, rate_pct)
select t.id, p.id, ${sqlRate(override.ratePct)}
from public.partner_tiers t, public.products p
where t.name = ${sqlString(TIERS[0].name)} and p.sku = ${sqlString(override.sku)};

-- min_payout cũng được 0006 ghi; on conflict để chạy sau migrations không lỗi.
insert into public.settings (key, value) values
  ('store_name', to_jsonb(${sqlString(STORE_NAME)}::text)),
  ('min_payout', to_jsonb(${sqlInt(MIN_PAYOUT)}))
on conflict (key) do nothing;
`
}

// ---------------------------------------------------------------------------
// data-update-production.sql

/** 10 SKU của bộ sản phẩm mẫu cũ (supabase/seed.sql ở commit 3b20003). */
export const OLD_SAMPLE_SKUS = [
  'NPK-161616', 'NPK-201020', 'NPK-301010', 'HC-VISINH', 'HC-PHANBO',
  'LA-ROONG', 'LA-DUONGTRAI', 'BVTV-NAM', 'BVTV-SAU', 'VT-BINHXIT',
] as const

export function buildProductionUpdateSql(categories: CategorySeed[], products: ProductSeed[], images: Images): string {
  const slugs = new Set(categories.map((c) => c.slug))
  const bySlug = new Map(categories.map((c) => [c.slug, c]))
  const legacy = LEGACY_CATEGORY_NAMES.filter(([, slug]) => slugs.has(slug))
  const skuList = products.map((p) => `  ${sqlString(p.sku)}`).join(',\n')
  const oldSkuList = OLD_SAMPLE_SKUS.map((k) => `  ${sqlString(k)}`).join(',\n')
  const adopt = (pairs: [string, string][]) => `update public.categories c
set slug = v.slug, name = n.name, sort_order = n.sort_order, image_url = n.image_url
from (values
${rows(pairs.map(([name, slug]) => [sqlString(name), sqlString(slug)]))}
) as v(match_name, slug)
join (values
${categoryValues(pairs.map(([, slug]) => bySlug.get(slug)!), images)}
) as n(slug, name, sort_order, image_url) on n.slug = v.slug
where c.slug is null and c.name = v.match_name
  and not exists (select 1 from public.categories x where x.slug = v.slug);`

  return `begin;
${GENERATED}
-- Cập nhật dữ liệu Supabase bản thật sang bộ sản phẩm thật. Chạy SAU migration 0005, trong SQL Editor.
-- CHỈ CHẠY MỘT LẦN, khi chuyển bộ sản phẩm mẫu cũ sang bộ dữ liệu này. Đã thêm sản phẩm thật
-- thì KHÔNG chạy lại: bước 5 xóa mọi sản phẩm không có trong data/products.json và chưa có đơn.
-- Có sẵn bước 0 chặn chạy lại: dừng nếu có sản phẩm ngoài bộ mới và ngoài 10 sản phẩm mẫu cũ.
-- Sản phẩm mới thêm có updated_price_at lùi 30 ngày để không hiện hết ở "Đổi giá gần đây".
-- Không đụng tới đối tác, đơn hàng, cài đặt.
--  1. Nhóm cũ (theo tên cũ, rồi theo tên mới) được gắn slug, tên, ảnh, thứ tự mới — giữ id.
--  2. Thêm/cập nhật nhóm theo slug.
--  3. Bảo đảm 2 bậc đối tác; tỷ lệ theo nhóm upsert theo (bậc, nhóm).
--  4. Sản phẩm upsert theo SKU (giữ ảnh, còn hàng, hiển thị của sản phẩm đã có).
--  5. Sản phẩm có SKU ngoài bộ mới (kể cả sản phẩm thêm tay): có đơn → ẩn; không đơn → xóa
--     (kèm khuyến mãi theo sản phẩm đó).

-- 0. Chỉ cho chạy một lần: có sản phẩm ngoài bộ mới và ngoài 10 sản phẩm mẫu cũ thì dừng.
do $guard$
begin
  if exists (
    select 1 from public.products p
    where p.sku not in (
${skuList}
    )
      and p.sku not in (
${oldSkuList}
      )
  ) then
    raise exception 'Dừng: trong cơ sở dữ liệu có sản phẩm ngoài bộ dữ liệu mới và ngoài 10 sản phẩm mẫu cũ (có thể quản trị viên đã thêm). Script này chỉ chạy một lần khi chuyển dữ liệu; chạy lại sẽ xóa các sản phẩm đó.';
  end if;
end
$guard$;

-- 1. Nhóm cũ → slug mới
${adopt(legacy)}

${adopt(categories.map((c) => [c.name, c.slug]))}

-- 2. Nhóm theo slug
insert into public.categories (slug, name, sort_order, image_url) values
${categoryValues(categories, images)}
on conflict (slug) do update
set name = excluded.name, sort_order = excluded.sort_order, image_url = excluded.image_url;

-- 3. Bậc đối tác và tỷ lệ theo nhóm
insert into public.partner_tiers (name, kind) values
${tierValues()}
on conflict (name) do nothing;

${tierRateSelect(categories)}
on conflict (tier_id, category_id) do update set rate_pct = excluded.rate_pct;

-- 4. Sản phẩm theo SKU
${productSelect(products, true)}
on conflict (sku) do update
set name = excluded.name, brand = excluded.brand, unit = excluded.unit, category_id = excluded.category_id,
  list_price = excluded.list_price, short_desc = excluded.short_desc, composition = excluded.composition,
  benefits = excluded.benefits, usage = excluded.usage, crops = excluded.crops, is_featured = excluded.is_featured;

-- 5. Sản phẩm ngoài bộ mới
update public.products p set is_active = false
where p.is_active
  and p.sku not in (
${skuList}
  )
  and exists (select 1 from public.order_lines ol where ol.product_id = p.id);

with gone as (
  delete from public.products p
  where p.sku not in (
${skuList}
  )
    and not exists (select 1 from public.order_lines ol where ol.product_id = p.id)
  returning p.id
)
delete from public.promotions pr using gone where pr.scope = 'product' and pr.target_id = gone.id;

commit;
`
}

// ---------------------------------------------------------------------------
// setup-production.sql

export function buildSetupSql(migrations: { name: string; sql: string }[], seedSql: string): string {
  const parts = migrations.map((m) => `-- ===== supabase/migrations/${m.name} =====\n${m.sql.trimEnd()}\n`)
  const first = migrations[0]?.name.slice(0, 4)
  const last = migrations.at(-1)?.name.slice(0, 4)
  return `-- Cài đặt CSDL cho Supabase bản thật: chạy MỘT LẦN trong SQL Editor của dự án mới (trống).
-- Gồm migrations ${first}–${last}, dữ liệu (nhóm, sản phẩm, bậc đối tác, tỷ lệ, cài đặt), bucket ảnh
-- 'products' (công khai) và bucket chứng từ chi trả 'payout-proofs' (riêng tư).
${GENERATED}
-- Dự án đang chạy (đã có dữ liệu cũ): chạy từng migration còn thiếu (0005, 0006, …) và
-- data-update-production.sql (một lần, xem README); bucket 'payout-proofs' tạo bằng câu lệnh cuối file này.
begin;

${parts.join('\n')}
-- ===== supabase/seed.sql =====
${seedSql.trimEnd()}

${BUCKET_SQL}
${PROOF_BUCKET_SQL}
commit;
`
}

// ---------------------------------------------------------------------------

function main() {
  const categories = categoriesJson as CategorySeed[]
  const products = productsJson as ProductSeed[]
  const errors = validateDataset(categories, products)
  if (errors.length) {
    console.error(`Dữ liệu không hợp lệ:\n- ${errors.join('\n- ')}`)
    process.exit(1)
  }
  const dir = path.resolve('supabase') // npm run chạy ở thư mục gốc dự án
  const migDir = path.join(dir, 'migrations')
  const migrations = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()
    .map((name) => ({ name, sql: readFileSync(path.join(migDir, name), 'utf8') }))

  const seed = buildSeedSql(categories, products, IMAGES)
  writeFileSync(path.join(dir, 'seed.sql'), seed)
  writeFileSync(path.join(dir, 'data-update-production.sql'), buildProductionUpdateSql(categories, products, IMAGES))
  writeFileSync(path.join(dir, 'setup-production.sql'), buildSetupSql(migrations, seed))
  console.log(`[data] ${categories.length} nhóm, ${products.length} sản phẩm → seed.sql, data-update-production.sql, setup-production.sql`)
}

// Chỉ chạy khi gọi trực tiếp (tsx scripts/gen-seed.ts), không chạy khi test import.
if (process.argv[1] && /gen-seed\.ts$/.test(process.argv[1])) main()
