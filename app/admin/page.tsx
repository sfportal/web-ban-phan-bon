import Link from 'next/link'
import { Suspense } from 'react'
import { requireStaff } from '@/lib/auth/guards'

// Khung trang quản trị; số liệu tổng quan làm ở Task 13.
async function Links() {
  await requireStaff()
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      <li><Link href="/admin/san-pham" className="flex h-14 items-center rounded-xl border border-gray-200 px-4 font-semibold">Sản phẩm</Link></li>
      <li><Link href="/admin/nhom" className="flex h-14 items-center rounded-xl border border-gray-200 px-4 font-semibold">Nhóm sản phẩm</Link></li>
    </ul>
  )
}

export default function AdminHome() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Quản trị</h1>
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <Links />
      </Suspense>
    </main>
  )
}
