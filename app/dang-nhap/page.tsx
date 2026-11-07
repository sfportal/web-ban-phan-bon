import Link from 'next/link'
import { Suspense } from 'react'
import { AuthShell } from '@/components/auth/AuthShell'
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
    <AuthShell title="Đăng nhập" subtitle="Dành cho cộng tác viên, đại lý và nhân viên cửa hàng.">
      <Suspense fallback={<LoginForm />}>
        <LoginWithNotice searchParams={searchParams} />
      </Suspense>
      <p className="text-stone-700">
        Chưa có tài khoản?{' '}
        <Link href="/dang-ky" className="font-semibold text-primary underline underline-offset-4">Đăng ký làm đối tác</Link>
      </p>
    </AuthShell>
  )
}
