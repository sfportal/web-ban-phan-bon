import { afterEach, beforeAll, describe, expect, test } from 'vitest'
import { getCatalog, getProductsByIds, getTier } from '@/lib/catalog/queries'
import { adminClient, anonClient } from './helpers'

const created: { products: string[]; promos: string[] } = { products: [], promos: [] }

afterEach(async () => {
  const admin = adminClient()
  if (created.promos.length) await admin.from('promotions').delete().in('id', created.promos).throwOnError()
  if (created.products.length) await admin.from('products').delete().in('id', created.products).throwOnError()
  created.products = []
  created.promos = []
})

let categoryId: string
beforeAll(async () => {
  const { data } = await adminClient().from('categories').select('id').eq('name', 'Phân NPK').single().throwOnError()
  categoryId = data.id
})

async function addProduct(sku: string, isActive: boolean) {
  const { data } = await adminClient()
    .from('products')
    .insert({ sku, name: `SP ${sku}`, unit: 'bao', category_id: categoryId, list_price: 100000, is_active: isActive })
    .select('id').single().throwOnError()
  created.products.push(data.id)
  return data.id
}

async function addPromo(productId: string, isActive: boolean) {
  const { data } = await adminClient()
    .from('promotions')
    .insert({
      name: `KM ${isActive}`, scope: 'product', target_id: productId, type: 'percent', value: 10,
      starts_at: '2020-01-01T00:00:00Z', ends_at: '2099-01-01T00:00:00Z', is_active: isActive,
    })
    .select('id').single().throwOnError()
  created.promos.push(data.id)
  return data.id
}

describe('getCatalog', () => {
  test('client anon không thấy sản phẩm ẩn; ánh xạ đúng kiểu', async () => {
    const hidden = await addProduct('TEST-HIDDEN', false)
    const shown = await addProduct('TEST-SHOWN', true)
    const { products, categories } = await getCatalog(anonClient())

    expect(products.map((p) => p.id)).not.toContain(hidden)
    const p = products.find((x) => x.id === shown)!
    expect(p).toMatchObject({
      sku: 'TEST-SHOWN', name: 'SP TEST-SHOWN', unit: 'bao', categoryId, listPrice: 100000,
      inStock: true, isActive: true, imageUrl: null, categoryName: 'Phân NPK',
    })
    expect(Number.isInteger(p.listPrice)).toBe(true)
    expect(p.updatedPriceAt).toBeInstanceOf(Date)
    expect(categories.map((c) => c.name)).toEqual(['Phân NPK', 'Phân hữu cơ', 'Phân bón lá', 'Thuốc BVTV', 'Vật tư'])
  })

  test('chỉ lấy sản phẩm active, kể cả với client admin; sắp theo nhóm rồi tên', async () => {
    const hidden = await addProduct('TEST-HIDDEN2', false)
    const { products } = await getCatalog(adminClient())
    expect(products.map((p) => p.id)).not.toContain(hidden)
    const keys = products.map((p) => [p.categoryName, p.name])
    const order = ['Phân NPK', 'Phân hữu cơ', 'Phân bón lá', 'Thuốc BVTV', 'Vật tư']
    for (let i = 1; i < keys.length; i++) {
      const [c0, n0] = keys[i - 1]
      const [c1, n1] = keys[i]
      const d = order.indexOf(c0) - order.indexOf(c1)
      expect(d < 0 || (d === 0 && n0.localeCompare(n1, 'vi') <= 0)).toBe(true)
    }
  })

  test('chỉ trả khuyến mãi is_active', async () => {
    const pid = await addProduct('TEST-PROMO', true)
    const on = await addPromo(pid, true)
    const off = await addPromo(pid, false)
    for (const db of [anonClient(), adminClient()]) {
      const { promos } = await getCatalog(db)
      const ids = promos.map((p) => p.id)
      expect(ids).toContain(on)
      expect(ids).not.toContain(off)
      const promo = promos.find((p) => p.id === on)!
      expect(promo).toMatchObject({ scope: 'product', targetId: pid, type: 'percent', value: 10, isActive: true })
      expect(promo.startsAt).toBeInstanceOf(Date)
      expect(promo.endsAt.getUTCFullYear()).toBe(2099)
    }
  })
})

describe('getProductsByIds', () => {
  test('trả cả sản phẩm không active khi dùng service role', async () => {
    const hidden = await addProduct('TEST-HID3', false)
    const shown = await addProduct('TEST-SHOW3', true)
    const rows = await getProductsByIds(adminClient(), [hidden, shown])
    expect(rows.map((p) => p.id).sort()).toEqual([hidden, shown].sort())
    expect(rows.find((p) => p.id === hidden)!.isActive).toBe(false)
  })

  test('danh sách rỗng → mảng rỗng', async () => {
    expect(await getProductsByIds(adminClient(), [])).toEqual([])
  })
})

describe('getTier', () => {
  test('trả đúng byCategory/byProduct của bậc CTV chuẩn trong seed', async () => {
    const admin = adminClient()
    const { data: tier } = await admin.from('partner_tiers').select('id').eq('name', 'CTV chuẩn').single().throwOnError()
    const t = await getTier(admin, tier.id)
    expect(t.kind).toBe('commission')
    const { data: cats } = await admin.from('categories').select('id, name').throwOnError()
    const byName = Object.fromEntries(cats.map((c) => [c.name, c.id]))
    expect(t.byCategory).toEqual({
      [byName['Phân NPK']]: 3, [byName['Phân hữu cơ']]: 5, [byName['Phân bón lá']]: 8,
      [byName['Thuốc BVTV']]: 6, [byName['Vật tư']]: 4,
    })
    const { data: p } = await admin.from('products').select('id').eq('sku', 'LA-DUONGTRAI').single().throwOnError()
    expect(t.byProduct).toEqual({ [p.id]: 10 })
  })

  test('bậc đại lý là wholesale, không có mức theo sản phẩm', async () => {
    const admin = adminClient()
    const { data: tier } = await admin.from('partner_tiers').select('id').eq('name', 'Đại lý cấp 1').single().throwOnError()
    const t = await getTier(admin, tier.id)
    expect(t.kind).toBe('wholesale')
    expect(t.byProduct).toEqual({})
    expect(Object.values(t.byCategory).sort((a, b) => a - b)).toEqual([5, 6, 8, 10, 12])
  })

  test('bậc không tồn tại → ném lỗi', async () => {
    await expect(getTier(adminClient(), '00000000-0000-0000-0000-000000000000')).rejects.toThrow()
  })
})
