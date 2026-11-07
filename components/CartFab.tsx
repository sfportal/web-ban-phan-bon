'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCart } from '@/lib/cart/use-cart'

/** Chỉ nhận link http(s) để tránh `javascript:` hay scheme lạ trong setting. */
function safeHttpUrl(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null
}

/**
 * Nút nổi "Giỏ hàng (n)" và nút "Chat Zalo" (chỉ hiện khi có link http/https).
 * Lớp bọc không nhận chạm để không che nội dung bên dưới; ẩn trên trang giỏ hàng để
 * không che nút đặt hàng.
 */
export function FloatingActions({ zaloLink }: { zaloLink: string | null }) {
  const { items } = useCart()
  const pathname = usePathname()
  if (pathname === '/gio-hang') return null
  const count = items.reduce((n, i) => n + i.qty, 0)
  const zalo = safeHttpUrl(zaloLink)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-end gap-2 p-3">
      {zalo && (
        <a
          href={zalo}
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto flex h-12 items-center rounded-full bg-blue-600 px-5 font-semibold text-white shadow-lg"
        >
          Chat Zalo
        </a>
      )}
      <Link
        href="/gio-hang"
        className="pointer-events-auto flex h-12 items-center rounded-full bg-green-700 px-5 font-semibold text-white shadow-lg"
      >
        Giỏ hàng ({count})
      </Link>
    </div>
  )
}
