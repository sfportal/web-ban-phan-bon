'use client'

import { useRouter } from 'next/navigation'
import { useActionState } from 'react'
import { registerPartner } from '@/lib/auth/actions'
import { AUTH_ERROR_MESSAGE, type AuthErrorCode } from '@/lib/auth/messages'
import { AuthError, AuthField, submitButtonClass } from '@/components/AuthField'

type Values = { phone: string; name: string; region: string; delivery_address: string }
type State = { error: AuthErrorCode; values: Values } | null

export function RegisterForm() {
  const router = useRouter()
  const [state, action, pending] = useActionState<State, FormData>(async (_prev, form) => {
    const r = await registerPartner(form)
    if ('ok' in r) {
      router.replace('/cho-duyet')
      return null
    }
    const v = (k: keyof Values) => String(form.get(k) ?? '')
    return { error: r.error, values: { phone: v('phone'), name: v('name'), region: v('region'), delivery_address: v('delivery_address') } }
  }, null)
  const values = state?.values

  return (
    <form action={action} className="flex flex-col gap-4" key={state ? JSON.stringify(state) : 'new'}>
      <AuthError message={state ? AUTH_ERROR_MESSAGE[state.error] : undefined} />
      <AuthField label="Số điện thoại" name="phone" type="tel" inputMode="tel" autoComplete="tel"
        required defaultValue={values?.phone} />
      <AuthField label="Họ tên" name="name" autoComplete="name" required defaultValue={values?.name} />
      <AuthField label="Khu vực (huyện, tỉnh)" name="region" required defaultValue={values?.region} />
      <AuthField label="Địa chỉ nhận hàng" name="delivery_address" autoComplete="street-address"
        required defaultValue={values?.delivery_address} />
      <AuthField label="Mật khẩu (ít nhất 8 ký tự)" name="password" type="password"
        autoComplete="new-password" minLength={8} required />
      <button type="submit" disabled={pending} className={submitButtonClass}>
        {pending ? 'Đang gửi…' : 'Đăng ký'}
      </button>
    </form>
  )
}
