'use client'

import {
  ClipboardList, Layers, LayoutDashboard, Menu, Package, Percent, Settings, Sprout, Tags, Users, Wallet, X, type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode } from 'react'

type Item = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean }

// Nhóm theo công việc: việc hằng ngày (đơn, tiền) trên cùng, danh mục, rồi con người.
const GROUPS: { title?: string; items: Item[] }[] = [
  {
    items: [
      { href: '/admin', label: 'Tổng quan', icon: LayoutDashboard },
      { href: '/admin/don-hang', label: 'Đơn hàng', icon: ClipboardList },
      { href: '/admin/hoa-hong', label: 'Hoa hồng', icon: Wallet },
    ],
  },
  {
    title: 'Hàng hóa',
    items: [
      { href: '/admin/san-pham', label: 'Sản phẩm', icon: Package },
      { href: '/admin/nhom', label: 'Nhóm', icon: Tags },
      { href: '/admin/bac-doi-tac', label: 'Bậc & tỷ lệ', icon: Layers },
      { href: '/admin/khuyen-mai', label: 'Khuyến mãi', icon: Percent },
    ],
  },
  {
    title: 'Khách hàng',
    items: [
      { href: '/admin/doi-tac', label: 'Đối tác', icon: Users },
      { href: '/admin/nong-dan', label: 'Nông dân', icon: Sprout },
    ],
  },
  { items: [{ href: '/admin/cai-dat', label: 'Cài đặt', icon: Settings, adminOnly: true }] },
]

/**
 * Thanh bên khu quản trị. Từ lg: cột trái cố định, mục đang mở nối liền vùng nội dung kem.
 * Dưới lg: thanh trên cùng, nút Menu mở danh sách (bấm một mục thì tự đóng).
 * `brand` và `footer` do layout (server) truyền vào: tên cửa hàng, nút đăng xuất.
 */
export function AdminNav({ role, brand, footer }: { role: 'admin' | 'staff'; brand?: ReactNode; footer?: ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const isActive = (href: string) =>
    href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => role === 'admin' || !i.adminOnly) })).filter(
    (g) => g.items.length > 0,
  )

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5 lg:pb-6 lg:pt-6">
        <div className="min-w-0">{brand}</div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="admin-menu"
          aria-label={open ? 'Đóng menu' : 'Mở menu'}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/30 text-white hover:bg-white/10 lg:hidden"
        >
          {open ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
        </button>
      </div>
      <div id="admin-menu" className={`${open ? 'flex' : 'max-lg:hidden'} flex-1 flex-col gap-4 pb-4 lg:flex`}>
        <nav aria-label="Khu quản trị" className="flex flex-col gap-4">
          {groups.map((g, gi) => (
            <div key={gi} className="flex flex-col gap-1">
              {g.title && <p className="px-5 pb-1 text-sm font-semibold text-white/60 lg:px-6">{g.title}</p>}
              <ul className="flex flex-col gap-0.5 pl-3 max-lg:pr-3">
                {g.items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href)
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex h-11 items-center gap-3 rounded-xl px-3 font-semibold ${
                          active
                            ? 'bg-cream text-primary lg:rounded-r-none'
                            : 'text-white/85 hover:bg-white/10 hover:text-white lg:mr-3'
                        }`}
                      >
                        <Icon aria-hidden className={`size-5 shrink-0 ${active ? 'text-primary' : 'text-white/70'}`} />
                        {label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
        {footer && <div className="mt-auto px-3">{footer}</div>}
      </div>
    </>
  )
}
