'use client'

import Link from 'next/link'
import { useCart } from '@/lib/cart/use-cart'

/** Nút nổi "Giỏ hàng (n)" và nút "Chat Zalo" (chỉ hiện khi có link). */
export function FloatingActions({ zaloLink }: { zaloLink: string | null }) {
  const { items } = useCart()
  const count = items.reduce((n, i) => n + i.qty, 0)
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 flex justify-end gap-2 p-3">
      {zaloLink && (
        <a
          href={zaloLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center rounded-full bg-blue-600 px-5 font-semibold text-white shadow-lg"
        >
          Chat Zalo
        </a>
      )}
      <Link
        href="/gio-hang"
        className="flex h-12 items-center rounded-full bg-green-700 px-5 font-semibold text-white shadow-lg"
      >
        Giỏ hàng ({count})
      </Link>
    </div>
  )
}
