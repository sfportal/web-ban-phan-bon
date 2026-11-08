import { expect, test, type Page } from '@playwright/test'
import { adminPage, partnerWithCommission, vnd } from './helpers'

const statValue = (page: Page, label: string) =>
  page.getByText(label, { exact: true }).locator('..')

test('CTV rút 100.000 → admin duyệt → đánh dấu đã chuyển (mã GD123) → ví CTV thấy "Đã chuyển", "Đã nhận" tăng', async ({ page, browser }) => {
  const { commission, name, adminPage: admin } = await partnerWithCommission(page, browser)

  await page.getByRole('navigation', { name: 'Khu đối tác' }).getByRole('link', { name: 'Ví' }).click()
  await page.getByLabel('Ngân hàng', { exact: true }).fill('Vietcombank')
  await page.getByLabel('Số tài khoản').fill('0123456789')
  await page.getByLabel('Chủ tài khoản').fill('NGUYEN VAN A')
  await page.getByRole('button', { name: 'Lưu thông tin ngân hàng' }).click()
  await page.getByRole('button', { name: 'Rút tiền' }).click()
  await page.getByLabel('Số tiền muốn rút').fill('100000')
  await page.getByRole('button', { name: 'Gửi yêu cầu rút' }).click()
  await expect(page.getByRole('list', { name: 'Khoản chi' })).toContainText('Chờ duyệt')

  // Admin: tab Yêu cầu rút.
  await admin.goto('/admin/hoa-hong')
  await expect(admin.getByRole('heading', { name: 'Chi trả', level: 1 })).toBeVisible()
  const item = admin.getByRole('list', { name: 'Yêu cầu rút' }).getByRole('listitem').filter({ hasText: name })
  await expect(item).toContainText('Vietcombank · 0123456789 · NGUYEN VAN A')
  await expect(item).toContainText(vnd(100_000))
  await item.getByRole('button', { name: 'Duyệt', exact: true }).click()
  await expect(item).toContainText('Đã duyệt')
  await expect(item.getByRole('button', { name: 'Duyệt', exact: true })).toHaveCount(0)

  await item.getByRole('button', { name: 'Đánh dấu đã chuyển' }).click()
  const dialog = admin.getByRole('dialog')
  await dialog.getByLabel('Mã giao dịch').fill('GD123')
  await dialog.getByRole('button', { name: 'Xác nhận đã chuyển' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(item).toContainText('Đã chuyển')
  await expect(item).toContainText('Mã GD: GD123')

  // Bộ lọc trạng thái.
  await admin.getByRole('navigation', { name: 'Lọc trạng thái' }).getByRole('link', { name: 'Chờ duyệt' }).click()
  await expect(admin.getByRole('list', { name: 'Yêu cầu rút' }).getByText(name)).toHaveCount(0)

  // Ví của CTV.
  await page.reload()
  await expect(page.getByRole('list', { name: 'Khoản chi' })).toContainText('Đã chuyển')
  await expect(statValue(page, 'Đã nhận')).toContainText(vnd(100_000))
  await expect(statValue(page, 'Số dư khả dụng')).toContainText(vnd(commission - 100_000))

  // Tab Số dư.
  await admin.goto('/admin/hoa-hong?tab=so-du')
  const row = admin.getByRole('row').filter({ hasText: name })
  await expect(row).toContainText(vnd(commission))
  await expect(row).toContainText(vnd(commission - 100_000))
})

test('admin tạo đợt chi và thấy kết quả đếm', async ({ browser }) => {
  const admin = await adminPage(browser)
  await admin.goto('/admin/hoa-hong?tab=dot-chi')
  await admin.getByLabel('Loại đợt').selectOption('monthly')
  // Ngày chốt hôm qua: chưa tính hoa hồng phát sinh hôm nay, nên không động vào ví của các test khác chạy song song.
  const y = new Date(Date.now() - 86_400_000 + 7 * 3600_000).toISOString().slice(0, 10)
  await admin.getByLabel('Ngày chốt').fill(y)
  await admin.getByLabel('Ghi chú').fill('Đợt thử e2e')
  await admin.getByRole('button', { name: 'Tạo đợt chi' }).click()
  await expect(admin.getByRole('status')).toContainText(/Đã tạo \d+ khoản chi\. Bỏ qua \d+ CTV thiếu ngân hàng, \d+ CTV dưới mức tối thiểu\./)

  await admin.getByRole('link', { name: /Đợt theo tháng/ }).filter({ hasText: 'Đợt thử e2e' }).first().click()
  await expect(admin.getByRole('region', { name: 'Chi tiết đợt chi' })).toBeVisible()
  await expect(admin.getByRole('button', { name: 'Đánh dấu tất cả đã chuyển' })).toBeDisabled()
})
