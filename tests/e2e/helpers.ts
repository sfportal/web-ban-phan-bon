import { expect, type Browser, type Page } from '@playwright/test'
import { category, productsIn } from '../support/dataset'

// Tài khoản admin cố định do global-setup tạo (create-staff idempotent).
export const ADMIN = { phone: '0999000111', password: 'admin-e2e-123' }
export const PARTNER_PASSWORD = 'matkhau-e2e'

/** auth.users giữ nguyên qua db:reset → mỗi lần chạy dùng SĐT mới (10 số, đầu 09). */
export function uniquePhone(): string {
  return `09${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`
}

/** Chuỗi tiền như formatVnd hiển thị: 1.845.000 đ */
export function vnd(n: number): string {
  return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} đ`
}

/** "Tháng MM/YYYY" của tháng hiện tại theo giờ Việt Nam (kỳ hoa hồng). */
export function currentPeriodLabel(): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' })
    .formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return `Tháng ${get('month')}/${get('year')}`
}

export async function login(page: Page, phone: string, password: string) {
  await page.goto('/dang-nhap')
  // Khi Suspense thay form dự phòng bằng form thật, có lúc cả hai cùng nằm trong DOM: chờ còn một.
  await expect(page.getByLabel('Số điện thoại')).toHaveCount(1)
  await page.getByLabel('Số điện thoại').fill(phone)
  await page.getByLabel('Mật khẩu').fill(password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
}

/** Trang admin trong context riêng (phiên đăng nhập tách khỏi `page` của đối tác / khách). */
export async function adminPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  await login(page, ADMIN.phone, ADMIN.password)
  await expect(page).toHaveURL(/\/admin$/)
  return page
}

export async function registerPartner(page: Page, p: { phone: string; name: string }) {
  await page.goto('/dang-ky')
  await page.getByLabel('Số điện thoại').fill(p.phone)
  await page.getByLabel('Họ tên').fill(p.name)
  await page.getByLabel('Khu vực (huyện, tỉnh)').fill('Krông Pắc, Đắk Lắk')
  await page.getByLabel('Địa chỉ nhận hàng').fill('Thôn 3, xã Ea Phê')
  await page.getByLabel('Mật khẩu (ít nhất 8 ký tự)').fill(PARTNER_PASSWORD)
  await page.getByRole('button', { name: 'Đăng ký' }).click()
  await expect(page).toHaveURL(/\/cho-duyet$/)
  await expect(page.getByRole('heading', { name: 'Tài khoản đang chờ duyệt' })).toBeVisible()
}

/** Admin mở tab "Chờ duyệt", chọn đối tác theo tên, gán bậc (nhãn trong ô chọn) và duyệt. */
export async function approvePartner(admin: Page, name: string, tierOption: string) {
  await admin.goto('/admin/doi-tac?tab=cho-duyet')
  await admin.getByRole('link', { name: new RegExp(name) }).click()
  await expect(admin.getByRole('heading', { name })).toBeVisible()
  await admin.getByLabel('Bậc').selectOption({ label: tierOption })
  await admin.getByRole('button', { name: 'Duyệt' }).click()
  await expect(admin.getByRole('status')).toHaveText('Đã lưu')
  await expect(admin.getByText('Hoạt động', { exact: true })).toBeVisible()
}

/** Bước chọn sản phẩm (đơn đối tác): lọc "Tất cả", tìm theo tên, thêm rồi chỉnh số lượng. */
export async function addProduct(page: Page, name: string, qty: number) {
  await page.getByRole('tab', { name: 'Tất cả', exact: true }).click()
  await page.getByLabel('Tìm sản phẩm').fill(name)
  const row = page.getByRole('listitem').filter({ hasText: name })
  await row.getByRole('button', { name: '+ Thêm' }).click()
  for (let i = 1; i < qty; i++) await row.getByRole('button', { name: 'Tăng' }).click()
  await expect(row.getByRole('textbox', { name: `Số lượng ${name}` })).toHaveValue(String(qty))
  await page.getByLabel('Tìm sản phẩm').fill('')
}

/** id đơn từ URL /doi-tac/don-hang/<id> sau khi gửi đơn. */
export async function orderIdFromUrl(page: Page): Promise<string> {
  await expect(page).toHaveURL(/\/doi-tac\/don-hang\/[0-9a-f-]{36}$/)
  return page.url().split('/').pop()!
}

const npk = productsIn('npk')[0]
const RATE = category('npk').rates.ctv
const QTY = 12 // hoa hồng ≥ 300.000: sau khi rút 100.000 số dư vẫn ≥ mức tối thiểu

/** CTV mới → admin duyệt → lên đơn NPK → admin đẩy đơn tới "Đã thu đủ tiền". Trả về hoa hồng và mã đơn. */
export async function partnerWithCommission(page: Page, browser: Browser) {
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
  return { name, adminPage: admin, commission: Math.round((npk.list_price * QTY * RATE) / 100), code }
}

