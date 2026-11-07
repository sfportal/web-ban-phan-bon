import type { InputHTMLAttributes } from 'react'

// Ô nhập của form đăng nhập/đăng ký: chữ 16px, cao 48px cho màn hình điện thoại.
export function AuthField({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-base">
      <span className="font-semibold text-ink">{label}</span>
      <input
        {...input}
        className="h-12 rounded-xl border border-stone-300 bg-white px-3.5 text-base text-ink shadow-sm shadow-stone-900/[0.03] placeholder:text-stone-400 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
      />
    </label>
  )
}

export function AuthError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-base font-semibold text-red-800">{message}</p>
  ) : null
}

export const submitButtonClass =
  'mt-1 h-[52px] rounded-xl bg-primary px-4 text-lg font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60'
