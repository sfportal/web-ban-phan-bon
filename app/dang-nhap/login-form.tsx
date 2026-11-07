'use client'

import { useActionState } from 'react'
import { login } from '@/lib/auth/actions'
import { AUTH_ERROR_MESSAGE, type AuthErrorCode } from '@/lib/auth/messages'
import { AuthError, AuthField, submitButtonClass } from '@/components/AuthField'

type State = { error: AuthErrorCode; phone: string } | null

export function LoginForm({ initialError }: { initialError?: AuthErrorCode }) {
  const [state, action, pending] = useActionState<State, FormData>(async (_prev, form) => {
    const r = await login(form) // thành công thì login() chuyển trang
    return { error: r.error, phone: String(form.get('phone') ?? '') }
  }, initialError ? { error: initialError, phone: '' } : null)

  return (
    <form action={action} className="flex flex-col gap-4" key={state ? `${state.error}-${state.phone}` : 'new'}>
      <AuthError message={state ? AUTH_ERROR_MESSAGE[state.error] : undefined} />
      <AuthField label="Số điện thoại" name="phone" type="tel" inputMode="tel" autoComplete="tel"
        required defaultValue={state?.phone} />
      <AuthField label="Mật khẩu" name="password" type="password" autoComplete="current-password" required />
      <button type="submit" disabled={pending} className={submitButtonClass}>
        {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </button>
    </form>
  )
}
