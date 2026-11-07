import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Vùng nội dung một trang quản trị. Mọi trang chung một mép trái (khung max-w-6xl canh giữa);
 * trang dạng biểu mẫu/danh sách hẹp (`narrow`) chỉ giới hạn bề rộng nội dung, không dời sang giữa.
 */
export function AdminMain({ width = 'wide', children }: { width?: 'narrow' | 'wide'; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col px-4 py-6 lg:px-8 lg:py-8">
      <div className={`flex w-full min-w-0 flex-col gap-6 ${width === 'narrow' ? 'max-w-3xl' : ''}`}>{children}</div>
    </main>
  )
}

/** Đầu trang: tiêu đề (h1), một dòng giải thích, nút thao tác chính bên phải (xuống dòng trên điện thoại). */
export function PageHeader({ title, subtitle, actions, back }: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  back?: { href: string; label: string }
}) {
  return (
    <header className="flex flex-col gap-3">
      {back && (
        <Link href={back.href} className="-ml-1 flex h-11 items-center gap-1 self-start font-semibold text-primary hover:text-primary-hover">
          <ChevronLeft aria-hidden className="size-5" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink lg:text-3xl">{title}</h1>
          {subtitle && <div className="mt-1 max-w-2xl text-stone-600">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}

export function Loading() {
  return <p className="py-10 text-center text-stone-600">Đang tải...</p>
}
