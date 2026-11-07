import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { AdminMain, Loading, PageHeader } from '@/components/admin/AdminPage'
import { PartnerActions } from '@/components/admin/PartnerActions'
import { Card } from '@/components/ui'
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
      <PageHeader
        back={{ href: '/admin/doi-tac', label: 'Danh sách đối tác' }}
        title={partner.name}
        subtitle={partner.partner_tiers ? (partner.partner_tiers.kind === 'commission' ? 'Cộng tác viên' : 'Đại lý') : 'Chưa xếp bậc'}
      />
      <Card as="div" className="overflow-hidden">
        <dl className="divide-y divide-stone-100">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
              <dt className="text-stone-600">{k}</dt><dd className="break-words font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      {role === 'admin' && (
        <PartnerActions partnerId={partner.id} status={partner.status} tierId={partner.tier_id} tiers={tiers} />
      )}
    </>
  )
}

export default function PartnerDetailPage(props: PageProps<'/admin/doi-tac/[id]'>) {
  return (
    <AdminMain width="narrow">
      <Suspense fallback={<Loading />}>
        <Detail params={props.params} />
      </Suspense>
    </AdminMain>
  )
}
