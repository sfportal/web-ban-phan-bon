import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PartnerActions } from '@/components/admin/PartnerActions'
import { requireStaff } from '@/lib/auth/guards'
import { formatDate } from '@/lib/format'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'

export const metadata = { title: `Chi tiết đối tác — ${SITE_NAME}` }

const STATUS_LABEL = { pending: 'Chờ duyệt', active: 'Hoạt động', locked: 'Đã khóa' } as const
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function Detail({ params }: Pick<PageProps<'/admin/doi-tac/[id]'>, 'params'>) {
  const { role } = await requireStaff()
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const db = adminClient()
  const [{ data: partner }, { data: tiers }] = await Promise.all([
    db.from('partners').select('id, name, phone, region, delivery_address, status, tier_id, created_at, partner_tiers(name, kind)').eq('id', id).maybeSingle().throwOnError(),
    db.from('partner_tiers').select('id, name, kind').order('name').throwOnError(),
  ])
  if (!partner) notFound()
  const { count: farmerCount } = await db.from('farmers').select('id', { count: 'exact', head: true }).eq('owner_partner_id', id).throwOnError()
  const rows: [string, string][] = [
    ['Số điện thoại', partner.phone],
    ['Khu vực', partner.region ?? '—'],
    ['Địa chỉ nhận hàng', partner.delivery_address ?? '—'],
    ['Trạng thái', STATUS_LABEL[partner.status]],
    ['Bậc', partner.partner_tiers?.name ?? 'Chưa có bậc'],
    ['Đăng ký', formatDate(partner.created_at)],
    ['Nông dân đang quản lý', String(farmerCount ?? 0)],
  ]
  return (
    <>
      <h1 className="text-2xl font-bold">{partner.name}</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-gray-200 p-3">
        {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-gray-600">{k}</dt><dd>{v}</dd></div>)}
      </dl>
      {role === 'admin' && (
        <PartnerActions partnerId={partner.id} status={partner.status} tierId={partner.tier_id} tiers={tiers} />
      )}
      <Link href="/admin/doi-tac" className="flex h-11 items-center font-semibold text-green-800">← Danh sách đối tác</Link>
    </>
  )
}

export default function PartnerDetailPage(props: PageProps<'/admin/doi-tac/[id]'>) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <Detail params={props.params} />
      </Suspense>
    </main>
  )
}
