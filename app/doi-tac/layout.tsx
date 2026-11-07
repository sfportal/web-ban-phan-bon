import { LogOut, Sprout } from 'lucide-react'
import Link from 'next/link'
import { PartnerNav } from '@/components/PartnerNav'
import { logout } from '@/lib/auth/actions'
import { requirePartner } from '@/lib/auth/guards'

// Guard đọc phiên (cookie) ở đầu layout nên segment chặn trên server: chưa đủ quyền thì
// redirect HTTP trước khi gửi bất kỳ nội dung đối tác nào.
export const instant = false

export default async function PartnerLayout({ children }: LayoutProps<'/doi-tac'>) {
  const partner = await requirePartner()
  return (
    <div className="flex flex-1 flex-col text-base">
      <header className="relative z-20 overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-hover text-white">
        <div
          aria-hidden
          className="absolute -right-16 -top-24 -z-10 size-72 rounded-full bg-[radial-gradient(circle,rgba(202,138,4,0.45)_0%,rgba(202,138,4,0)_70%)]"
        />
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pb-4 pt-3 md:pb-3 md:pt-4">
          <Link href="/doi-tac" prefetch={false} className="flex min-w-0 items-center gap-3 py-1">
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/25">
              <Sprout className="size-6 text-accent-soft" />
            </span>
            <span className="min-w-0">
              <span className="line-clamp-2 text-lg font-bold leading-tight tracking-tight">Chào, {partner.name}</span>
              <span className="block text-sm text-white/80">{partner.kind === 'commission' ? 'Cộng tác viên' : 'Đại lý'}</span>
            </span>
          </Link>
          <form action={logout} className="shrink-0">
            <button
              type="submit"
              className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-white/30 px-2.5 font-semibold text-white hover:bg-white/10 sm:px-3"
            >
              <LogOut aria-hidden className="size-5" />
              <span className="sr-only sm:not-sr-only">Đăng xuất</span>
            </button>
          </form>
        </div>
        <PartnerNav kind={partner.kind} />
      </header>
      {children}
    </div>
  )
}
