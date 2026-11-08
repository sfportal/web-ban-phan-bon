import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'
import { adminPage, approvePartner, login, registerPartner, uniquePhone } from './helpers'

/** Sau đăng xuất: ở /dang-nhap, cookie phiên đã xóa, vào lại khu cần đăng nhập thì bị đưa về /dang-nhap. */
async function expectLoggedOut(page: Page, protectedPath: string) {
  await expect(page).toHaveURL(/\/dang-nhap$/)
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible()
  expect((await page.context().cookies()).filter((c) => c.name.startsWith('sb-'))).toEqual([])
  await page.goto(protectedPath)
  await expect(page).toHaveURL(/\/dang-nhap$/)
}

// Đối tác chờ duyệt không bị kẹt ở /cho-duyet: đăng xuất được và về được trang chủ.
test('trang chờ duyệt: đăng xuất xóa phiên và đưa về /dang-nhap', async ({ page }) => {
  await registerPartner(page, { phone: uniquePhone(), name: 'Đại lý Chờ Duyệt Xuất' })
  await page.getByRole('button', { name: 'Đăng xuất' }).click()
  await expectLoggedOut(page, '/doi-tac')
})

// Nút đăng xuất là form POST thuần tới /dang-xuat: chạy cả khi không có JS / ID Server Action cũ.
test('trang chờ duyệt: đăng xuất chạy cả khi không có JavaScript', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false })
  const page = await ctx.newPage()
  // Đăng ký cần JS: dùng context có JS rồi chuyển phiên sang context không JS.
  const jsPage = await browser.newPage()
  await registerPartner(jsPage, { phone: uniquePhone(), name: 'Đại lý Không JS' })
  await ctx.addCookies(await jsPage.context().cookies())
  await page.goto('/cho-duyet')
  await page.getByRole('button', { name: 'Đăng xuất' }).click()
  await expect(page).toHaveURL(/\/dang-nhap$/)
  expect((await ctx.cookies()).filter((c) => c.name.startsWith('sb-'))).toEqual([])
  await ctx.close()
  await jsPage.context().close()
})

test('trang chờ duyệt: có lối về trang chủ và cửa hàng hiện bình thường', async ({ page }) => {
  await registerPartner(page, { phone: uniquePhone(), name: 'Đại lý Chờ Duyệt Về' })

  await page.getByRole('link', { name: 'Về trang chủ' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Tài khoản đang chờ duyệt' })).toHaveCount(0)

  // Tải lại trực tiếp vẫn ở trang chủ / trang đăng nhập (không bị chuyển hướng).
  await page.goto('/')
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/dang-nhap')
  await expect(page).toHaveURL(/\/dang-nhap$/)
})

test('khu đối tác: đăng xuất từ header', async ({ page, browser }) => {
  const phone = uniquePhone()
  const name = `Đại lý Đăng Xuất ${phone.slice(-4)}` // tên duy nhất: admin chọn đối tác theo tên
  await registerPartner(page, { phone, name })
  const admin = await adminPage(browser)
  await approvePartner(admin, name, 'CTV chuẩn (CTV)')
  await admin.context().close()

  await page.goto('/doi-tac')
  await expect(page.getByText(`Chào, ${name}`)).toBeVisible()
  await page.getByRole('button', { name: 'Đăng xuất' }).click()
  await expectLoggedOut(page, '/doi-tac')
})

test('khu quản trị: đăng xuất từ thanh bên', async ({ browser }) => {
  // Nhân viên riêng cho test: signOut thu hồi mọi phiên của tài khoản, không đụng admin dùng chung.
  const staff = { phone: uniquePhone(), password: 'nhanvien-e2e-123' }
  execFileSync('npx', ['tsx', 'scripts/create-staff.ts', staff.phone, staff.password, 'staff'])
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  await login(page, staff.phone, staff.password)
  await expect(page).toHaveURL(/\/admin$/)
  await page.getByRole('button', { name: 'Đăng xuất' }).click()
  await expectLoggedOut(page, '/admin')
  await page.context().close()
})
