import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { addFarmer, searchMyFarmers } from '@/lib/farmers/actions'
import { getFrequentProducts } from '@/lib/orders/frequent'
import { adminClient, asUser, createPartner, insertFarmerFor, randomPhone, resetData, type TestPartner } from './helpers'

let ctv: TestPartner
let other: TestPartner
let dl: TestPartner

beforeAll(async () => {
  await resetData()
  ;[ctv, other, dl] = await Promise.all([
    createPartner({ kind: 'commission' }),
    createPartner({ kind: 'commission' }),
    createPartner({ kind: 'wholesale' }),
  ])
})
const tempSkus: string[] = []
afterAll(async () => {
  await resetData()
  if (tempSkus.length) await adminClient().from('products').delete().in('sku', tempSkus).throwOnError()
})

async function farmerRow(phone: string) {
  const { data } = await adminClient()
    .from('farmers').select('id, name, address, owner_partner_id').eq('phone', phone).maybeSingle().throwOnError()
  return data
}

describe('addFarmer', () => {
  test('SĐT mới: tạo nông dân thuộc CTV, chuẩn hóa SĐT', async () => {
    const phone = randomPhone()
    const spaced = `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`
    const res = await asUser(ctv, () => addFarmer({ phone: spaced, name: '  Anh Ba ', address: 'Ea Kar' }))
    const row = await farmerRow(phone)
    expect(res).toEqual({ status: 'ok', farmer: { id: row!.id, name: 'Anh Ba', phone } })
    expect(row).toMatchObject({ address: 'Ea Kar', owner_partner_id: ctv.partnerId })
  })

  test('khách đã thuộc chính mình → ok, trả tên đang lưu', async () => {
    const phone = randomPhone()
    const id = await insertFarmerFor(ctv.partnerId, phone)
    const res = await asUser(ctv, () => addFarmer({ phone, name: 'Tên khác' }))
    expect(res).toEqual({ status: 'ok', farmer: { id, name: `Nông dân ${phone}`, phone } })
  })

  test('SĐT của CTV khác → owned_by_other, không đổi chủ', async () => {
    const phone = randomPhone()
    await insertFarmerFor(other.partnerId, phone)
    expect(await asUser(ctv, () => addFarmer({ phone, name: 'Chị Lan' }))).toEqual({ status: 'owned_by_other' })
    expect((await farmerRow(phone))!.owner_partner_id).toBe(other.partnerId)
  })

  test('"+84 0…" cùng người với SĐT nội địa → owned_by_other, không tạo nông dân thứ hai', async () => {
    const phone = randomPhone()
    await insertFarmerFor(other.partnerId, phone)
    const intl = `+84 ${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`
    expect(await asUser(ctv, () => addFarmer({ phone: intl, name: 'Chị Lan' }))).toEqual({ status: 'owned_by_other' })
    expect(await farmerRow(`0${phone}`)).toBeNull()
  })

  test('DB từ chối SĐT dạng 00…', async () => {
    const { error } = await adminClient().from('farmers').insert({ phone: '00912345678', name: 'X' })
    expect(error?.message).toContain('farmers_phone_check')
  })

  test('SĐT sai → invalid_phone; thiếu tên → missing_fields', async () => {
    expect(await asUser(ctv, () => addFarmer({ phone: '12345', name: 'A' }))).toEqual({ status: 'invalid_phone' })
    expect(await asUser(ctv, () => addFarmer({ phone: randomPhone(), name: '   ' }))).toEqual({ status: 'missing_fields' })
  })

  test('đại lý không được thêm nông dân', async () => {
    const phone = randomPhone()
    expect(await asUser(dl, () => addFarmer({ phone, name: 'A' }))).toEqual({ status: 'not_allowed' })
    expect(await farmerRow(phone)).toBeNull()
  })
})

describe('searchMyFarmers', () => {
  let mine: string
  let mineName: string
  beforeAll(async () => {
    mine = '0977' + String(Date.now()).slice(-6)
    mineName = 'Hoàng Văn Tư'
    await adminClient().from('farmers').insert({ phone: mine, name: mineName, owner_partner_id: ctv.partnerId }).throwOnError()
    await adminClient().from('farmers').insert({ phone: randomPhone(), name: 'Hoàng Văn Năm', owner_partner_id: other.partnerId }).throwOnError()
  })

  test('tìm theo tên hoặc một phần SĐT, chỉ trong khách của mình', async () => {
    const byName = await asUser(ctv, () => searchMyFarmers('hoàng văn'))
    expect(byName.map((f) => f.name)).toEqual([mineName])
    const byPhone = await asUser(ctv, () => searchMyFarmers(mine.slice(3, 9)))
    expect(byPhone).toEqual([expect.objectContaining({ phone: mine, name: mineName })])
    expect(await asUser(other, () => searchMyFarmers(mine))).toEqual([])
  })

  test('84/+84 đầu chuỗi chỉ đổi thành 0 khi là SĐT đầy đủ; số dở dang tìm nguyên văn', async () => {
    const phone = '0918' + String(Date.now()).slice(-3) + '845'
    await adminClient().from('farmers').insert({ phone, name: 'Chị Tám', owner_partner_id: ctv.partnerId }).throwOnError()
    const found = (q: string) => asUser(ctv, () => searchMyFarmers(q)).then((r) => r.map((f) => f.phone))
    expect(await found('845')).toContain(phone)
    expect(await found('84')).toContain(phone)
    expect(await found('84' + phone.slice(1))).toEqual([phone])
    expect(await found('+84 ' + phone.slice(1, 4) + ' ' + phone.slice(4))).toEqual([phone])
  })

  test('% và _ là ký tự thường', async () => {
    expect(await asUser(ctv, () => searchMyFarmers('%'))).toEqual([])
    expect(await asUser(ctv, () => searchMyFarmers('_'))).toEqual([])
  })

  test('chuỗi rỗng → danh sách khách của mình, tối đa 20', async () => {
    for (let i = 0; i < 21; i++) await insertFarmerFor(ctv.partnerId)
    const all = await asUser(ctv, () => searchMyFarmers(''))
    expect(all).toHaveLength(20)
    const { data: owned } = await adminClient()
      .from('farmers').select('id').eq('owner_partner_id', ctv.partnerId).throwOnError()
    const ownedIds = new Set(owned.map((f) => f.id))
    expect(all.every((f) => ownedIds.has(f.id))).toBe(true)
  })
})

describe('getFrequentProducts', () => {
  async function insertOrder(partnerId: string, lines: [string, number][], status: 'new' | 'cancelled' = 'new') {
    const admin = adminClient()
    const { data: o } = await admin
      .from('orders')
      .insert({
        code: `TEST-${randomUUID().slice(0, 8)}`, source: 'partner', partner_id: partnerId, status,
        delivery_address: 'BMT', subtotal: 0, total_qty: lines.reduce((s, [, q]) => s + q, 0),
      })
      .select('id').single().throwOnError()
    await admin.from('order_lines').insert(
      lines.map(([product_id, qty]) => ({
        order_id: o.id, product_id, qty, list_price_snap: 0, sale_price_snap: 0, line_total: 0,
      })),
    ).throwOnError()
  }

  test('top theo tổng qty, bỏ đơn hủy và đơn của đối tác khác, tối đa 10', async () => {
    // Seed có nhiều hơn 10 sản phẩm; thêm 2 cho chắc vẫn kiểm được giới hạn 10.
    const { data: cat } = await adminClient().from('categories').select('id').limit(1).single().throwOnError()
    for (let i = 0; i < 2; i++) {
      const sku = `TEST-${randomUUID().slice(0, 8)}`
      tempSkus.push(sku)
      await adminClient().from('products')
        .insert({ sku, name: sku, unit: 'bao', category_id: cat.id, list_price: 1000 }).throwOnError()
    }
    const { data: products } = await adminClient().from('products').select('id').order('sku').throwOnError()
    expect(products.length).toBeGreaterThanOrEqual(12)
    const p = products.map((x) => x.id)
    const partner = await createPartner({ kind: 'commission' })

    await insertOrder(partner.partnerId, [[p[0], 5], [p[1], 2]])
    await insertOrder(partner.partnerId, [[p[1], 4]])
    await insertOrder(partner.partnerId, [[p[2], 100]], 'cancelled')
    await insertOrder(other.partnerId, [[p[3], 50]])
    expect(await getFrequentProducts(partner.partnerId)).toEqual([p[1], p[0]])

    await insertOrder(partner.partnerId, p.slice(4, 15).map((id, i) => [id, i + 10] as [string, number]))
    const top = await getFrequentProducts(partner.partnerId)
    expect(top).toHaveLength(10)
    expect(top).not.toContain(p[2])
    expect(top[0]).toBe(p.slice(4, 15).at(-1))
  })
})
