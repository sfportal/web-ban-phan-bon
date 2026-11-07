import { expect, test } from '@playwright/test'
import {
  addProduct, adminPage, approvePartner, currentPeriodLabel, orderIdFromUrl, registerPartner, uniquePhone, vnd,
} from './helpers'

// Seed "CTV chuẩn": Phân NPK 3%, riêng "Phân bón lá Dưỡng trái to" 10%.
const NPK = { name: 'Phân NPK 16-16-8 Đầu Trâu', price: 850_000, rate: 3 }
const LA = { name: 'Phân bón lá Dưỡng trái to', price: 145_000, rate: 10 }
const ROONG = 'Phân bón lá Ra rễ cực mạnh'

test('CTV đăng ký → được duyệt → lên đơn cho 2 nông dân → đơn thu đủ tiền → thấy hoa hồng kỳ này', async ({ page, browser }) => {
  const phone = uniquePhone()
  const name = `CTV E2E ${phone}`
  const oldFarmer = { name: `Nông dân cũ ${phone.slice(-4)}`, phone: uniquePhone() }
  const newFarmer = { name: `Nông dân mới ${phone.slice(-4)}`, phone: uniquePhone() }

  await registerPartner(page, { phone, name })

  const admin = await adminPage(browser)
  await approvePartner(admin, name, 'CTV chuẩn (CTV)')

  // Đơn đầu tiên: thêm nhanh nông dân "cũ" để lần sau tìm lại được trong danh sách của CTV.
  await page.goto('/doi-tac/don-moi')
  await expect(page.getByRole('heading', { name: 'Chọn nông dân' })).toBeVisible()
  await page.getByRole('button', { name: '+ Thêm nhanh nông dân' }).click()
  await page.getByLabel('Họ tên').fill(oldFarmer.name)
  await page.getByLabel('Số điện thoại').fill(oldFarmer.phone)
  await page.getByRole('button', { name: 'Lưu và chọn' }).click()
  await expect(page.getByText(`Đang chọn cho: ${oldFarmer.name}`)).toBeVisible()
  await addProduct(page, ROONG, 1)
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await page.getByRole('button', { name: 'Gửi đơn' }).click()
  await orderIdFromUrl(page)

  // Đơn chính: một nông dân thêm mới + một nông dân tìm lại theo SĐT.
  await page.goto('/doi-tac/don-moi')
  await page.getByRole('button', { name: '+ Thêm nhanh nông dân' }).click()
  await page.getByLabel('Họ tên').fill(newFarmer.name)
  await page.getByLabel('Số điện thoại').fill(newFarmer.phone)
  await page.getByRole('button', { name: 'Lưu và chọn' }).click()
  await expect(page.getByText(`Đang chọn cho: ${newFarmer.name}`)).toBeVisible()
  await addProduct(page, NPK.name, 2)

  await page.getByRole('button', { name: '+ Nông dân khác' }).click()
  await page.getByLabel('Tìm nông dân').fill(oldFarmer.phone)
  await page.getByRole('button', { name: new RegExp(oldFarmer.name) }).click()
  await expect(page.getByText(`Đang chọn cho: ${oldFarmer.name}`)).toBeVisible()
  await addProduct(page, LA.name, 1)

  const subtotal = NPK.price * 2 + LA.price
  const commission = Math.round((NPK.price * 2 * NPK.rate) / 100) + Math.round((LA.price * LA.rate) / 100)
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page.getByRole('heading', { name: 'Xác nhận đơn' })).toBeVisible()
  await expect(page.getByRole('heading', { name: newFarmer.name })).toBeVisible()
  await expect(page.getByRole('heading', { name: oldFarmer.name })).toBeVisible()
  await expect(page.getByText('Tổng đơn').locator('..')).toContainText(vnd(subtotal))
  await expect(page.getByText('Hoa hồng dự kiến').locator('..')).toContainText(vnd(commission))
  await page.getByRole('button', { name: 'Gửi đơn' }).click()
  const orderId = await orderIdFromUrl(page)
  const code = (await page.getByRole('heading', { level: 1 }).textContent())!.match(/DH\d+-\d+/)![0]

  // Admin: new → confirmed → shipping → delivered → paid.
  await admin.goto(`/admin/don-hang/${orderId}`)
  const actions = admin.getByRole('region', { name: 'Đổi trạng thái' })
  for (const [label, next] of [
    ['Đã xác nhận', 'Đang giao'],
    ['Đang giao', 'Đã giao'],
    ['Đã giao', 'Đã thu đủ tiền'],
    ['Đã thu đủ tiền', 'Trả hàng'],
  ] as const) {
    await actions.getByRole('button', { name: label, exact: true }).click()
    await expect(actions.getByRole('button', { name: next, exact: true })).toBeVisible()
  }

  // CTV: Hoa hồng kỳ hiện tại = hoa hồng của đơn vừa thu đủ tiền (đơn đầu còn "Mới" chưa tính).
  await page.getByRole('navigation', { name: 'Khu đối tác' }).getByRole('link', { name: 'Hoa hồng' }).click()
  await expect(page.getByRole('heading', { name: 'Hoa hồng' })).toBeVisible()
  await expect(page.getByRole('link', { name: currentPeriodLabel() })).toHaveAttribute('aria-current', 'page')
  const row = page.getByRole('row').filter({ hasText: code })
  await expect(row).toContainText(vnd(commission))
  await expect(row).toContainText('Chờ chi')
  await expect(page.getByRole('row', { name: /Tổng kỳ/ })).toContainText(vnd(commission))
  await expect(page.getByRole('row')).toHaveCount(5) // tiêu đề + 1 bút toán + 3 dòng tổng
})
