import { expect, test, type Page } from '@playwright/test'
import { PRODUCTS } from '../support/dataset'

// Sản phẩm có hướng dẫn sử dụng trong bộ dữ liệu (gen-seed ghi cột usage) → trang chi tiết có tab "Cách dùng".
const withUsage = PRODUCTS.find((p) => p.usage?.trim())!
const featuredCount = PRODUCTS.filter((p) => p.is_featured).length

test.beforeAll(() => {
  expect(withUsage).toBeDefined()
  expect(featuredCount).toBeGreaterThan(0)
})

test('trang chủ có mục "Sản phẩm nổi bật" với ít nhất một thẻ sản phẩm', async ({ page }) => {
  await page.goto('/')
  const featured = page.getByRole('region', { name: 'Sản phẩm nổi bật' })
  await expect(featured.getByRole('heading', { name: 'Sản phẩm nổi bật' })).toBeVisible()
  await expect(featured.getByRole('listitem').first()).toBeVisible()
  expect(await featured.getByRole('listitem').count()).toBeGreaterThanOrEqual(1)
})

test('trang chi tiết sản phẩm có tab "Cách dùng" hiện hướng dẫn', async ({ page }) => {
  await page.goto('/')
  const card = page.getByRole('region', { name: 'Danh sách sản phẩm' }).getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: withUsage.name, exact: true }) })
  await card.getByRole('link').first().click()
  await expect(page).toHaveURL(/\/san-pham\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { level: 1, name: withUsage.name })).toBeVisible()

  const tab = page.getByRole('tablist', { name: 'Thông tin sản phẩm' }).getByRole('tab', { name: 'Cách dùng' })
  await tab.click()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  const firstLine = withUsage.usage!.split('\n').map((l) => l.trim()).find(Boolean)!
  await expect(page.getByRole('tabpanel')).toContainText(firstLine)
})

test.describe('điện thoại 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  for (const [label, go] of [
    ['trang chủ', (p: Page) => p.goto('/')],
    ['trang chi tiết', async (p: Page) => {
      await p.goto('/')
      await p.getByRole('region', { name: 'Danh sách sản phẩm' }).getByRole('listitem').first().getByRole('link').first().click()
      await expect(p).toHaveURL(/\/san-pham\//)
      await expect(p.getByRole('heading', { level: 1 })).toBeVisible()
    }],
    ['giỏ hàng', (p: Page) => p.goto('/gio-hang')],
    ['đăng nhập', (p: Page) => p.goto('/dang-nhap')],
  ] as const) {
    test(`${label} không tràn ngang (scrollWidth ≤ 390)`, async ({ page }) => {
      await go(page)
      await page.waitForLoadState('networkidle')
      // Trang không rộng hơn khung nhìn 390px (không có thanh cuộn ngang).
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    })
  }
})
