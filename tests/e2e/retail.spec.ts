import { expect, test } from '@playwright/test'
import { productsIn } from '../support/dataset'
import { adminPage, uniquePhone, vnd } from './helpers'

// Không trùng sản phẩm retail-prices.spec (spec đó sửa giá trong DB).
const seed = (slug: string, i: number) => ({ name: productsIn(slug)[i].name, price: productsIn(slug)[i].list_price })
const A = seed('huu-co', 0)
const B = seed('thuoc-bvtv', 2)

test('khách lẻ thêm 2 sản phẩm, đặt COD, thấy mã đơn; admin thấy đơn trong danh sách', async ({ page, browser }) => {
  const phone = uniquePhone()
  await page.goto('/')
  for (const p of [A, B]) {
    // Sản phẩm nổi bật cũng có thẻ riêng: chọn thẻ trong lưới chính.
    const card = page.getByRole('region', { name: 'Danh sách sản phẩm' }).getByRole('listitem').filter({ has: page.getByRole('heading', { name: p.name }) })
    await card.getByRole('button', { name: 'Thêm vào giỏ' }).click()
    await expect(card.getByRole('button', { name: 'Đã thêm' })).toBeVisible()
  }
  await page.getByRole('link', { name: 'Giỏ hàng (2)' }).click()
  await expect(page).toHaveURL(/\/gio-hang$/)

  await page.getByLabel('Họ tên').fill(`Khách lẻ ${phone}`)
  await page.getByLabel('Số điện thoại').fill(phone)
  await page.getByLabel('Địa chỉ giao hàng').fill('Ấp 2, xã Tân Lợi')
  await expect(page.getByLabel('Trả tiền khi nhận hàng (COD)')).toBeChecked()
  await page.getByRole('button', { name: `Đặt hàng · ${vnd(A.price + B.price)}` }).click()

  await expect(page).toHaveURL(/\/dat-hang-thanh-cong\/DH/)
  await expect(page.getByRole('heading', { name: 'Đặt hàng thành công' })).toBeVisible()
  const code = (await page.getByText(/Mã đơn:/).textContent())!.match(/DH\d+-\d+/)![0]
  await expect(page.getByText(/Tổng tiền:/)).toContainText(vnd(A.price + B.price))

  const admin = await adminPage(browser)
  await admin.goto('/admin/don-hang')
  const row = admin.getByRole('row').filter({ hasText: code })
  await expect(row).toContainText(`Đơn lẻ: Khách lẻ ${phone}`)
  await expect(row).toContainText(vnd(A.price + B.price))
})

test('PWA: manifest mở /doi-tac ở chế độ standalone, icon 192/512 tải được', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest).toMatchObject({ start_url: '/doi-tac', display: 'standalone', theme_color: '#15803d' })
  for (const icon of manifest.icons as { src: string }[]) {
    const res = await request.get(icon.src)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toBe('image/png')
  }
})
