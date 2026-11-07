import { randomUUID } from 'node:crypto'
import { afterAll, beforeEach, expect, test } from 'vitest'
import {
  adminClient,
  claim,
  createPartner,
  createStaff,
  insertFarmerFor,
  resetData,
  type TestPartner,
} from './helpers'

let a: TestPartner
let b: TestPartner

beforeEach(async () => {
  await resetData()
  ;[a, b] = await Promise.all([createPartner({ kind: 'commission' }), createPartner({ kind: 'commission' })])
})
afterAll(resetData)

async function farmerByPhone(phone: string) {
  const { data } = await adminClient()
    .from('farmers').select('id, name, address, owner_partner_id').eq('phone', phone).single().throwOnError()
  return data
}

test('SĐT mới tạo nông dân thuộc CTV', async () => {
  const r = await claim(a, '0912345678', 'Anh Ba', 'Ea Kar')
  expect(r.status).toBe('ok')
  const f = await farmerByPhone('0912345678')
  expect(f).toEqual({ id: (r as { farmer_id: string }).farmer_id, name: 'Anh Ba', address: 'Ea Kar', owner_partner_id: a.partnerId })
})

test('CTV khác nhập trùng SĐT bị chặn', async () => {
  expect((await claim(a, '0912345678')).status).toBe('ok')
  expect(await claim(b, '0912345678')).toEqual({ status: 'owned_by_other' })
  expect((await farmerByPhone('0912345678')).owner_partner_id).toBe(a.partnerId)
})

test('khách đã thuộc chính CTV này trả về ok cùng farmer_id', async () => {
  const first = await claim(a, '0912345678')
  expect(await claim(a, '0912345678')).toEqual(first)
})

test('khách chưa có chủ (từ đơn lẻ) được gán cho CTV đầu tiên', async () => {
  const id = await insertFarmerFor(null, '0933333333')
  expect(await claim(a, '0933333333')).toEqual({ status: 'ok', farmer_id: id })
  expect((await farmerByPhone('0933333333')).owner_partner_id).toBe(a.partnerId)
  expect(await claim(b, '0933333333')).toEqual({ status: 'owned_by_other' })
})

test('hai CTV claim song song chỉ một người thắng', async () => {
  const r = await Promise.all([claim(a, '0987654321'), claim(b, '0987654321')])
  expect(r.filter((x) => x.status === 'ok')).toHaveLength(1)
  expect(r.filter((x) => x.status === 'owned_by_other')).toHaveLength(1)
})

test('transfer_farmer đổi chủ và ghi log', async () => {
  const admin = await createStaff('admin')
  const r = await claim(a, '0944444444')
  const farmerId = (r as { farmer_id: string }).farmer_id
  const { error } = await adminClient().rpc('transfer_farmer', {
    p_farmer_id: farmerId, p_to_partner: b.partnerId, p_actor: admin.userId,
  })
  expect(error).toBeNull()
  expect((await farmerByPhone('0944444444')).owner_partner_id).toBe(b.partnerId)
  const { data: log } = await adminClient()
    .from('farmer_transfer_log').select('from_partner_id, to_partner_id, changed_by').eq('farmer_id', farmerId)
    .throwOnError()
  expect(log).toEqual([{ from_partner_id: a.partnerId, to_partner_id: b.partnerId, changed_by: admin.userId }])
  expect(await claim(a, '0944444444')).toEqual({ status: 'owned_by_other' })
})

test('transfer_farmer với nông dân không tồn tại báo farmer_not_found', async () => {
  const { error } = await adminClient().rpc('transfer_farmer', {
    p_farmer_id: randomUUID(), p_to_partner: b.partnerId, p_actor: null,
  })
  expect(error!.message).toContain('farmer_not_found')
})
