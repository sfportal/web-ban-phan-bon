import { Clock3 } from 'lucide-react'
import Link from 'next/link'
import { AuthShell } from '@/components/auth/AuthShell'
import { submitButtonClass } from '@/components/AuthField'
import { SITE_NAME } from '@/lib/site'

export const metadata = { title: `Chờ duyệt — ${SITE_NAME}` }

export default function PendingPage() {
  return (
    <AuthShell title="Tài khoản đang chờ duyệt">
      <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4">
        <Clock3 aria-hidden className="mt-0.5 size-6 shrink-0 text-accent" />
        <p className="leading-relaxed text-ink">
          Cảm ơn bạn đã đăng ký. {SITE_NAME} sẽ liên hệ và duyệt tài khoản trong thời gian sớm nhất.
          Sau khi được duyệt, bạn đăng nhập lại để đặt hàng.
        </p>
      </div>
      <form method="post" action="/dang-xuat">
        <button type="submit" className={`${submitButtonClass} w-full`}>Đăng xuất</button>
      </form>
      <Link href="/" className="self-center font-semibold text-primary underline underline-offset-4">
        Về trang chủ
      </Link>
    </AuthShell>
  )
}
