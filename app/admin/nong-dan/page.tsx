import Link from 'next/link'
import { Suspense } from 'react'
import { requireStaff } from '@/lib/auth/guards'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'

export const metadata = { title: `Nông dân — ${SITE_NAME}` }

const LIMIT = 100

async function Farmers({ searchParams }: Pick<PageProps<'/admin/nong-dan'>, 'searchParams'>) {
  await requireStaff()
  const raw = (await searchParams).q
  // Bỏ ký tự đặc biệt của cú pháp bộ lọc PostgREST (, ( ) % * \) khỏi từ khóa.
  const q = (typeof raw === 'string' ? raw : '').replace(/[,()%*\\]/g, ' ').trim().slice(0, 60)
  let query = adminClient().from('farmers').select('id, name, phone, address, partners(name)')
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
  const { data: farmers } = await query.order('created_at', { ascending: false }).order('id').limit(LIMIT + 1).throwOnError()
  return (
    <>
      <form action="/admin/nong-dan" role="search" className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Tên hoặc số điện thoại" aria-label="Tìm nông dân" className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-base" />
        <button type="submit" className="h-11 rounded-lg bg-green-700 px-4 font-semibold text-white">Tìm</button>
      </form>
      {farmers.length === 0 ? (
        <p className="py-8 text-center text-gray-600">Không có nông dân nào.</p>
      ) : (
        <>
          <ul className="divide-y rounded-xl border border-gray-200">
            {farmers.slice(0, LIMIT).map((f) => (
              <li key={f.id}>
                <Link href={`/admin/nong-dan/${f.id}`} className="flex flex-col gap-1 p-3">
                  <b>{f.name}</b>
                  <span className="text-gray-700">{f.phone}{f.address && ` · ${f.address}`}</span>
                  <span className="text-sm text-gray-600">CTV: {f.partners?.name ?? 'Chưa có chủ'}</span>
                </Link>
              </li>
            ))}
          </ul>
          {farmers.length > LIMIT && <p className="text-sm text-gray-600">Chỉ hiện {LIMIT} kết quả đầu, hãy tìm theo tên hoặc số điện thoại để thu hẹp.</p>}
        </>
      )}
    </>
  )
}

export default function FarmersPage(props: PageProps<'/admin/nong-dan'>) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Nông dân</h1>
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <Farmers searchParams={props.searchParams} />
      </Suspense>
    </main>
  )
}
