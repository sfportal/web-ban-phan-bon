import { expect, test } from 'vitest'
import categories from '@/data/categories.json'
import products from '@/data/products.json'
import { validateDataset, type CategorySeed, type ProductSeed } from '@/lib/dataset/validate'
import { IMAGES } from '@/lib/media/images'

const cats = categories as CategorySeed[]
const prods = products as ProductSeed[]

test('bộ dữ liệu thật hợp lệ', () => expect(validateDataset(cats, prods)).toEqual([]))

test('đủ quy mô', () => {
  expect(cats.map((c) => c.slug)).toEqual(['npk', 'phan-don', 'huu-co', 'phan-bon-la', 'thuoc-bvtv', 'vat-tu'])
  expect(prods.length).toBeGreaterThanOrEqual(28)
  expect(prods.length).toBeLessThanOrEqual(32)
  expect(prods.filter((p) => p.is_featured)).toHaveLength(8)
  for (const c of cats) expect(prods.filter((p) => p.category === c.slug).length).toBeGreaterThanOrEqual(3)
})

test('validateDataset bắt lỗi', () => {
  const bad = [{ ...prods[0] }, { ...prods[0], list_price: 0, category: 'xyz', short_desc: '' }]
  expect(validateDataset(cats, bad)).toEqual(
    expect.arrayContaining([
      expect.stringContaining('SKU trùng'),
      expect.stringContaining('Giá không hợp lệ'),
      expect.stringContaining('Nhóm không tồn tại'),
      expect.stringContaining('Thiếu short_desc'),
    ]),
  )
})

test('validateDataset bắt lỗi crops rỗng và rates ngoài [0,100]', () => {
  const badCats = cats.map((c, i) => (i === 0 ? { ...c, rates: { ctv: 120, dai_ly: -1 } } : c))
  const badProds = [{ ...prods[0], crops: [] }]
  expect(validateDataset(badCats, badProds)).toEqual(
    expect.arrayContaining([expect.stringContaining('crops'), expect.stringContaining('rates')]),
  )
})

test('ảnh chỉ từ Unsplash/Pexels', () => {
  for (const img of Object.values(IMAGES)) {
    expect(img.url).toMatch(/^https:\/\/images\.(unsplash|pexels)\.com\//)
    expect(img.author).not.toBe('')
    expect(img.sourceUrl).toMatch(/^https:\/\/(unsplash|www\.pexels)\.com\//)
  }
})

test('mọi image_key của nhóm có trong IMAGES', () => {
  for (const c of cats) expect(IMAGES[c.image_key]).toBeDefined()
})
