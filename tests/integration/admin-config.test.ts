import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { transferFarmer } from '@/lib/admin/farmers-actions'
import {
  approvePartner, changePartnerTier, resetPartnerPassword, setPartnerStatus,
} from '@/lib/admin/partners-actions'
import { deletePromotion, savePromotion } from '@/lib/admin/promotions-actions'
import { saveProductRate, saveRateGrid, saveTier } from '@/lib/admin/tiers-actions'
import {
  adminClient, anonClient, asUser, createPartner, createStaff, insertFarmerFor, redirectTarget, resetData,
  seededTierId, type TestUser,
} from './helpers'
import { phoneToEmail } from '@/lib/phone'

let admin: TestUser
let staff: TestUser
let npkId: string
let productId: string
let commissionTier: string
let wholesaleTier: string

const form = (o: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(o)) f.set(k, v)
  return f
}
const promo = (o: Record<string, string> = {}) => form({
  name: 'KM thử', scope: 'category', targetId: npkId, type: 'percent', value: '10',
  startDate: '2026-11-01', endDate: '2026-11-10', isActive: 'on', ...o,
})
async function rate(tierId: string, categoryId: string) {
  const { data } = await adminClient().from('tier_rates').select('rate_pct').eq('tier_id', tierId).eq('category_id', categoryId).maybeSingle().throwOnError()
  return data ? Number(data.rate_pct) : null
}

beforeAll(async () => {
  await resetData()
  ;[admin, staff] = await Promise.all([createStaff('admin'), createStaff('staff')])
  const db = adminClient()
  npkId = (await db.from('categories').select('id').eq('name', 'Phân NPK').single().throwOnError()).data.id
  productId = (await db.from('products').select('id').order('sku').limit(1).single().throwOnError()).data.id
  commissionTier = await seededTierId('commission')
  wholesaleTier = await seededTierId('wholesale')
})
afterAll(async () => {
  await resetData()
  const db = adminClient()
  await db.from('promotions').delete().like('name', 'KM thử%').throwOnError()
  await db.from('partner_tiers').delete().like('name', 'Bậc thử%').throwOnError()
})

describe('savePromotion', () => {
  test('ngày kết thúc inclusive: ends_at = 0h VN của ngày sau', async () => {
    const res = await asUser(admin, () => savePromotion(promo()))
    expect(res.status).toBe('ok')
    const { data } = await adminClient().from('promotions').select('*').eq('id', (res as { id: string }).id).single().throwOnError()
    expect(new Date(data.starts_at).toISOString()).toBe('2026-10-31T17:00:00.000Z')
    expect(new Date(data.ends_at).toISOString()).toBe('2026-11-10T17:00:00.000Z')
    expect(Number(data.value)).toBe(10)
  })

  test('từ chối percent 120, fixed_price theo nhóm, end < start, ngày sai', async () => {
    const before = (await adminClient().from('promotions').select('id', { count: 'exact', head: true })).count
    for (const o of <Record<string, string>[]>[
      { value: '120' },
      { value: '0' },
      { type: 'fixed_price', value: '50000' }, // scope category
      { endDate: '2026-10-31' },
      { startDate: '2026-02-31' },
      { targetId: crypto.randomUUID() },
    ]) {
      expect((await asUser(admin, () => savePromotion(promo(o)))).status, JSON.stringify(o)).toBe('invalid')
    }
    expect((await adminClient().from('promotions').select('id', { count: 'exact', head: true })).count).toBe(before)
  })

  test('fixed_price cho sản phẩm hợp lệ; sửa và xóa', async () => {
    const res = await asUser(admin, () => savePromotion(promo({ scope: 'product', targetId: productId, type: 'fixed_price', value: '90000', startDate: '2026-11-10', endDate: '2026-11-10' })))
    expect(res.status).toBe('ok')
    const id = (res as { id: string }).id
    const edit = await asUser(admin, () => savePromotion(promo({ id, name: 'KM thử sửa', scope: 'product', targetId: productId, type: 'fixed_price', value: '80000' })))
    expect(edit).toEqual({ status: 'ok', id })
    expect((await adminClient().from('promotions').select('name, value').eq('id', id).single().throwOnError()).data).toMatchObject({ name: 'KM thử sửa', value: 80000 })
    expect(await asUser(admin, () => deletePromotion(id))).toEqual({ status: 'ok' })
  })

  test('staff thường bị chặn', async () => {
    expect(await redirectTarget(asUser(staff, () => savePromotion(promo())))).toBe('/')
  })
})

describe('saveRateGrid', () => {
  test('lưu, xóa bằng null; từ chối 101, -1, 3 chữ số thập phân và không ghi gì', async () => {
    expect(await asUser(admin, () => saveRateGrid(commissionTier, { [npkId]: 7.25 }))).toEqual({ status: 'ok' })
    expect(await rate(commissionTier, npkId)).toBe(7.25)
    for (const bad of [101, -1, 1.234, Number.NaN]) {
      const res = await asUser(admin, () => saveRateGrid(commissionTier, { [npkId]: 9, [crypto.randomUUID()]: bad }))
      expect(res.status, String(bad)).toBe('invalid')
    }
    expect(await rate(commissionTier, npkId)).toBe(7.25)
    expect(await asUser(admin, () => saveRateGrid(commissionTier, { [npkId]: null }))).toEqual({ status: 'ok' })
    expect(await rate(commissionTier, npkId)).toBeNull()
    await asUser(admin, () => saveRateGrid(commissionTier, { [npkId]: 3 }))
  })

  test('staff thường bị chặn', async () => {
    expect(await redirectTarget(asUser(staff, () => saveRateGrid(commissionTier, { [npkId]: 50 })))).toBe('/')
    expect(await rate(commissionTier, npkId)).toBe(3)
  })

  test('saveProductRate lưu/xóa/từ chối', async () => {
    expect(await asUser(admin, () => saveProductRate(commissionTier, productId, 12.5))).toEqual({ status: 'ok' })
    expect((await asUser(admin, () => saveProductRate(commissionTier, productId, 100.5))).status).toBe('invalid')
    expect(await asUser(admin, () => saveProductRate(commissionTier, productId, null))).toEqual({ status: 'ok' })
    const { data } = await adminClient().from('tier_product_rates').select('rate_pct').eq('tier_id', commissionTier).eq('product_id', productId)
    expect(data).toEqual([])
  })
})

describe('saveTier', () => {
  test('tạo bậc, trùng tên bị từ chối, đổi kind bậc đang có đối tác → tier_in_use', async () => {
    const res = await asUser(admin, () => saveTier(form({ name: 'Bậc thử 1', kind: 'wholesale' })))
    expect(res.status).toBe('ok')
    expect((await asUser(admin, () => saveTier(form({ name: 'Bậc thử 1', kind: 'wholesale' })))).status).toBe('invalid')
    const id = (res as { id: string }).id
    expect(await asUser(admin, () => saveTier(form({ id, name: 'Bậc thử 2', kind: 'commission' })))).toEqual({ status: 'ok', id }) // chưa có đối tác
    await adminClient().from('partner_tiers').delete().eq('id', id).throwOnError() // tránh seededTierId chọn nhầm bậc này

    const p = await createPartner({ kind: 'commission' })
    const { name } = (await adminClient().from('partner_tiers').select('name').eq('id', p.tierId!).single().throwOnError()).data
    expect(await asUser(admin, () => saveTier(form({ id: p.tierId!, name, kind: 'wholesale' })))).toEqual({ status: 'tier_in_use' })
    expect(await asUser(admin, () => saveTier(form({ id: p.tierId!, name, kind: 'commission' })))).toEqual({ status: 'ok', id: p.tierId })
  })
})

describe('đối tác', () => {
  test('approvePartner: pending → active kèm bậc; lần hai bị từ chối', async () => {
    const p = await createPartner({ kind: 'commission', status: 'pending' })
    await adminClient().from('partners').update({ tier_id: null }).eq('id', p.partnerId).throwOnError()
    expect(await asUser(admin, () => approvePartner(p.partnerId, crypto.randomUUID()))).toEqual({ status: 'invalid_tier' })
    expect(await asUser(admin, () => approvePartner(p.partnerId, commissionTier))).toEqual({ status: 'ok' })
    const { data } = await adminClient().from('partners').select('status, tier_id').eq('id', p.partnerId).single().throwOnError()
    expect(data).toEqual({ status: 'active', tier_id: commissionTier })
    expect(await asUser(admin, () => approvePartner(p.partnerId, wholesaleTier))).toEqual({ status: 'not_pending' })
    expect(await asUser(admin, () => changePartnerTier(p.partnerId, wholesaleTier))).toEqual({ status: 'ok' })
    expect((await adminClient().from('partners').select('tier_id').eq('id', p.partnerId).single().throwOnError()).data.tier_id).toBe(wholesaleTier)
  })

  test('khóa / mở khóa; đối tác chờ duyệt không đổi trạng thái qua đây', async () => {
    const p = await createPartner({ kind: 'commission' })
    expect(await asUser(admin, () => setPartnerStatus(p.partnerId, 'locked'))).toEqual({ status: 'ok' })
    expect(await asUser(admin, () => setPartnerStatus(p.partnerId, 'active'))).toEqual({ status: 'ok' })
    const pending = await createPartner({ kind: 'commission', status: 'pending' })
    expect(await asUser(admin, () => setPartnerStatus(pending.partnerId, 'active'))).toEqual({ status: 'is_pending' })
  })

  test('resetPartnerPassword: 8 ký tự chữ-số, đăng nhập được bằng mật khẩu mới', async () => {
    const p = await createPartner({ kind: 'commission' })
    const { tempPassword } = await asUser(admin, () => resetPartnerPassword(p.partnerId))
    expect(tempPassword).toMatch(/^[A-Za-z0-9]{8}$/)
    const { error } = await anonClient().auth.signInWithPassword({ email: phoneToEmail(p.phone), password: tempPassword })
    expect(error).toBeNull()
  })

  test('staff thường bị chặn', async () => {
    const p = await createPartner({ kind: 'commission', status: 'pending' })
    expect(await redirectTarget(asUser(staff, () => approvePartner(p.partnerId, commissionTier)))).toBe('/')
    expect(await redirectTarget(asUser(staff, () => resetPartnerPassword(p.partnerId)))).toBe('/')
  })
})

describe('transferFarmer', () => {
  test('chuyển sang CTV active, ghi log; từ chối đại lý, CTV bị khóa/chờ duyệt, cùng chủ', async () => {
    const [from, to, agent, locked] = await Promise.all([
      createPartner({ kind: 'commission' }), createPartner({ kind: 'commission' }),
      createPartner({ kind: 'wholesale' }), createPartner({ kind: 'commission', status: 'locked' }),
    ])
    const farmer = await insertFarmerFor(from.partnerId)
    for (const target of [agent, locked]) {
      expect(await asUser(admin, () => transferFarmer(farmer, target.partnerId))).toEqual({ status: 'partner_not_eligible' })
    }
    expect(await asUser(admin, () => transferFarmer(farmer, from.partnerId))).toEqual({ status: 'same_owner' })
    expect(await asUser(admin, () => transferFarmer(farmer, crypto.randomUUID()))).toEqual({ status: 'partner_not_eligible' })
    expect(await asUser(admin, () => transferFarmer(crypto.randomUUID(), to.partnerId))).toEqual({ status: 'farmer_not_found' })
    expect((await adminClient().from('farmers').select('owner_partner_id').eq('id', farmer).single().throwOnError()).data.owner_partner_id).toBe(from.partnerId)

    expect(await asUser(admin, () => transferFarmer(farmer, to.partnerId))).toEqual({ status: 'ok' })
    expect((await adminClient().from('farmers').select('owner_partner_id').eq('id', farmer).single().throwOnError()).data.owner_partner_id).toBe(to.partnerId)
    const { data: log } = await adminClient().from('farmer_transfer_log').select('from_partner_id, to_partner_id, changed_by').eq('farmer_id', farmer).throwOnError()
    expect(log).toEqual([{ from_partner_id: from.partnerId, to_partner_id: to.partnerId, changed_by: admin.userId }])
  })

  test('staff thường bị chặn', async () => {
    const to = await createPartner({ kind: 'commission' })
    const farmer = await insertFarmerFor(null)
    expect(await redirectTarget(asUser(staff, () => transferFarmer(farmer, to.partnerId)))).toBe('/')
  })
})
