import { AdminNav } from '@/components/admin/AdminNav'
import { logout } from '@/lib/auth/actions'
import { requireStaff } from '@/lib/auth/guards'
import { SITE_NAME } from '@/lib/site'

// Guard đọc phiên (cookie) ở đầu layout nên segment chặn trên server: chưa đủ quyền thì
// redirect HTTP trước khi gửi bất kỳ nội dung nhân viên nào.
export const instant = false

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const staff = await requireStaff()
  return (
    <div className="flex flex-1 flex-col text-base">
      <header className="flex items-center justify-between gap-2 border-b p-4">
        <span className="font-semibold">
          {SITE_NAME} · {staff.role === 'admin' ? 'Quản trị' : 'Nhân viên'}
        </span>
        <form action={logout}>
          <button type="submit" className="h-11 px-3 font-semibold text-green-700">Đăng xuất</button>
        </form>
      </header>
      <AdminNav />
      {children}
    </div>
  )
}
