import { expect, test, type Page } from '@playwright/test'
import { PRODUCTS } from '../support/dataset'

const normalize = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

// Sản phẩm có cả "phân" và "bón" liền nhau trong tên (bỏ dấu) → kết quả mong đợi của từ khóa "phân bón".
const expected = PRODUCTS.filter((p) => normalize(`${p.name} ${p.sku} ${p.brand ?? ''}`).includes('phan bon'))

async function expectFiltered(page: Page) {
  const search = page.getByRole('searchbox', { name: 'Tìm trong cửa hàng' })
  await expect(search).toHaveValue('phân bón')
  await expect(page).toHaveURL(/[?&]q=ph%C3%A2n(\+|%20)b%C3%B3n/)
  const grid = page.getByRole('region', { name: 'Danh sách sản phẩm' })
  await expect(grid.getByRole('listitem')).toHaveCount(expected.length)
  await expect(grid.getByText(`${expected.length} kết quả cho “phân bón”`)).toBeVisible()
}

test.beforeAll(() => expect(expected.length).toBeGreaterThan(0))

test('gõ từng phím "phân bón" ở header: giữ dấu cách, lưới lọc đúng', async ({ page }) => {
  await page.goto('/')
  const search = page.getByRole('searchbox', { name: 'Tìm trong cửa hàng' })
  await search.click()
  await search.pressSequentially('phân bón')
  await expectFiltered(page)
})

test('điền một lần "phân bón": lưới lọc đúng', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('searchbox', { name: 'Tìm trong cửa hàng' }).fill('phân bón')
  await expectFiltered(page)
})
