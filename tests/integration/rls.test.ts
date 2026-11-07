import { afterAll, beforeEach, describe, expect, test } from 'vitest'
import {
  adminClient,
  anonClient,
  createPartner,
  createStaff,
  insertFarmerFor,
  insertOrderFor,
  resetData,
} from './helpers'

async function cleanup() {
  await resetData()
  await adminClient().from('settings').delete().eq('key', 'notify_email').throwOnError()
}
beforeEach(cleanup)
afterAll(cleanup)

describe('RLS đối tác', () => {
  test('CTV A không đọc được đơn/nông dân/hoa hồng của CTV B', async () => {
    const a = await createPartner({ kind: 'commission' })
    const b = await createPartner({ kind: 'commission' })
    const orderB = await insertOrderFor(b.partnerId)
    await insertFarmerFor(b.partnerId)
    await adminClient().from('commission_entries').insert({
      partner_id: b.partnerId, order_id: orderB, kind: 'earn', amount: 1000, period: '2026-11',
    }).throwOnError()

    expect((await a.client.from('orders').select().eq('id', orderB)).data).toEqual([])
    expect((await a.client.from('order_lines').select().eq('order_id', orderB)).data).toEqual([])
    expect((await a.client.from('farmers').select().eq('owner_partner_id', b.partnerId)).data).toEqual([])
    expect((await a.client.from('commission_entries').select().eq('partner_id', b.partnerId)).data).toEqual([])
    expect((await a.client.from('partners').select().eq('id', b.partnerId)).data).toEqual([])

    // B vẫn đọc được dữ liệu của chính mình
    expect((await b.client.from('orders').select('id')).data).toEqual([{ id: orderB }])
    expect((await b.client.from('order_lines').select('order_id')).data).toEqual([{ order_id: orderB }])
    expect((await b.client.from('farmers').select('owner_partner_id')).data).toEqual([
      { owner_partner_id: b.partnerId },
    ])
    expect((await b.client.from('commission_entries').select('amount')).data).toEqual([{ amount: 1000 }])
  })

  test('đại lý không đọc tỷ lệ của bậc khác', async () => {
    const d = await createPartner({ kind: 'wholesale' })
    const { data } = await d.client.from('tier_rates').select('tier_id')
    expect(data!.length).toBeGreaterThan(0)
    expect(new Set(data!.map((r) => r.tier_id))).toEqual(new Set([d.tierId]))
    const tiers = (await d.client.from('partner_tiers').select('id, kind')).data
    expect(tiers).toEqual([{ id: d.tierId, kind: 'wholesale' }])
  })

  test('đối tác pending không đọc được giá theo bậc nhưng thấy hồ sơ của mình', async () => {
    const p = await createPartner({ kind: 'commission', status: 'pending' })
    expect((await p.client.from('tier_rates').select()).data).toEqual([])
    expect((await p.client.from('partner_tiers').select()).data).toEqual([])
    const me = (await p.client.from('partners').select('id, status')).data
    expect(me).toEqual([{ id: p.partnerId, status: 'pending' }])
  })

  test('đối tác locked không đọc được đơn của mình', async () => {
    const p = await createPartner({ kind: 'commission' })
    const orderId = await insertOrderFor(p.partnerId)
    await adminClient().from('partners').update({ status: 'locked' }).eq('id', p.partnerId).throwOnError()
    expect((await p.client.from('orders').select().eq('id', orderId)).data).toEqual([])
  })

  test('partner không ghi trực tiếp được', async () => {
    const a = await createPartner({ kind: 'commission' })
    const ins = await a.client.from('orders').insert({ source: 'partner', partner_id: a.partnerId } as never)
    expect(ins.error).not.toBeNull()
    const upd = await a.client.from('products').update({ list_price: 1 }).neq('sku', '').select()
    expect(upd.data ?? []).toEqual([])
    const { count } = await adminClient().from('products').select('id', { count: 'exact', head: true }).eq('list_price', 1)
    expect(count).toBe(0)
    const self = await a.client.from('partners').update({ status: 'active', tier_id: null }).eq('id', a.partnerId).select()
    expect(self.data ?? []).toEqual([])
  })
})

describe('RLS khách và nhân viên', () => {
  test('anon chỉ thấy sản phẩm đang bán', async () => {
    const admin = adminClient()
    const { data: p } = await admin.from('products').select('id').order('sku').limit(1).single().throwOnError()
    await admin.from('products').update({ is_active: false }).eq('id', p!.id).throwOnError()
    try {
      const { data } = await anonClient().from('products').select('id')
      expect(data!.length).toBeGreaterThan(0)
      expect(data!.map((r) => r.id)).not.toContain(p!.id)
    } finally {
      await admin.from('products').update({ is_active: true }).eq('id', p!.id).throwOnError()
    }
  })

  test('anon chỉ thấy khuyến mãi đang bật', async () => {
    const admin = adminClient()
    const { data: c } = await admin.from('categories').select('id').limit(1).single().throwOnError()
    const now = Date.now()
    const base = {
      scope: 'category' as const, target_id: c!.id, type: 'percent' as const, value: 10,
      starts_at: new Date(now - 86_400_000).toISOString(), ends_at: new Date(now + 86_400_000).toISOString(),
    }
    const { data: rows } = await admin.from('promotions')
      .insert([{ ...base, name: 'bật', is_active: true }, { ...base, name: 'tắt', is_active: false }])
      .select('id, name').throwOnError()
    try {
      const { data } = await anonClient().from('promotions').select('name')
      expect(data).toEqual([{ name: 'bật' }])
    } finally {
      await admin.from('promotions').delete().in('id', rows!.map((r) => r.id)).throwOnError()
    }
  })

  test('anon không đọc settings notify_email nhưng đọc store_name', async () => {
    await adminClient().from('settings').upsert({ key: 'notify_email', value: 'a@b.vn' }).throwOnError()
    const anon = anonClient()
    expect((await anon.from('settings').select().eq('key', 'notify_email')).data).toEqual([])
    const { data } = await anon.from('settings').select('key').eq('key', 'store_name')
    expect(data).toEqual([{ key: 'store_name' }])
  })

  test('anon không đọc bảng nội bộ', async () => {
    const p = await createPartner({ kind: 'commission' })
    await insertOrderFor(p.partnerId)
    const anon = anonClient()
    for (const t of ['partners', 'orders', 'farmers', 'tier_rates', 'partner_tiers', 'staff'] as const) {
      expect((await anon.from(t).select()).data, t).toEqual([])
    }
  })

  test('nhân viên đọc được tất cả', async () => {
    const p = await createPartner({ kind: 'commission' })
    const orderId = await insertOrderFor(p.partnerId)
    await adminClient().from('settings').upsert({ key: 'notify_email', value: 'a@b.vn' }).throwOnError()
    const s = await createStaff('staff')
    expect((await s.client.from('orders').select('id').eq('id', orderId)).data).toEqual([{ id: orderId }])
    expect((await s.client.from('partners').select('id').eq('id', p.partnerId)).data).toEqual([{ id: p.partnerId }])
    const tiers = (await s.client.from('tier_rates').select('tier_id')).data!
    expect(new Set(tiers.map((r) => r.tier_id)).size).toBe(2)
    expect((await s.client.from('settings').select('key').eq('key', 'notify_email')).data).toEqual([
      { key: 'notify_email' },
    ])
    expect((await s.client.rpc('is_staff')).data).toBe(true)
    expect((await s.client.rpc('is_admin')).data).toBe(false)
    const a = await createStaff('admin')
    expect((await a.client.rpc('is_admin')).data).toBe(true)
  })

  test('ràng buộc dữ liệu: SĐT sai định dạng bị từ chối', async () => {
    const admin = adminClient()
    const { error } = await admin.from('farmers').insert({ phone: '123', name: 'x' })
    expect(error?.code).toBe('23514')
  })
})

