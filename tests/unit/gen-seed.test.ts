import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import categories from '@/data/categories.json'
import products from '@/data/products.json'
import type { CategorySeed, ProductSeed } from '@/lib/dataset/validate'
import { IMAGES } from '@/lib/media/images'
import {
  buildDeploySql, buildProductionUpdateSql, buildSeedSql, buildSetupSql, DEPLOY_MIGRATIONS, OLD_SAMPLE_SKUS, seedOverride,
} from '@/scripts/gen-seed'

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

  test('cài đặt min_payout = 100000, chạy sau migration 0006 không lỗi trùng khóa', () => {
    expect(sql).toContain(`('min_payout', to_jsonb(100000))`)
    expect(sql).toMatch(/'min_payout'[^;]*on conflict \(key\) do nothing;/)
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

describe('buildSetupSql', () => {
  const sql = buildSetupSql(
    [{ name: '0005_product_details.sql', sql: '-- a' }, { name: '0006_payouts.sql', sql: '-- b' }],
    buildSeedSql(cats, prods, IMAGES),
  )

  test('gồm migration 0006, bucket products công khai và payout-proofs riêng tư, trong transaction', () => {
    expect(sql).toContain('-- ===== supabase/migrations/0006_payouts.sql =====')
    expect(sql).toContain("values ('products', 'products', true)")
    expect(sql).toMatch(/values \('payout-proofs', 'payout-proofs', false, 5242880, array\['image\/jpeg', 'image\/png', 'image\/webp', 'application\/pdf'\]\)/)
    expect(sql.indexOf('payout-proofs')).toBeLessThan(sql.lastIndexOf('commit;'))
    expect(statements(sql).at(-1)).toBe('commit;')
  })
})

const SUPABASE = path.resolve(import.meta.dirname, '../../supabase')
const MIGRATIONS = readdirSync(path.join(SUPABASE, 'migrations')).filter((f) => f.endsWith('.sql')).sort()
  .map((name) => ({ name, sql: readFileSync(path.join(SUPABASE, 'migrations', name), 'utf8') }))
const generated = (name: string) => readFileSync(path.join(SUPABASE, name), 'utf8')

describe('buildDeploySql', () => {
  const sql = buildDeploySql(MIGRATIONS)
  const lines = statements(sql)

  test('một giao dịch: chốt chạy một lần → 0006, 0007, 0008 (đủ nội dung) → bucket chứng từ có giới hạn', () => {
    expect(lines[0]).toBe('begin;')
    expect(lines.at(-1)).toBe('commit;')
    expect(count(sql, 'begin;')).toBe(1)
    expect(count(sql, 'commit;')).toBe(1)
    expect(sql).toMatch(/do \$guard\$\s+begin\s+if to_regclass\('public\.payouts'\) is not null then\s+raise exception 'Dừng: đã chạy rồi/)
    const at = DEPLOY_MIGRATIONS.map((name) => sql.indexOf(`-- ===== supabase/migrations/${name} =====`))
    expect(DEPLOY_MIGRATIONS).toEqual(['0006_payouts.sql', '0007_demo_flag.sql', '0008_legacy_paid.sql'])
    expect(sql.indexOf('$guard$')).toBeLessThan(at[0])
    expect(at).toEqual([...at].sort((a, b) => a - b))
    for (const name of DEPLOY_MIGRATIONS) expect(sql).toContain(MIGRATIONS.find((m) => m.name === name)!.sql.trimEnd())
    for (const old of ['0001_schema.sql', '0005_product_details.sql']) expect(sql).not.toContain(`migrations/${old}`)
    const bucket = sql.indexOf("values ('payout-proofs', 'payout-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])")
    expect(bucket).toBeGreaterThan(at[2])
    expect(bucket).toBeLessThan(sql.lastIndexOf('commit;'))
  })

  test('thiếu migration → lỗi', () => {
    expect(() => buildDeploySql(MIGRATIONS.filter((m) => m.name !== '0008_legacy_paid.sql'))).toThrow(/0008_legacy_paid/)
  })
})

describe('file sinh sẵn khớp với generator (chạy npm run data:gen khi lệch)', () => {
  const seed = buildSeedSql(cats, prods, IMAGES)
  test.each([
    ['seed.sql', () => seed],
    ['data-update-production.sql', () => buildProductionUpdateSql(cats, prods, IMAGES)],
    ['setup-production.sql', () => buildSetupSql(MIGRATIONS, seed)],
    ['deploy-payouts-production.sql', () => buildDeploySql(MIGRATIONS)],
  ])('%s', (name, build) => {
    expect(generated(name)).toBe(build())
  })
})
