import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { PackageArt } from '@/components/PackageArt'
import { ProductImage } from '@/components/ProductImage'
import { categoryColors, npkRatio, oneLine, packageShape, shortLabel } from '@/lib/media/package-art'

describe('packageShape', () => {
  test.each([['bao 50kg', 'bag'], ['Bao 25 kg', 'bag'], ['chai 1L', 'bottle'], ['chai 500ml', 'bottle'], ['lọ 100ml', 'bottle'],
    ['gói 100g', 'pouch'], ['túi 1kg', 'pouch'], ['cuộn 100m', 'roll'], ['cái', 'box'], ['bộ', 'box'], ['xyz', 'bag']])(
    'packageShape(%s)', (u, s) => expect(packageShape(u)).toBe(s))

  test('không phân biệt hoa thường và dấu', () => {
    expect(packageShape('CHAI 1 LIT')).toBe('bottle')
    expect(packageShape('Goi 50g')).toBe('pouch')
    expect(packageShape('THÙNG 12 chai')).toBe('bottle') // "chai" xét trước "thùng"
    expect(packageShape('can 5 lít')).toBe('bottle')
    expect(packageShape('Chiếc')).toBe('box')
  })

  test('mọi quy cách trong data/products.json ra đúng hình', () => {
    const products = JSON.parse(readFileSync(path.resolve('data/products.json'), 'utf8')) as { unit: string }[]
    const intended: Record<string, ReturnType<typeof packageShape>> = {
      'bao 50kg': 'bag', 'bao 25kg': 'bag', 'bao 15kg': 'bag', 'bao 20 lít': 'bag',
      'chai 1 lít': 'bottle', 'chai 1,25 lít': 'bottle', 'chai 100ml': 'bottle', 'chai 900ml': 'bottle',
      'gói 50g': 'pouch', 'gói 120g': 'pouch', 'gói 20g': 'pouch',
      'cái': 'box', 'cuộn': 'roll',
    }
    const units = [...new Set(products.map((p) => p.unit))]
    for (const u of units) {
      expect(intended, `quy cách mới chưa khai báo: ${u}`).toHaveProperty([u])
      expect(packageShape(u), u).toBe(intended[u])
    }
  })
})

test('npkRatio', () => {
  expect(npkRatio('NPK 20-20-15 Đầu Trâu')).toBe('20-20-15')
  expect(npkRatio('NPK 16-16-8+TE')).toBe('16-16-8')
  expect(npkRatio('Urê Phú Mỹ')).toBeNull()
})

test('categoryColors: 6 nhóm có màu riêng, còn lại dùng mặc định', () => {
  const slugs = ['npk', 'phan-don', 'huu-co', 'phan-bon-la', 'thuoc-bvtv', 'vat-tu']
  const bands = new Set(slugs.map((s) => categoryColors(s).band))
  expect(bands.size).toBe(6)
  expect(categoryColors(null)).toEqual(categoryColors('khong-co'))
  expect(bands.has(categoryColors(null).band)).toBe(false)
  for (const s of [...slugs, null]) {
    const c = categoryColors(s)
    for (const v of [c.bg, c.fg, c.band]) expect(v).toMatch(/^#[0-9a-f]{6}$/)
  }
})

describe('shortLabel', () => {
  test('cắt 2 dòng', () => {
    const l = shortLabel('Phân bón hữu cơ vi sinh cao cấp chuyên dùng cho cây ăn trái và cây công nghiệp dài ngày')
    expect(l.length).toBe(2)
    expect(l.every((x) => x.length <= 28)).toBe(true)
    expect(l[1].endsWith('…')).toBe(true)
  })
  test('tên ngắn giữ 1 dòng, không thêm …', () => {
    expect(shortLabel('Urê Phú Mỹ')).toEqual(['Urê Phú Mỹ'])
  })
  test('ngắt theo từ, vừa 2 dòng thì không có …', () => {
    expect(shortLabel('Kali clorua Canada dạng bột', 14)).toEqual(['Kali clorua', 'Canada dạng…'])
    expect(shortLabel('Kali clorua Canada', 12)).toEqual(['Kali clorua', 'Canada'])
  })
  test('từ quá dài bị cắt cứng', () => {
    const l = shortLabel('Siêuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu', 10)
    expect(l.every((x) => x.length <= 10)).toBe(true)
  })
})

test('oneLine: thừa thì cắt theo từ và thêm …', () => {
  expect(oneLine('Phú Mỹ', 16)).toBe('Phú Mỹ')
  expect(oneLine('Bình Điền (Đầu Trâu)', 16)).toBe('Bình Điền (Đầu…')
  expect(oneLine('Bình Điền (Đầu Trâu)', 16).length).toBeLessThanOrEqual(16)
})

describe('PackageArt', () => {
  test('render PackageArt có aria-label', () => {
    const html = renderToStaticMarkup(<PackageArt name="NPK 20-20-15" brand="Đầu Trâu" unit="bao 50kg" categorySlug="npk" />)
    expect(html).toContain('aria-label="NPK 20-20-15 — bao 50kg"')
    expect(html).toContain('20-20-15')
    expect(html).not.toContain('undefined')
  })
  test('SVG 200x240, role img, có thương hiệu và quy cách, không undefined khi thiếu brand/slug', () => {
    const html = renderToStaticMarkup(<PackageArt name="Màng phủ nông nghiệp" brand={null} unit="cuộn" categorySlug={null} />)
    expect(html).toContain('viewBox="0 0 200 240"')
    expect(html).toContain('role="img"')
    expect(html).toContain('cuộn')
    expect(html).toContain('data-shape="roll"')
    expect(html).not.toMatch(/undefined|null/)
  })
  test.each(['bao 50kg', 'chai 1 lít', 'gói 50g', 'cuộn', 'cái'])('vẽ được hình cho %s', (unit) => {
    const html = renderToStaticMarkup(<PackageArt name="Sản phẩm thử" brand="Hãng" unit={unit} categorySlug="vat-tu" />)
    expect(html).toContain(`data-shape="${packageShape(unit)}"`)
    expect(html).toContain('Hãng')
  })
})

describe('ProductImage', () => {
  test('không có ảnh → dùng PackageArt', () => {
    const html = renderToStaticMarkup(<ProductImage url={null} name="Urê Phú Mỹ" unit="bao 50kg" brand="Phú Mỹ" categorySlug="phan-don" />)
    expect(html).toContain('aria-label="Urê Phú Mỹ — bao 50kg"')
    expect(html).toContain('data-shape="bag"')
  })
  test('props cũ (không unit/brand) vẫn chạy', () => {
    const html = renderToStaticMarkup(<ProductImage url={null} name="Urê" className="h-20" />)
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Urê"')
    expect(html).not.toMatch(/undefined|null/)
  })
  test('có ảnh → thẻ img', () => {
    const html = renderToStaticMarkup(<ProductImage url="https://a.vn/x.jpg" name="Urê" />)
    expect(html).toContain('<img')
    expect(html).toContain('alt="Urê"')
  })
})
