import Link from 'next/link'
import { SITE_NAME } from '@/lib/site'
import { RegisterForm } from './register-form'

export const metadata = { title: `Đăng ký đối tác — ${SITE_NAME}` }

export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4 pt-10 text-base">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Đăng ký làm đối tác</h1>
        <p className="text-gray-700">Sau khi đăng ký, cửa hàng sẽ duyệt tài khoản trước khi bạn đặt hàng.</p>
      </div>
      <RegisterForm />
      <p>
        Đã có tài khoản?{' '}
        <Link href="/dang-nhap" className="font-semibold text-green-700 underline">Đăng nhập</Link>
      </p>
    </main>
  )
}
