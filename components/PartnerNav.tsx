'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** Thanh điều hướng khu đối tác (dưới header). Đại lý không có mục Nông dân; "Hoa hồng" → "Tiết kiệm". */
export function PartnerNav({ kind }: { kind: 'commission' | 'wholesale' }) {
  const pathname = usePathname()
  const items = [
    { href: '/doi-tac', label: 'Tổng quan' },
    { href: '/doi-tac/don-hang', label: 'Đơn hàng' },
    ...(kind === 'commission' ? [{ href: '/doi-tac/nong-dan', label: 'Nông dân' }] : []),
    { href: '/doi-tac/hoa-hong', label: kind === 'commission' ? 'Hoa hồng' : 'Tiết kiệm' },
  ]
  const isActive = (href: string) =>
    href === '/doi-tac' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
  return (
    <nav aria-label="Khu đối tác" className="overflow-x-auto border-b">
      <ul className="flex min-w-max">
        {items.map(({ href, label }) => (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              className={`flex h-11 items-center justify-center whitespace-nowrap border-b-2 px-2 font-semibold ${
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
