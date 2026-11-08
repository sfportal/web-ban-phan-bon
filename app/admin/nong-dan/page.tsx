import { ChevronRight, Search, Sprout } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { AdminMain, Loading, PageHeader } from '@/components/admin/AdminPage'
import { Badge, Button, Card, EmptyState, Input } from '@/components/ui'
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
  let query = adminClient().from('farmers').select('id, name, phone, address, is_demo, partners(name)')
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
  const { data: farmers } = await query.order('created_at', { ascending: false }).order('id').limit(LIMIT + 1).throwOnError()
  return (
    <>
      <form action="/admin/nong-dan" role="search" className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
          <Input name="q" defaultValue={q} placeholder="Tên hoặc số điện thoại" aria-label="Tìm nông dân" className="pl-10" />
        </div>
        <Button type="submit">Tìm</Button>
      </form>
      {farmers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Sprout className="size-7" />}
            title={q ? `Không tìm thấy “${q}”` : 'Chưa có nông dân nào'}
            description={q ? 'Thử tìm bằng số điện thoại hoặc một phần tên.' : 'Nông dân do CTV thêm khi lên đơn sẽ hiện ở đây.'}
          />
        </Card>
      ) : (
        <>
          <Card as="div" className="overflow-hidden">
            <ul className="divide-y divide-stone-100">
              {farmers.slice(0, LIMIT).map((f) => (
                <li key={f.id} className="even:bg-stone-50/70">
                  <Link href={`/admin/nong-dan/${f.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-primary-soft/50">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <b className="font-semibold">{f.name}</b>
                        {f.is_demo && <Badge tone="gray">Thử</Badge>}
                      </span>
                      <span className="text-stone-700">{f.phone}{f.address && ` · ${f.address}`}</span>
                      <span className="text-sm text-stone-600">CTV: {f.partners?.name ?? 'Chưa có chủ'}</span>
                    </span>
                    <ChevronRight aria-hidden className="size-5 shrink-0 text-stone-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          {farmers.length > LIMIT && <p className="text-stone-600">Chỉ hiện {LIMIT} kết quả đầu, hãy tìm theo tên hoặc số điện thoại để thu hẹp.</p>}
        </>
      )}
    </>
  )
}

export default function FarmersPage(props: PageProps<'/admin/nong-dan'>) {
  return (
    <AdminMain width="narrow">
      <PageHeader title="Nông dân" subtitle="Khách của CTV. Mỗi nông dân thuộc một CTV phụ trách." />
      <Suspense fallback={<Loading />}>
        <Farmers searchParams={props.searchParams} />
      </Suspense>
    </AdminMain>
  )
}
