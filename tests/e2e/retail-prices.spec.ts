import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parseEnv } from 'node:util'
import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { productsIn } from '../support/dataset'
import { uniquePhone, vnd } from './helpers'

// Mỗi project (desktop / mobile) dùng sản phẩm riêng, không trùng spec khác, vì test sửa giá trong DB.
const seed = (slug: string, i: number) => {
  const p = productsIn(slug)[i]
  return { sku: p.sku, name: p.name, price: p.list_price }
}
const PRODUCTS = { desktop: seed('vat-tu', 0), mobile: seed('thuoc-bvtv', 0) } as const

function db() {
  const file = path.resolve(process.cwd(), '.env.local')
  const env = existsSync(file) ? (parseEnv(readFileSync(file, 'utf8')) as Record<string, string>) : process.env
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function addToCartAndFill(page: Page, name: string) {
  // Giới hạn 3 đơn lẻ / 10 phút theo IP: mỗi test một IP riêng để không ăn hạn mức của retail.spec.
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `198.18.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` })
  await page.goto('/')
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name }) })
  await card.getByRole('button', { name: 'Thêm vào giỏ' }).click()
  await page.getByRole('link', { name: 'Giỏ hàng (1)' }).click()
  await expect(page).toHaveURL(/\/gio-hang$/)
  const phone = uniquePhone()
  await page.getByLabel('Họ tên').fill(`Khách lẻ ${phone}`)
  await page.getByLabel('Số điện thoại').fill(phone)
  await page.getByLabel('Địa chỉ giao hàng').fill('Ấp 2, xã Tân Lợi')
}

test.describe.configure({ mode: 'serial' })

test('đồng hồ máy khách sai không làm lệch giá khuyến mãi: đặt được ngay lần đầu', async ({ page }, info) => {
  const p = PRODUCTS[info.project.name as keyof typeof PRODUCTS]
  const admin = db()
  const { data: product } = await admin.from('products').select('id').eq('sku', p.sku).single().throwOnError()
  const now = Date.now()
  const { data: promo } = await admin.from('promotions').insert({
    name: `KM e2e ${p.sku}`, scope: 'product', target_id: product.id, type: 'percent', value: 10,
    starts_at: new Date(now - 3600_000).toISOString(), ends_at: new Date(now + 86400_000).toISOString(),
  }).select('id').single().throwOnError()
  try {
    // Máy khách tưởng đang là năm 2020 (khuyến mãi chưa bắt đầu).
    await page.clock.setFixedTime(new Date('2020-01-01T00:00:00Z'))
    await addToCartAndFill(page, p.name)
    const promoPrice = p.price * 0.9
    await page.getByRole('button', { name: `Đặt hàng · ${vnd(promoPrice)}` }).click()
    await expect(page).toHaveURL(/\/dat-hang-thanh-cong\/DH/)
    await expect(page.getByText(/Tổng tiền:/)).toContainText(vnd(promoPrice))
  } finally {
    await admin.from('promotions').delete().eq('id', promo.id).throwOnError()
  }
})

test('giá đổi sau khi mở giỏ: hiện thay đổi, "Đồng ý và gửi lại" đặt được theo giá mới', async ({ page }, info) => {
  const p = PRODUCTS[info.project.name as keyof typeof PRODUCTS]
  const admin = db()
  await addToCartAndFill(page, p.name)
  const newPrice = p.price + 10_000
  await admin.from('products').update({ list_price: newPrice }).eq('sku', p.sku).throwOnError()
  try {
    await page.getByRole('button', { name: `Đặt hàng · ${vnd(p.price)}` }).click()
    const alert = page.getByRole('alert').filter({ hasText: 'Giỏ hàng vừa có thay đổi' })
    await expect(alert).toContainText('Giỏ hàng vừa có thay đổi')
    await expect(alert).toContainText(`${p.name}: giá đổi từ ${vnd(p.price)} thành ${vnd(newPrice)}`)
    await page.getByRole('button', { name: `Đồng ý và gửi lại · ${vnd(newPrice)}` }).click()
    await expect(page).toHaveURL(/\/dat-hang-thanh-cong\/DH/)
    await expect(page.getByText(/Tổng tiền:/)).toContainText(vnd(newPrice))
  } finally {
    await admin.from('products').update({ list_price: p.price }).eq('sku', p.sku).throwOnError()
  }
})
