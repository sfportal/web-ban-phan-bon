import { ChevronRight, Users } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { AdminMain, Loading, PageHeader } from '@/components/admin/AdminPage'
import { Badge, Card, EmptyState, type BadgeTone } from '@/components/ui'
import { requireStaff } from '@/lib/auth/guards'
import { formatDate } from '@/lib/format'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetch-all'

export const metadata = { title: `Đối tác — ${SITE_NAME}` }

const STATUS_LABEL = { pending: 'Chờ duyệt', active: 'Hoạt động', locked: 'Đã khóa' } as const
const STATUS_TONE: Record<keyof typeof STATUS_LABEL, BadgeTone> = { pending: 'yellow', active: 'green', locked: 'gray' }

/** Chữ cái đầu của từ cuối có chữ (tên gọi), vd. “Nguyễn Văn Bình” → “B”. */
const initial = (name: string) => (name.split(/\s+/).filter((w) => /\p{L}/u.test(w)).pop() ?? name).charAt(0).toUpperCase()

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
    `flex h-11 items-center gap-2 rounded-full px-4 font-semibold transition-colors ${
      on ? 'bg-primary text-white' : 'border border-stone-300 bg-white text-stone-700 hover:border-primary/40 hover:text-primary'
    }`
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/doi-tac" aria-current={tab === 'tat-ca' ? 'page' : undefined} className={tabClass(tab === 'tat-ca')}>Tất cả ({partners.length})</Link>
        <Link href="/admin/doi-tac?tab=cho-duyet" aria-current={tab === 'cho-duyet' ? 'page' : undefined} className={tabClass(tab === 'cho-duyet')}>
          Chờ duyệt ({pendingCount})
        </Link>
      </div>
      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="size-7" />}
            title={tab === 'cho-duyet' ? 'Không có đối tác nào chờ duyệt' : 'Chưa có đối tác nào'}
            description="Người đăng ký làm CTV hoặc đại lý sẽ hiện ở đây để duyệt."
          />
        </Card>
      ) : (
        <Card as="div" className="overflow-hidden">
          <ul className="divide-y divide-stone-100">
            {shown.map((p) => (
              <li key={p.id} className="even:bg-stone-50/70">
                <Link href={`/admin/doi-tac/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-primary-soft/50">
                  <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">
                    {initial(p.name)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <b className="font-semibold">{p.name}</b>
                      <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                    </span>
                    <span className="text-stone-700">{p.phone}{p.region && ` · ${p.region}`}</span>
                    <span className="text-sm text-stone-600">{p.partner_tiers?.name ?? 'Chưa có bậc'} · đăng ký {formatDate(p.created_at)}</span>
                  </span>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-stone-400" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

export default function PartnersPage(props: PageProps<'/admin/doi-tac'>) {
  return (
    <AdminMain width="narrow">
      <PageHeader title="Đối tác" subtitle="Cộng tác viên và đại lý. Bấm vào một người để duyệt, đổi bậc hoặc khóa tài khoản." />
      <Suspense fallback={<Loading />}>
        <Partners searchParams={props.searchParams} />
      </Suspense>
    </AdminMain>
  )
}
