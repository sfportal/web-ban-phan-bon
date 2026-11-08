'use server'

import { redirect } from 'next/navigation'
import { normalizePhone, phoneToEmail } from '@/lib/phone'
import { adminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

export type RegisterResult =
  | { ok: true }
  | { error: 'invalid_phone' | 'phone_taken' | 'weak_password' | 'missing_fields' }

export type LoginResult = { error: 'invalid_credentials' | 'locked' }

const text = (form: FormData, key: string) => {
  const v = form.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

/** Đối tác tự đăng ký: tạo tài khoản + hồ sơ `pending`, rồi đăng nhập luôn. */
export async function registerPartner(form: FormData): Promise<RegisterResult> {
  const name = text(form, 'name')
  const region = text(form, 'region')
  const deliveryAddress = text(form, 'delivery_address')
  const rawPhone = text(form, 'phone')
  const pw = form.get('password')
  const password = typeof pw === 'string' ? pw : ''
  if (!rawPhone || !name || !region || !deliveryAddress || !password) return { error: 'missing_fields' }

  const phone = normalizePhone(rawPhone)
  if (!phone) return { error: 'invalid_phone' }
  if (password.length < 8) return { error: 'weak_password' }

  const admin = adminClient()
  const email = phoneToEmail(phone)
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (createError) {
    if (createError.code === 'email_exists' || createError.code === 'user_already_exists') {
      return { error: 'phone_taken' }
    }
    throw createError
  }

  const userId = created.user.id
  const { error: insertError } = await admin.from('partners').insert({
    user_id: userId, phone, name, region, delivery_address: deliveryAddress, status: 'pending',
  })
  if (insertError) {
    await admin.auth.admin.deleteUser(userId)
    if (insertError.code === '23505') return { error: 'phone_taken' }
    throw insertError
  }

  const { error: signInError } = await createServerClient().auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  return { ok: true }
}

/** Đăng nhập bằng SĐT + mật khẩu. Thành công: staff → /admin, đối tác → /doi-tac. */
export async function login(form: FormData): Promise<LoginResult> {
  const phone = normalizePhone(text(form, 'phone'))
  const pw = form.get('password')
  if (!phone || typeof pw !== 'string' || !pw) return { error: 'invalid_credentials' }

  const supabase = createServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email: phoneToEmail(phone), password: pw })
  if (error || !data.user) return { error: 'invalid_credentials' }
  const userId = data.user.id

  const { data: staff } = await supabase
    .from('staff').select('role').eq('user_id', userId).maybeSingle().throwOnError()
  if (staff) redirect('/admin')

  const { data: partner } = await supabase
    .from('partners').select('status').eq('user_id', userId).maybeSingle().throwOnError()
  if (!partner || partner.status === 'locked') {
    await supabase.auth.signOut()
    return { error: partner ? 'locked' : 'invalid_credentials' }
  }
  redirect('/doi-tac')
}
