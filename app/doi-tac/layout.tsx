import { logout } from '@/lib/auth/actions'
import { requirePartner } from '@/lib/auth/guards'

// Guard đọc phiên (cookie) ở đầu layout nên segment chặn trên server: chưa đủ quyền thì
// redirect HTTP trước khi gửi bất kỳ nội dung đối tác nào.
export const instant = false

export default async function PartnerLayout({ children }: LayoutProps<'/doi-tac'>) {
  const partner = await requirePartner()
  return (
    <div className="flex flex-1 flex-col text-base">
      <header className="flex items-center justify-between gap-2 border-b p-4">
        <span className="font-semibold">{partner.name}</span>
        <form action={logout}>
          <button type="submit" className="h-11 px-3 font-semibold text-green-700">Đăng xuất</button>
        </form>
      </header>
      {children}
    </div>
  )
}
