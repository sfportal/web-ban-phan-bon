import { expect, test, type Page } from '@playwright/test'
import { partnerWithCommission, vnd } from './helpers'

const stat = (page: Page, label: string) => page.getByText(label, { exact: true }).locator('..')

test('CTV khai ngân hàng, rút 100.000 → "Chờ duyệt", số dư giảm; rút vượt số dư bị từ chối', async ({ page, browser }) => {
  const { commission, code } = await partnerWithCommission(page, browser)
  expect(commission).toBeGreaterThanOrEqual(300_000)

  await page.getByRole('navigation', { name: 'Khu đối tác' }).getByRole('link', { name: 'Ví' }).click()
  await expect(page.getByRole('heading', { name: 'Ví hoa hồng' })).toBeVisible()
  await expect(stat(page, 'Đã kiếm được')).toContainText(vnd(commission))
  await expect(stat(page, 'Số dư khả dụng')).toContainText(vnd(commission))
  await expect(page.getByRole('region', { name: 'Lịch sử hoa hồng' })).toContainText(code)

  // Thiếu ngân hàng → phải khai trước khi rút.
  await expect(page.getByRole('button', { name: 'Rút tiền' })).toHaveCount(0)
  await page.getByLabel('Ngân hàng', { exact: true }).fill('Vietcombank')
  await page.getByLabel('Số tài khoản').fill('0123456789')
  await page.getByLabel('Chủ tài khoản').fill('NGUYEN VAN A')
  await page.getByRole('button', { name: 'Lưu thông tin ngân hàng' }).click()
  await expect(page.getByRole('button', { name: 'Rút tiền' })).toBeVisible()

  await page.getByRole('button', { name: 'Rút tiền' }).click()
  await page.getByLabel('Số tiền muốn rút').fill('100000')
  await page.getByRole('button', { name: 'Gửi yêu cầu rút' }).click()
  await expect(stat(page, 'Số dư khả dụng')).toContainText(vnd(commission - 100_000))
  await expect(stat(page, 'Đang chờ chi')).toContainText(vnd(100_000))
  await expect(page.getByRole('list', { name: 'Khoản chi' })).toContainText('Chờ duyệt')

  // Rút vượt số dư.
  await page.getByRole('button', { name: 'Rút tiền' }).click()
  await page.getByLabel('Số tiền muốn rút').fill(String(commission))
  await page.getByRole('button', { name: 'Gửi yêu cầu rút' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Số dư không đủ' })).toBeVisible()
  await expect(stat(page, 'Số dư khả dụng')).toContainText(vnd(commission - 100_000))
})
