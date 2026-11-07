// supabase/data-update-production.sql: chạy trên DB đã có seed mới (và dạng "bản thật cũ"
// mô phỏng: nhóm mang tên cũ, chưa có slug), chạy hai lần không lỗi.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { IMAGES } from '@/lib/media/images'
import { CATEGORIES, category, PRODUCTS } from '../support/dataset'

const SQL = readFileSync(path.resolve(import.meta.dirname, '../../supabase/data-update-production.sql'), 'utf8')
const db = new pg.Client('postgres://postgres:postgres@127.0.0.1:54322/postgres')

const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T | undefined> =>
  (await db.query(sql, args)).rows[0] as T | undefined

async function cleanup() {
  await db.query(`delete from public.orders where code = 'TEST-PROD-UPD'`)
  await db.query(`delete from public.products where sku in ('NPK-161616', 'HC-PHANBO', 'ZZ-ADMIN')`)
}

let laId: string
let vtId: string
const SAMPLE = PRODUCTS[0]
const NEWP = PRODUCTS[1]

beforeAll(async () => {
  await db.connect()
  await cleanup()
  const npk = (await one<{ id: string }>(`select id from public.categories where slug = 'npk'`))!.id
  // Hai SKU mẫu cũ (được phép): NPK-161616 có đơn (giữ lại, ẩn), HC-PHANBO không đơn (xóa).
  const old1 = (await one<{ id: string }>(
    `insert into public.products (sku, name, unit, category_id, list_price) values ('NPK-161616', 'Mẫu cũ 1', 'bao', $1, 1000) returning id`, [npk],
  ))!.id
  await db.query(`insert into public.products (sku, name, unit, category_id, list_price) values ('HC-PHANBO', 'Mẫu cũ 2', 'bao', $1, 1000)`, [npk])
  const order = (await one<{ id: string }>(
    `insert into public.orders (code, source, retail_name, retail_phone, subtotal, total_qty)
     values ('TEST-PROD-UPD', 'retail', 'Khách', '0911111111', 1000, 1) returning id`,
  ))!.id
  await db.query(
    `insert into public.order_lines (order_id, product_id, qty, list_price_snap, sale_price_snap, line_total)
     values ($1, $2, 1, 1000, 1000, 1000)`, [order, old1],
  )

  // Mô phỏng nhóm của bản thật cũ: tên cũ, chưa có slug/ảnh; tỷ lệ và giá bị lệch.
  laId = (await one<{ id: string }>(
    `update public.categories set slug = null, image_url = null, name = 'Phân bón lá', sort_order = 3 where slug = 'phan-bon-la' returning id`,
  ))!.id
  vtId = (await one<{ id: string }>(
    `update public.categories set slug = null, image_url = null, name = 'Vật tư', sort_order = 5 where slug = 'vat-tu' returning id`,
  ))!.id
  await db.query(`update public.tier_rates set rate_pct = 99 where category_id = $1`, [laId])
  await db.query(`delete from public.tier_rates where category_id = $1`, [vtId])
  // Một sản phẩm của bộ mới "chưa có" trên bản thật: script phải thêm và lùi updated_price_at 30 ngày.
  await db.query(`delete from public.products where sku = $1`, [NEWP.sku])
  await db.query(`update public.products set list_price = 1, brand = null, crops = '{}' where sku = $1`, [SAMPLE.sku])
})

afterAll(async () => {
  await cleanup()
  await db.end()
})

test('chạy hai lần không lỗi; ẩn sản phẩm cũ có đơn, xóa sản phẩm cũ không đơn; khớp data/*.json', async () => {
  await db.query(SQL)
  await db.query(SQL)

  expect(await one(`select is_active from public.products where sku = 'NPK-161616'`)).toEqual({ is_active: false })
  expect(await one(`select 1 from public.products where sku = 'HC-PHANBO'`)).toBeUndefined()
  const active = await one<{ n: number }>(`select count(*)::int as n from public.products where is_active`)
  expect(active!.n).toBe(PRODUCTS.length)

  // Nhóm cũ được gắn slug/tên/ảnh mới, giữ nguyên id (sản phẩm và tỷ lệ vẫn trỏ đúng).
  const cats = (await db.query(`select id, slug, name, sort_order, image_url from public.categories order by sort_order`)).rows
  expect(cats.map((c) => c.slug)).toEqual(CATEGORIES.map((c) => c.slug))
  for (const c of CATEGORIES) {
    expect(cats.find((x) => x.slug === c.slug)).toMatchObject({ name: c.name, sort_order: c.sort_order, image_url: IMAGES[c.image_key].url })
  }
  expect(cats.find((x) => x.slug === 'phan-bon-la')!.id).toBe(laId)
  expect(cats.find((x) => x.slug === 'vat-tu')!.id).toBe(vtId)

  const rates = (await db.query(
    `select t.name as tier, c.slug, r.rate_pct::float as rate
     from public.tier_rates r join public.partner_tiers t on t.id = r.tier_id join public.categories c on c.id = r.category_id`,
  )).rows
  expect(rates).toHaveLength(CATEGORIES.length * 2)
  for (const c of CATEGORIES) {
    expect(rates).toContainEqual({ tier: 'CTV chuẩn', slug: c.slug, rate: c.rates.ctv })
    expect(rates).toContainEqual({ tier: 'Đại lý cấp 1', slug: c.slug, rate: c.rates.dai_ly })
  }

  expect(await one(`select list_price::int as list_price, brand, crops, c.slug from public.products p join public.categories c on c.id = p.category_id where sku = $1`, [SAMPLE.sku]))
    .toEqual({ list_price: SAMPLE.list_price, brand: SAMPLE.brand, crops: SAMPLE.crops, slug: SAMPLE.category })
  expect(category('phan-bon-la').name).not.toBe('Phân bón lá')
})

test('sản phẩm thêm mới được lùi updated_price_at 30 ngày, sản phẩm đã có không bị lùi', async () => {
  await db.query(SQL)
  const added = await one<{ days: number }>(
    `select extract(epoch from now() - updated_price_at)/86400 as days from public.products where sku = $1`, [NEWP.sku])
  expect(Number(added!.days)).toBeGreaterThan(29)
  // SAMPLE đã có, giá bị đổi lại về giá chuẩn => trigger đặt updated_price_at = now(), không bị lùi.
  const existing = await one<{ days: number }>(
    `select extract(epoch from now() - updated_price_at)/86400 as days from public.products where sku = $1`, [SAMPLE.sku])
  expect(Number(existing!.days)).toBeLessThan(1)
})

test('chặn chạy lại: có sản phẩm ngoài bộ mới và ngoài 10 sản phẩm mẫu cũ thì dừng, không xóa gì', async () => {
  const npk = (await one<{ id: string }>(`select id from public.categories where slug = 'npk'`))!.id
  await db.query(`insert into public.products (sku, name, unit, category_id, list_price) values ('ZZ-ADMIN', 'Admin thêm', 'bao', $1, 1000)`, [npk])
  await expect(db.query(SQL)).rejects.toThrow(/chỉ chạy một lần/)
  await db.query('rollback') // script tự mở transaction (begin;) nên lỗi để lại giao dịch đã hủy
  expect(await one(`select 1 from public.products where sku = 'ZZ-ADMIN'`)).toBeDefined()
  await db.query(`delete from public.products where sku = 'ZZ-ADMIN'`)
})
