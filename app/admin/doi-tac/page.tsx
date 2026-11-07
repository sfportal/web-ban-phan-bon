import Link from 'next/link'
import { Suspense } from 'react'
import { requireStaff } from '@/lib/auth/guards'
import { formatDate } from '@/lib/format'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetch-all'

export const metadata = { title: `Đối tác — ${SITE_NAME}` }

const STATUS_LABEL = { pending: 'Chờ duyệt', active: 'Hoạt động', locked: 'Đã khóa' } as const

async function Partners({ searchParams }: Pick<PageProps<'/admin/doi-tac'>, 'searchParams'>) {
  await requireStaff()
  const tab = (await searchParams).tab === 'cho-duyet' ? 'cho-duyet' : 'tat-ca'
  const db = adminClient()
  const partners = await fetchAll((from, to) =>
    db.from('partners').select('id, name, phone, region, status, created_at, partner_tiers(name)')
      .order('created_at', { ascending: false }).order('id').range(from, to).throwOnError())
  const pendingCount = partners.filter((p) => p.status === 'pending').length
  const shown = tab === 'cho-duyet' ? partners.filter((p) => p.status === 'pending') : partners
  const tabClass = (on: boolean) =>
    `flex h-11 items-center rounded-lg px-4 font-semibold ${on ? 'bg-green-700 text-white' : 'border border-gray-300'}`
  return (
    <>
      <div className="flex gap-2">
        <Link href="/admin/doi-tac" className={tabClass(tab === 'tat-ca')}>Tất cả ({partners.length})</Link>
        <Link href="/admin/doi-tac?tab=cho-duyet" className={tabClass(tab === 'cho-duyet')}>Chờ duyệt ({pendingCount})</Link>
      </div>
      {shown.length === 0 ? (
        <p className="py-8 text-center text-gray-600">{tab === 'cho-duyet' ? 'Không có đối tác nào chờ duyệt.' : 'Chưa có đối tác nào.'}</p>
      ) : (
        <ul className="divide-y rounded-xl border border-gray-200">
          {shown.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/doi-tac/${p.id}`} className="flex flex-col gap-1 p-3">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <b>{p.name}</b><span className="text-sm font-semibold text-gray-700">{STATUS_LABEL[p.status]}</span>
                </span>
                <span className="text-gray-700">{p.phone}{p.region && ` · ${p.region}`}</span>
                <span className="text-sm text-gray-600">{p.partner_tiers?.name ?? 'Chưa có bậc'} · đăng ký {formatDate(p.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export default function PartnersPage(props: PageProps<'/admin/doi-tac'>) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Đối tác</h1>
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <Partners searchParams={props.searchParams} />
      </Suspense>
    </main>
  )
}
