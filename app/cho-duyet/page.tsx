import { logout } from '@/lib/auth/actions'
import { submitButtonClass } from '@/components/AuthField'
import { SITE_NAME } from '@/lib/site'

export const metadata = { title: `Chờ duyệt — ${SITE_NAME}` }

export default function PendingPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4 pt-10 text-base">
      <h1 className="text-2xl font-bold">Tài khoản đang chờ duyệt</h1>
      <p>
        Cảm ơn bạn đã đăng ký. {SITE_NAME} sẽ liên hệ và duyệt tài khoản trong thời gian sớm nhất.
        Sau khi được duyệt, bạn đăng nhập lại để đặt hàng.
      </p>
      <form action={logout}>
        <button type="submit" className={`${submitButtonClass} w-full`}>Đăng xuất</button>
      </form>
    </main>
  )
}
