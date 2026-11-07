'use client'

import { MessageCircle } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { safeHttpUrl } from '@/lib/site'

/**
 * Nút nổi "Chat Zalo" (chỉ hiện khi có link http/https). Giỏ hàng nằm trên header dính.
 * Ẩn trên trang giỏ hàng để không che nút đặt hàng; ở trang chi tiết (điện thoại) nâng lên
 * trên thanh "Thêm vào giỏ" dính đáy.
 */
export function FloatingActions({ zaloLink }: { zaloLink: string | null }) {
  const pathname = usePathname()
  const zalo = safeHttpUrl(zaloLink)
  if (!zalo || pathname === '/gio-hang') return null
  const raised = pathname.startsWith('/san-pham/')
  return (
    <a
      href={zalo}
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed right-3 z-20 flex h-12 items-center gap-2 rounded-full bg-sky-600 px-4 font-semibold text-white shadow-lg shadow-sky-900/20 hover:bg-sky-700 ${
        raised ? 'bottom-24 md:bottom-4' : 'bottom-4'
      }`}
    >
      <MessageCircle aria-hidden className="size-5" />
      Chat Zalo
    </a>
  )
}
