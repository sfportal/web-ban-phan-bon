'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/admin', label: 'Tổng quan' },
  { href: '/admin/san-pham', label: 'Sản phẩm' },
  { href: '/admin/nhom', label: 'Nhóm' },
  { href: '/admin/bac-doi-tac', label: 'Bậc & tỷ lệ' },
  { href: '/admin/khuyen-mai', label: 'Khuyến mãi' },
  { href: '/admin/doi-tac', label: 'Đối tác' },
  { href: '/admin/nong-dan', label: 'Nông dân' },
]

/** Thanh điều hướng khu quản trị (dưới header); cuộn ngang được trên điện thoại. */
export function AdminNav() {
  const pathname = usePathname()
  const isActive = (href: string) =>
    href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
  return (
    <nav aria-label="Khu quản trị" className="overflow-x-auto border-b">
      <ul className="flex min-w-max gap-1 px-2">
        {ITEMS.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              className={`flex h-11 items-center whitespace-nowrap border-b-2 px-3 font-semibold ${
                isActive(href) ? 'border-green-700 text-green-800' : 'border-transparent text-gray-600'
              }`}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
