import { expect, test } from '@playwright/test'
import { adminPage } from './helpers'

test('admin tạo dữ liệu thử → thấy nhãn "Thử" ở đơn, đối tác, nông dân → xóa có bước xác nhận', async ({ browser }) => {
  const admin = await adminPage(browser)
  const dialogs: string[] = []
  admin.on('dialog', (d) => { dialogs.push(d.message()); void d.dismiss() })

  await admin.goto('/admin/du-lieu-thu')
  await expect(admin.getByRole('heading', { name: 'Dữ liệu thử', level: 1 })).toBeVisible()
  await admin.getByLabel('Mật khẩu chung cho 5 tài khoản thử').fill('matkhau-thu-1')
  await admin.getByRole('button', { name: 'Tạo dữ liệu thử' }).click()
  await expect(admin.getByRole('status')).toContainText('Đã tạo 5 đối tác, 8 nông dân')
  await expect(admin.getByRole('button', { name: 'Xóa toàn bộ dữ liệu thử' })).toBeVisible()

  await admin.goto('/admin/don-hang')
  await expect(admin.getByText('Thử', { exact: true }).first()).toBeVisible()
  await admin.goto('/admin/doi-tac')
  await expect(admin.getByRole('link', { name: /CTV Thử 1/ })).toContainText('Thử')
  await admin.goto('/admin/nong-dan')
  await expect(admin.getByText('Thử', { exact: true }).first()).toBeVisible()
  await admin.goto('/admin/hoa-hong')
  await expect(admin.getByText('Thử', { exact: true }).first()).toBeVisible()

  await admin.goto('/admin/du-lieu-thu')
  await admin.getByRole('button', { name: 'Xóa toàn bộ dữ liệu thử' }).click()
  const confirm = admin.getByRole('group', { name: 'Xác nhận xóa dữ liệu thử' })
  await confirm.getByRole('button', { name: 'Hủy' }).click()
  await expect(confirm).toHaveCount(0)
  await admin.getByRole('button', { name: 'Xóa toàn bộ dữ liệu thử' }).click()
  await admin.getByRole('button', { name: 'Xác nhận xóa' }).click()
  await expect(admin.getByRole('status')).toContainText('Đã xóa 5 đối tác')
  await expect(admin.getByRole('button', { name: 'Tạo dữ liệu thử' })).toBeVisible()
  expect(dialogs).toEqual([])

  await admin.goto('/admin/doi-tac')
  await expect(admin.getByText('CTV Thử 1')).toHaveCount(0)
  await admin.context().close()
})
