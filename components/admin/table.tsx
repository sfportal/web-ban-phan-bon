import type { ReactNode } from 'react'

// Bảng quản trị: nằm trong thẻ trắng, cuộn ngang bên trong thẻ (trang không bị tràn), hàng sọc nhạt.
export const thead = 'border-b border-stone-200 bg-stone-50 text-sm text-stone-600'
export const th = 'px-4 py-3 font-semibold whitespace-nowrap'
export const td = 'px-4 py-3'
export const tbody = '[&>tr:nth-child(even)]:bg-stone-50/70 [&>tr]:border-b [&>tr]:border-stone-100 [&>tr:last-child]:border-0'

export function TableCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-x-auto rounded-2xl border border-stone-200 bg-white ${className}`.trim()}>{children}</div>
  )
}
