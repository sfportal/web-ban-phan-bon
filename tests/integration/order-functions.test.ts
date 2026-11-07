import { randomUUID } from 'node:crypto'
import { afterAll, beforeEach, describe, expect, test } from 'vitest'
import { canTransition, TRANSITIONS, type OrderStatus } from '@/lib/orders/status'
import {
  adminClient,
  anonClient,
  changeStatus,
  commissions,
  countOrders,
  createOrderRpc,
  createPartner,
  createStaff,
  orderInStatus,
  resetData,
  sampleLine,
  toStatus,
  type TestPartner,
} from './helpers'

const ALL = Object.keys(TRANSITIONS) as OrderStatus[]

let ctv: TestPartner
let staffId: string
const partnerOrder = (o: Record<string, unknown> = {}) => ({
  source: 'partner', partner_id: ctv.partnerId, delivery_address: 'Buôn Ma Thuột',
  retail_name: null, retail_phone: null, retail_address: null, ...o,
})

beforeEach(async () => {
  await resetData()
  ctv = await createPartner({ kind: 'commission' })
  staffId = (await createStaff('staff')).userId
})
afterAll(resetData)

async function logs(orderId: string) {
  const { data } = await adminClient()
    .from('order_status_log').select('from_status, to_status, changed_by, note')
    .eq('order_id', orderId).order('id').throwOnError()
  return data
}

describe('create_order', () => {
  test('mã đơn tăng dần theo tháng', async () => {
    const a = await createOrderRpc()
    const b = await createOrderRpc()
    expect(a.code).toMatch(/^DH\d{4}-0001$/)
    expect(b.code).toMatch(/-0002$/)
  })

  test('YYMM của mã đơn theo giờ Việt Nam', async () => {
    const { code } = await createOrderRpc()
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh', year: '2-digit', month: '2-digit',
    }).formatToParts(new Date())
    const yymm = parts.find((p) => p.type === 'year')!.value + parts.find((p) => p.type === 'month')!.value
    expect(code).toBe(`DH${yymm}-0001`)
  })

  test('cùng client_key trả về cùng đơn', async () => {
    const k = randomUUID()
    const [x, y] = await Promise.all([createOrderRpc({ client_key: k }), createOrderRpc({ client_key: k })])
    expect(x.id).toBe(y.id)
    expect(await countOrders()).toBe(1)
    // không bỏ trống số thứ tự: đơn kế tiếp là -0002
    expect((await createOrderRpc()).code).toMatch(/-0002$/)
  })

  test('lưu đơn, dòng hàng, total_qty và log null→new', async () => {
    const line = await sampleLine({ qty: 3, line_total: 300, line_commission: 15, rate_pct_snap: 5 })
    const { id } = await createOrderRpc(
      partnerOrder({ subtotal: 300, commission_expected: 15, note: 'giao sáng', client_ip: '1.2.3.4', actor: ctv.userId }),
      [line, { ...line, qty: 2 }],
    )
    const { data: o } = await adminClient().from('orders').select().eq('id', id).single().throwOnError()
    expect(o).toMatchObject({
      source: 'partner', partner_id: ctv.partnerId, status: 'new', subtotal: 300,
      commission_expected: 15, total_qty: 5, note: 'giao sáng', client_ip: '1.2.3.4',
      delivery_address: 'Buôn Ma Thuột', payment_method: 'cod',
    })
    const { data: ls } = await adminClient()
      .from('order_lines').select('qty, line_commission, rate_pct_snap').eq('order_id', id).order('qty').throwOnError()
    expect(ls).toEqual([
      { qty: 2, line_commission: 15, rate_pct_snap: 5 },
      { qty: 3, line_commission: 15, rate_pct_snap: 5 },
    ])
    expect(await logs(id)).toEqual([{ from_status: null, to_status: 'new', changed_by: ctv.userId, note: null }])
  })

  test('lỗi dòng hàng không để lại đơn hay tiêu số thứ tự', async () => {
    await expect(createOrderRpc({}, [await sampleLine({ qty: 0 })])).rejects.toBeTruthy()
    expect(await countOrders()).toBe(0)
    expect((await createOrderRpc()).code).toMatch(/-0001$/)
  })
})

describe('change_order_status', () => {
  test('SQL khớp TRANSITIONS', async () => {
    for (const from of ALL) {
      for (const to of ALL) {
        for (const kind of ['partner', 'staff'] as const) {
          const id = await orderInStatus(from)
          const { error } = await changeStatus(id, to, kind, staffId)
          const ok = from === to || canTransition(from, to, kind)
          expect(error === null, `${kind}: ${from}→${to}`).toBe(ok)
          if (!ok) expect(error!.message).toContain('invalid_transition')
        }
      }
    }
  })

  test('paid tạo hoa hồng một lần dù gọi hai lần', async () => {
    const id = await orderInStatus('delivered', partnerOrder({ commission_expected: 52500 }))
    await toStatus(id, 'paid')
    await toStatus(id, 'paid')
    expect(await commissions(id)).toEqual([{ kind: 'earn', amount: 52500, status: 'pending' }])
    const { data } = await adminClient()
      .from('commission_entries').select('partner_id, period').eq('order_id', id).single().throwOnError()
    expect(data.partner_id).toBe(ctv.partnerId)
    expect(data.period).toMatch(/^\d{4}-\d{2}$/)
  })

  test('trả hàng sau paid tạo dòng âm một lần', async () => {
    const id = await orderInStatus('paid', partnerOrder({ commission_expected: 52500 }))
    await toStatus(id, 'returned')
    await toStatus(id, 'returned')
    expect((await commissions(id)).map((c) => c.amount).sort()).toEqual([-52500, 52500])
    const rev = (await commissions(id)).find((c) => c.kind === 'reversal')
    expect(rev).toEqual({ kind: 'reversal', amount: -52500, status: 'pending' })
  })

  test('hủy và trả hàng trước paid không có hoa hồng', async () => {
    const a = await orderInStatus('new', partnerOrder({ commission_expected: 52500 }))
    await toStatus(a, 'cancelled')
    const b = await orderInStatus('delivered', partnerOrder({ commission_expected: 52500 }))
    await toStatus(b, 'returned')
    expect(await commissions(a)).toEqual([])
    expect(await commissions(b)).toEqual([])
  })

  test('đơn commission_expected = 0 không tạo dòng hoa hồng', async () => {
    const dl = await createPartner({ kind: 'wholesale' })
    const id = await orderInStatus('paid', partnerOrder({ partner_id: dl.partnerId, partner_payable: 700000 }))
    await toStatus(id, 'returned')
    expect(await commissions(id)).toEqual([])
  })

  test('mỗi lần đổi trạng thái đều ghi log', async () => {
    const id = await orderInStatus('new')
    for (const s of ['confirmed', 'shipping', 'delivered', 'paid'] as const) {
      const { error } = await changeStatus(id, s, 'staff', staffId, `-> ${s}`)
      expect(error).toBeNull()
    }
    await changeStatus(id, 'paid', 'staff', staffId) // cùng trạng thái: không ghi log
    await changeStatus(id, 'new', 'staff', staffId) // không hợp lệ: không ghi log
    expect(await logs(id)).toEqual([
      { from_status: null, to_status: 'new', changed_by: null, note: null },
      { from_status: 'new', to_status: 'confirmed', changed_by: staffId, note: '-> confirmed' },
      { from_status: 'confirmed', to_status: 'shipping', changed_by: staffId, note: '-> shipping' },
      { from_status: 'shipping', to_status: 'delivered', changed_by: staffId, note: '-> delivered' },
      { from_status: 'delivered', to_status: 'paid', changed_by: staffId, note: '-> paid' },
    ])
  })

  test('đơn không tồn tại báo order_not_found', async () => {
    const { error } = await changeStatus(randomUUID(), 'confirmed')
    expect(error!.message).toContain('order_not_found')
  })
})

describe('replace_order_lines', () => {
  async function replace(id: string, kind: 'partner' | 'staff') {
    const line = await sampleLine({ qty: 4, line_total: 400, line_commission: 20 })
    return adminClient().rpc('replace_order_lines', {
      p_order_id: id, p_lines: [line],
      p_totals: { subtotal: 400, partner_payable: null, commission_expected: 20 },
      p_actor: kind === 'partner' ? ctv.userId : staffId, p_actor_kind: kind,
    })
  }

  test('partner bị chặn khi confirmed, staff được', async () => {
    const id = await orderInStatus('confirmed', partnerOrder())
    const { error } = await replace(id, 'partner')
    expect(error!.message).toContain('not_editable')
    expect((await replace(id, 'staff')).error).toBeNull()
    const { data: o } = await adminClient()
      .from('orders').select('subtotal, commission_expected, total_qty').eq('id', id).single().throwOnError()
    expect(o).toEqual({ subtotal: 400, commission_expected: 20, total_qty: 4 })
    const { data: ls } = await adminClient().from('order_lines').select('qty').eq('order_id', id).throwOnError()
    expect(ls).toEqual([{ qty: 4 }])
  })

  test('partner sửa được khi new; staff bị chặn từ shipping', async () => {
    const a = await orderInStatus('new', partnerOrder())
    expect((await replace(a, 'partner')).error).toBeNull()
    const b = await orderInStatus('shipping', partnerOrder())
    expect((await replace(b, 'staff')).error!.message).toContain('not_editable')
  })
})

describe('retail_recent_count', () => {
  test('đếm đơn lẻ theo SĐT hoặc IP trong 10 phút', async () => {
    await createOrderRpc({ retail_phone: '0901000001', client_ip: '10.0.0.1' })
    await createOrderRpc({ retail_phone: '0901000002', client_ip: '10.0.0.2' })
    const old = await createOrderRpc({ retail_phone: '0901000001', client_ip: '10.0.0.9' })
    await adminClient().from('orders')
      .update({ created_at: new Date(Date.now() - 11 * 60_000).toISOString() }).eq('id', old.id).throwOnError()
    await createOrderRpc(partnerOrder({ client_ip: '10.0.0.1' })) // đơn partner không tính

    const count = async (p_phone: string, p_ip: string) =>
      (await adminClient().rpc('retail_recent_count', { p_phone, p_ip })).data
    expect(await count('0901000001', '10.0.0.2')).toBe(2)
    expect(await count('0901000001', '10.9.9.9')).toBe(1)
    expect(await count('0909999999', '10.0.0.1')).toBe(1)
    expect(await count('0909999999', '10.0.0.9')).toBe(0)
  })
})

describe('quyền execute', () => {
  const calls = [
    ['create_order', { p_order: {}, p_lines: [] }],
    ['change_order_status', { p_order_id: randomUUID(), p_to: 'confirmed', p_actor: null, p_actor_kind: 'staff', p_note: null }],
    ['replace_order_lines', { p_order_id: randomUUID(), p_lines: [], p_totals: {}, p_actor: null, p_actor_kind: 'staff' }],
    ['claim_farmer', { p_partner_id: randomUUID(), p_phone: '0912345678', p_name: 'x', p_address: null }],
    ['transfer_farmer', { p_farmer_id: randomUUID(), p_to_partner: randomUUID(), p_actor: null }],
    ['retail_recent_count', { p_phone: '0912345678', p_ip: '1.1.1.1' }],
  ] as const

  test('anon và authenticated không gọi được RPC', async () => {
    for (const client of [anonClient(), ctv.client]) {
      for (const [fn, args] of calls) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (client.rpc as any)(fn, args)
        expect(error?.code, fn).toBe('42501')
      }
    }
  })
})
