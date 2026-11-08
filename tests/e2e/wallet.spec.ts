import { expect, test, type Browser, type Page } from '@playwright/test'
import { addProduct, adminPage, approvePartner, orderIdFromUrl, registerPartner, uniquePhone, vnd } from './helpers'
import { category, productsIn } from '../support/dataset'

const npk = productsIn('npk')[0]
const RATE = category('npk').rates.ctv
const QTY = 12 // hoa hồng ≥ 300.000: sau khi rút 100.000 số dư vẫn ≥ mức tối thiểu

/** CTV mới → admin duyệt → lên đơn NPK → admin đẩy đơn tới "Đã thu đủ tiền". Trả về hoa hồng và mã đơn. */
async function partnerWithCommission(page: Page, browser: Browser) {
  const phone = uniquePhone()
  const name = `CTV Ví ${phone}`
  await registerPartner(page, { phone, name })
  const admin = await adminPage(browser)
  await approvePartner(admin, name, 'CTV chuẩn (CTV)')

  await page.goto('/doi-tac/don-moi')
  await page.getByRole('button', { name: '+ Thêm nhanh nông dân' }).click()
  await page.getByLabel('Họ tên').fill(`Nông dân ví ${phone.slice(-4)}`)
  await page.getByLabel('Số điện thoại').fill(uniquePhone())
  await page.getByRole('button', { name: 'Lưu và chọn' }).click()
  await addProduct(page, npk.name, QTY)
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await page.getByRole('button', { name: 'Gửi đơn' }).click()
  const orderId = await orderIdFromUrl(page)
  const code = (await page.getByRole('heading', { level: 1 }).textContent())!.match(/DH\d+-\d+/)![0]

  await admin.goto(`/admin/don-hang/${orderId}`)
  const actions = admin.getByRole('region', { name: 'Đổi trạng thái' })
  for (const [label, next] of [
    ['Đã xác nhận', 'Đang giao'],
    ['Đang giao', 'Đã giao'],
    ['Đã giao', 'Đã thu đủ tiền'],
    ['Đã thu đủ tiền', 'Trả hàng'],
  ] as const) {
    await actions.getByRole('button', { name: label, exact: true }).click()
    await expect(actions.getByRole('button', { name: label, exact: true })).toHaveCount(0)
    await expect(actions.getByRole('button', { name: next, exact: true })).toBeVisible()
  }
  return { commission: Math.round((npk.list_price * QTY * RATE) / 100), code }
}

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
