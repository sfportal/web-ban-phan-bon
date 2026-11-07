import ExcelJS from 'exceljs'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { GET } from '@/app/admin/xuat-du-lieu/route'
import { asUser, createStaff, redirectTarget, resetData, type TestUser } from './helpers'

let admin: TestUser
let staff: TestUser
const req = (query: string) => new NextRequest(`http://localhost/admin/xuat-du-lieu?${query}`)

beforeAll(async () => {
  await resetData()
  ;[admin, staff] = await Promise.all([createStaff('admin'), createStaff('staff')])
})
afterAll(resetData)

describe('GET /admin/xuat-du-lieu', () => {
  test('chưa đăng nhập → /dang-nhap', async () => {
    expect(await redirectTarget(asUser(null, () => GET(req('loai=don-hang&tu=2026-11-01&den=2026-11-07'))))).toBe('/dang-nhap')
  })

  test('nhân viên thường không xuất được toàn bộ dữ liệu / hoa hồng', async () => {
    expect(await redirectTarget(asUser(staff, () => GET(req('loai=tat-ca'))))).toBe('/')
    expect(await redirectTarget(asUser(staff, () => GET(req('loai=hoa-hong&ky=2026-11'))))).toBe('/')
  })

  test('nhân viên thường xuất đơn hàng → 200 xlsx tải xuống', async () => {
    const res = await asUser(staff, () => GET(req('loai=don-hang&tu=2026-11-01&den=2026-11-07')))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="don-hang_2026-11-01_2026-11-07.xlsx"')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await res.arrayBuffer())
    expect(wb.worksheets[0].getRow(1).getCell(1).value).toBe('Mã đơn')
  })

  test('admin xuất hoa hồng và toàn bộ dữ liệu', async () => {
    expect((await asUser(admin, () => GET(req('loai=hoa-hong&ky=2026-11')))).status).toBe(200)
    expect((await asUser(admin, () => GET(req('loai=tat-ca')))).status).toBe(200)
  })

  test('tham số sai → 400', async () => {
    for (const q of ['loai=khac', '', 'loai=don-hang&tu=2026-11-07&den=2026-11-01', 'loai=don-hang&tu=2026-02-31&den=2026-03-01', 'loai=hoa-hong&ky=2026-13']) {
      expect((await asUser(admin, () => GET(req(q)))).status, q).toBe(400)
    }
  })
})
