// Tạo (hoặc cập nhật) tài khoản nhân viên cửa hàng đăng nhập bằng SĐT.
//   npx tsx scripts/create-staff.ts <sdt> <mat-khau> <admin|staff>
// Chạy lại với SĐT đã có: đặt lại mật khẩu và vai trò (idempotent).
//
// Script CLI chạy bằng Node thường nên không import được lib/supabase/admin.ts
// (`server-only` throw ngoài React Server Components); tự tạo client service role ở
// đây. File này không bao giờ được bundle cho trình duyệt.
import { existsSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { normalizePhone, phoneToEmail } from '../lib/phone'
import type { Database } from '../lib/supabase/database.types'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

async function findUserId(admin: SupabaseClient<Database>, email: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const u = data.users.find((x) => x.email === email)
    if (u) return u.id
    if (data.users.length < 1000) return null
  }
}

async function main() {
  const [rawPhone, password, role] = process.argv.slice(2)
  const usage = 'Cách dùng: npx tsx scripts/create-staff.ts <sdt> <mat-khau> <admin|staff>'
  if (!rawPhone || !password || (role !== 'admin' && role !== 'staff')) fail(usage)
  const phone = normalizePhone(rawPhone)
  if (!phone) fail('Số điện thoại không hợp lệ')
  if (password.length < 8) fail('Mật khẩu cần ít nhất 8 ký tự')

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && existsSync('.env.local')) process.loadEnvFile('.env.local')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) fail('Thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env.local)')
  const admin = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const email = phoneToEmail(phone)
  let userId = await findUserId(admin, email)
  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true })
    if (error) throw error
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw error
    userId = data.user.id
  }
  await admin.from('staff').upsert({ user_id: userId, role }).throwOnError()
  console.log(`Đã ${role === 'admin' ? 'tạo quản trị viên' : 'tạo nhân viên'} ${phone}`)
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)))
