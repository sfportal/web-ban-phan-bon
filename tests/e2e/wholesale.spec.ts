import { expect, test } from '@playwright/test'
import { category, productsIn } from '../support/dataset'
import { addProduct, adminPage, approvePartner, orderIdFromUrl, registerPartner, uniquePhone, vnd } from './helpers'

// Seed "Đại lý cấp 1": tỷ lệ theo nhóm (data/categories.json). Giá đại lý = round(giá bán × (1 − %)).
const pick = (slug: string, i: number) => {
  const p = productsIn(slug)[i]
  return { name: p.name, price: p.list_price, rate: category(slug).rates.dai_ly }
}
const NPK = pick('npk', 0)
const ROONG = pick('phan-bon-la', 2)
const unitPay = (p: { price: number; rate: number }) => Math.round(p.price * (1 - p.rate / 100))

test('đại lý lên đơn: "Bạn trả" đúng chiết khấu; bấm "Gửi đơn" hai lần chỉ tạo một đơn', async ({ page, browser }) => {
  const phone = uniquePhone()
  const name = `Đại lý E2E ${phone}`
  await registerPartner(page, { phone, name })
  const admin = await adminPage(browser)
  await approvePartner(admin, name, 'Đại lý cấp 1 (Đại lý)')
  await admin.context().close()

  await page.goto('/doi-tac/don-moi')
  await expect(page.getByRole('heading', { name: 'Chọn sản phẩm' })).toBeVisible()
  await addProduct(page, NPK.name, 2)
  await addProduct(page, ROONG.name, 3)
  await page.getByRole('button', { name: 'Tiếp tục' }).click()

  await expect(page.getByRole('heading', { name: 'Xác nhận đơn' })).toBeVisible()
  const retail = NPK.price * 2 + ROONG.price * 3
  const pay = unitPay(NPK) * 2 + unitPay(ROONG) * 3
  await expect(page.getByText('Tổng theo giá bán lẻ').locator('..')).toContainText(vnd(retail))
  await expect(page.getByText('Bạn trả').locator('..')).toContainText(vnd(pay))
  await expect(page.getByRole('main').getByText('Tiết kiệm', { exact: true }).locator('..')).toContainText(vnd(retail - pay))

  // Hai cú bấm trong cùng một tác vụ, trước khi React kịp vô hiệu hóa nút: cả hai lần gửi
  // tới server (cùng client_key) — chỉ được tạo một đơn. (dblclick() của Playwright thì lần
  // bấm thứ hai rơi vào nút đã disabled nên không kiểm được phía server.)
  await page.getByRole('button', { name: 'Gửi đơn' }).evaluate((b: HTMLButtonElement) => {
    b.click()
    b.click()
  })
  await orderIdFromUrl(page)
  await expect(page.getByText('Phải trả').locator('..')).toContainText(vnd(pay))

  await page.goto('/doi-tac/don-hang')
  await expect(page.getByText(/DH\d+-\d+/)).toHaveCount(1)
})
