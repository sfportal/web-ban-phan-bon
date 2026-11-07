'use client'

import { ClipboardList, House, PiggyBank, SquarePlus, Users, Wallet, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Item = { href: string; label: string; icon: LucideIcon }

/**
 * Điều hướng khu đối tác. Điện thoại: thanh đáy cố định có icon (ẩn khi đang lên đơn vì luồng
 * lên đơn có thanh đáy riêng). Từ md: dải tab nằm cuối header xanh, tab đang mở nối liền nền kem.
 * Đại lý không có mục Nông dân; "Hoa hồng" → "Tiết kiệm".
 * prefetch tắt: số liệu đơn / hoa hồng luôn lấy mới khi bấm, không dùng bản tải trước.
 */
export function PartnerNav({ kind }: { kind: 'commission' | 'wholesale' }) {
  const pathname = usePathname()
  const items: Item[] = [
    { href: '/doi-tac', label: 'Trang chủ', icon: House },
    { href: '/doi-tac/don-moi', label: 'Lên đơn', icon: SquarePlus },
    { href: '/doi-tac/don-hang', label: 'Đơn hàng', icon: ClipboardList },
    ...(kind === 'commission' ? [{ href: '/doi-tac/nong-dan', label: 'Nông dân', icon: Users }] : []),
    kind === 'commission'
      ? { href: '/doi-tac/hoa-hong', label: 'Hoa hồng', icon: Wallet }
      : { href: '/doi-tac/hoa-hong', label: 'Tiết kiệm', icon: PiggyBank },
  ]
  const isActive = (href: string) =>
    href === '/doi-tac' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
  const ordering = isActive('/doi-tac/don-moi')

  return (
    <nav
      aria-label="Khu đối tác"
      {...(ordering ? {} : { 'data-bottom-bar': 'md' })}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(28,25,23,0.06)] backdrop-blur md:static md:border-0 md:bg-transparent md:pb-0 md:shadow-none md:backdrop-blur-none ${
        ordering ? 'max-md:hidden' : ''
      }`}
    >
      <ul className="mx-auto flex max-w-3xl md:gap-1 md:px-4">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <li key={href} className="flex-1 md:flex-none">
              <Link
                href={href}
                prefetch={false}
                aria-current={active ? 'page' : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-0.5 text-[13px] font-semibold md:h-11 md:flex-row md:gap-2 md:rounded-t-xl md:px-4 md:text-base ${
                  active
                    ? 'text-primary md:bg-cream'
                    : 'text-stone-500 hover:text-primary md:text-white/85 md:hover:bg-white/10 md:hover:text-white'
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-7 w-12 items-center justify-center rounded-full md:h-auto md:w-auto ${active ? 'bg-primary-soft md:bg-transparent' : ''}`}
                >
                  <Icon className="size-5" />
                </span>
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
