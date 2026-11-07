import type { InputHTMLAttributes } from 'react'

// Ô nhập của form đăng nhập/đăng ký: chữ 16px, cao 48px cho màn hình điện thoại.
export function AuthField({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-base">
      <span className="font-semibold">{label}</span>
      <input
        {...input}
        className="h-12 rounded-lg border border-gray-300 px-3 text-base focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/30"
      />
    </label>
  )
}

export function AuthError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="rounded-lg bg-red-50 p-3 text-base text-red-700">{message}</p>
  ) : null
}

export const submitButtonClass =
  'h-12 rounded-lg bg-green-700 px-4 text-base font-semibold text-white disabled:opacity-60'
