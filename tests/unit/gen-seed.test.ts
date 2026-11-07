import { describe, expect, test } from 'vitest'
import categories from '@/data/categories.json'
import products from '@/data/products.json'
import type { CategorySeed, ProductSeed } from '@/lib/dataset/validate'
import { IMAGES } from '@/lib/media/images'
import { buildProductionUpdateSql, buildSeedSql, OLD_SAMPLE_SKUS, seedOverride } from '@/scripts/gen-seed'

const cats = categories as CategorySeed[]
const prods = products as ProductSeed[]

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1
/** Dòng lệnh đầu/cuối (bỏ dòng trống và chú thích). */
const statements = (sql: string) => sql.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('--'))

describe('buildSeedSql', () => {
  const sql = buildSeedSql(cats, prods, IMAGES)

  test('mỗi SKU đúng một lần, đủ 6 nhóm có slug và ảnh', () => {
    for (const p of prods) expect(count(sql, `'${p.sku}'`)).toBe(p.sku === seedOverride(cats, prods).sku ? 2 : 1)
    expect(sql).toContain('insert into public.categories')
    for (const c of cats) {
      expect(sql).toContain(`'${c.slug}'`)
      expect(sql).toContain(IMAGES[c.image_key].url)
    }
    expect(sql).not.toMatch(/undefined|NaN/)
  })

  test('2 bậc giữ tên cũ, tỷ lệ theo nhóm, 1 mức riêng theo sản phẩm', () => {
    expect(sql).toContain(`('CTV chuẩn', 'commission')`)
    expect(sql).toContain(`('Đại lý cấp 1', 'wholesale')`)
    for (const c of cats) {
      expect(sql).toContain(`('CTV chuẩn', '${c.slug}', ${c.rates.ctv.toFixed(2)})`)
      expect(sql).toContain(`('Đại lý cấp 1', '${c.slug}', ${c.rates.dai_ly.toFixed(2)})`)
    }
    const o = seedOverride(cats, prods)
    expect(o.sku).toBe(prods.find((p) => p.category === 'phan-bon-la')!.sku)
    expect(o.ratePct).toBe(cats.find((c) => c.slug === 'phan-bon-la')!.rates.ctv + 2)
    expect(sql).toContain('insert into public.tier_product_rates')
    expect(sql).toContain(`'store_name'`)
  })

  test("escape dấu ' và xuống dòng", () => {
    const p = { ...prods[0], sku: 'X-1', brand: "O'Neil", usage: 'dòng 1\ndòng 2', crops: ["Cà phê", "Lúa 'mới'"] }
    const out = buildSeedSql(cats, [p, prods.find((x) => x.category === 'phan-bon-la')!], IMAGES)
    expect(out).toContain(`'O''Neil'`)
    expect(out).toContain(`E'dòng 1\\ndòng 2'`)
    expect(out).toContain(`array['Cà phê', 'Lúa ''mới''']::text[]`)
    expect(out).not.toContain("O'Neil'")
  })
})

describe('buildProductionUpdateSql', () => {
  const sql = buildProductionUpdateSql(cats, prods, IMAGES)
  const lines = statements(sql)

  test('bọc transaction, upsert theo SKU, ẩn sản phẩm cũ có đơn, xóa sản phẩm cũ không đơn', () => {
    expect(lines[0]).toBe('begin;')
    expect(lines.at(-1)).toBe('commit;')
    expect(sql).toContain('on conflict (sku) do update')
    expect(sql).toContain('on conflict (slug) do update')
    expect(sql).toContain('on conflict (tier_id, category_id) do update')
    expect(sql).toMatch(/update public\.products p set is_active = false[\s\S]*exists \(select 1 from public\.order_lines/)
    expect(sql).toMatch(/delete from public\.products p[\s\S]*not exists \(select 1 from public\.order_lines/)
    for (const p of prods) expect(sql).toContain(`'${p.sku}'`)
    expect(sql).not.toMatch(/undefined|NaN/)
  })

  test('có chốt chạy một lần và lùi updated_price_at khi thêm mới', () => {
    expect(sql).toMatch(/do \$guard\$[\s\S]*raise exception 'Dừng:/)
    for (const k of OLD_SAMPLE_SKUS) expect(sql).toContain(`'${k}'`)
    expect(sql.indexOf('$guard$')).toBeLessThan(sql.indexOf('-- 1. Nhóm cũ'))
    expect(sql).toContain("now() - interval '30 days'")
    expect(sql).toMatch(/updated_price_at\)\nselect[\s\S]*on conflict \(sku\) do update/)
    expect(sql.split('on conflict (sku) do update')[1].split(';')[0]).not.toContain('updated_price_at')
    expect(buildSeedSql(cats, prods, IMAGES)).not.toContain('updated_price_at')
  })

  test('đổi nhóm cũ theo tên cũ sang slug mới', () => {
    for (const [oldName, slug] of [
      ['Phân NPK', 'npk'], ['Phân hữu cơ', 'huu-co'], ['Phân bón lá', 'phan-bon-la'],
      ['Thuốc BVTV', 'thuoc-bvtv'], ['Vật tư', 'vat-tu'],
    ]) {
      expect(sql).toContain(`('${oldName}', '${slug}')`)
    }
  })
})
