import Link from 'next/link'
import { AuthShell } from '@/components/auth/AuthShell'
import { SITE_NAME } from '@/lib/site'
import { RegisterForm } from './register-form'

export const metadata = { title: `Đăng ký đối tác — ${SITE_NAME}` }

export default function RegisterPage() {
  return (
    <AuthShell
      title="Đăng ký làm đối tác"
      subtitle="Sau khi đăng ký, cửa hàng sẽ duyệt tài khoản trước khi bạn đặt hàng."
    >
      <RegisterForm />
      <p className="text-stone-700">
        Đã có tài khoản?{' '}
        <Link href="/dang-nhap" className="font-semibold text-primary underline underline-offset-4">Đăng nhập</Link>
      </p>
    </AuthShell>
  )
}
