import Link from 'next/link'
import { Suspense } from 'react'
import { SITE_NAME } from '@/lib/site'
import { LoginForm } from './login-form'

export const metadata = { title: `Đăng nhập — ${SITE_NAME}` }

// ?locked=1 (requirePartner() đưa về khi tài khoản bị khóa) → hiện thông báo khóa.
async function LoginWithNotice({ searchParams }: Pick<PageProps<'/dang-nhap'>, 'searchParams'>) {
  const { locked } = await searchParams
  return <LoginForm initialError={locked === '1' ? 'locked' : undefined} />
}

export default function LoginPage({ searchParams }: PageProps<'/dang-nhap'>) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4 pt-10 text-base">
      <h1 className="text-2xl font-bold">Đăng nhập</h1>
      <Suspense fallback={<LoginForm />}>
        <LoginWithNotice searchParams={searchParams} />
      </Suspense>
      <p>
        Chưa có tài khoản?{' '}
        <Link href="/dang-ky" className="font-semibold text-green-700 underline">Đăng ký làm đối tác</Link>
      </p>
    </main>
  )
}
