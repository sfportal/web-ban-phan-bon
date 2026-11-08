import { LogOut, Sprout } from 'lucide-react'
import Link from 'next/link'
import { AdminNav } from '@/components/admin/AdminNav'
import { requireStaff } from '@/lib/auth/guards'
import { SITE_NAME } from '@/lib/site'

// Guard đọc phiên (cookie) ở đầu layout nên segment chặn trên server: chưa đủ quyền thì
// redirect HTTP trước khi gửi bất kỳ nội dung nhân viên nào.
export const instant = false

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const staff = await requireStaff()
  return (
    <div className="flex flex-1 flex-col text-base lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:bg-primary-hover print:block print:bg-white">
      {/* Thanh bên xanh: cùng chất liệu với header khu đối tác (gradient + quầng vàng lúa). In phiếu: ẩn hẳn. */}
      <aside className="relative z-20 isolate overflow-hidden bg-gradient-to-b from-primary to-primary-hover text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:overflow-y-auto print:hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-20 -z-10 size-72 rounded-full bg-[radial-gradient(circle,rgba(202,138,4,0.4)_0%,rgba(202,138,4,0)_70%)] max-lg:-right-16 max-lg:-top-24 max-lg:bottom-auto max-lg:left-auto"
        />
        <AdminNav
          role={staff.role}
          brand={
            <Link href="/admin" className="flex min-w-0 items-center gap-3 py-1">
              <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/25">
                <Sprout className="size-6 text-accent-soft" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-lg font-bold leading-tight tracking-tight">{SITE_NAME}</span>
                <span className="block text-sm text-white/80">{staff.role === 'admin' ? 'Quản trị' : 'Nhân viên'}</span>
              </span>
            </Link>
          }
          footer={
            <form method="post" action="/dang-xuat" className="border-t border-white/15 pt-3">
              <button type="submit" className="flex h-11 w-full items-center gap-3 rounded-xl px-3 font-semibold text-white/85 hover:bg-white/10 hover:text-white">
                <LogOut aria-hidden className="size-5 text-white/70" />
                Đăng xuất
              </button>
            </form>
          }
        />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-cream print:bg-white">{children}</div>
    </div>
  )
}
