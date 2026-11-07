import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { AdminMain, Loading, PageHeader } from '@/components/admin/AdminPage'
import { FarmerTransfer } from '@/components/admin/FarmerTransfer'
import { Money } from '@/components/Money'
import { Card } from '@/components/ui'
import { requireStaff } from '@/lib/auth/guards'
import { formatDateTime } from '@/lib/format'
import { STATUS_LABEL } from '@/lib/orders/status'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'

export const metadata = { title: `Chi tiết nông dân — ${SITE_NAME}` }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function Detail({ params }: Pick<PageProps<'/admin/nong-dan/[id]'>, 'params'>) {
  const { role } = await requireStaff()
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const db = adminClient()
  const [{ data: farmer }, { data: lines }, { data: log }] = await Promise.all([
    db.from('farmers').select('id, name, phone, address, owner_partner_id, partners(name)').eq('id', id).maybeSingle().throwOnError(),
    db.from('order_lines')
      .select('id, qty, line_total, products(name), orders(code, status, created_at)')
      .eq('farmer_id', id).limit(200).throwOnError(),
    db.from('farmer_transfer_log').select('id, changed_at, from_partner_id, to_partner_id').eq('farmer_id', id).order('id', { ascending: false }).throwOnError(),
  ])
  if (!farmer) notFound()

  const partnerIds = [...new Set(log.flatMap((l) => [l.from_partner_id, l.to_partner_id]).filter((x): x is string => !!x))]
  const [{ data: logPartners }, { data: eligible }] = await Promise.all([
    partnerIds.length
      ? db.from('partners').select('id, name').in('id', partnerIds).throwOnError()
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    role === 'admin'
      ? db.from('partners').select('id, name, phone, partner_tiers!inner(kind)').eq('status', 'active').eq('partner_tiers.kind', 'commission').order('name').throwOnError()
      : Promise.resolve({ data: [] as { id: string; name: string; phone: string }[] }),
  ])
  const pname = new Map(logPartners.map((p) => [p.id, p.name]))
  const label = (pid: string | null) => (pid ? pname.get(pid) ?? 'Đối tác đã xóa' : 'Chưa có chủ')
  const history = lines
    .filter((l) => l.orders)
    .sort((a, b) => b.orders!.created_at.localeCompare(a.orders!.created_at))

  return (
    <>
      <PageHeader back={{ href: '/admin/nong-dan', label: 'Danh sách nông dân' }} title={farmer.name} />
      <Card as="div" className="overflow-hidden">
        <dl className="divide-y divide-stone-100">
          {([['Số điện thoại', farmer.phone], ['Địa chỉ', farmer.address ?? '—'], ['CTV phụ trách', farmer.partners?.name ?? 'Chưa có chủ']] as const).map(([k, v]) => (
            <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
              <dt className="text-stone-600">{k}</dt><dd className="break-words font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {role === 'admin' && (
        <Card as="section" className="flex flex-col gap-3 p-5">
          <h2 className="text-xl font-bold tracking-tight">Chuyển chủ</h2>
          <FarmerTransfer
            farmerId={farmer.id}
            ownerId={farmer.owner_partner_id}
            partners={eligible.map((p) => ({ id: p.id, label: `${p.name} · ${p.phone}` }))}
          />
        </Card>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold tracking-tight">Lịch sử mua</h2>
        {history.length === 0 ? <p className="text-stone-600">Chưa mua hàng.</p> : (
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {history.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 px-4 py-3 even:bg-stone-50/70">
                <span><b>{l.products?.name ?? 'Sản phẩm'}</b> × {l.qty}</span>
                <span className="text-sm text-stone-600">
                  {l.orders!.code} · {STATUS_LABEL[l.orders!.status]} · {formatDateTime(l.orders!.created_at)}
                </span>
                <Money value={Number(l.line_total)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold tracking-tight">Lịch sử chuyển chủ</h2>
        {log.length === 0 ? <p className="text-stone-600">Chưa từng chuyển chủ.</p> : (
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {log.map((l) => (
              <li key={l.id} className="px-4 py-3 even:bg-stone-50/70">
                {label(l.from_partner_id)} → {label(l.to_partner_id)}
                <span className="block text-sm text-stone-600">{formatDateTime(l.changed_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

export default function FarmerDetailPage(props: PageProps<'/admin/nong-dan/[id]'>) {
  return (
    <AdminMain width="narrow">
      <Suspense fallback={<Loading />}>
        <Detail params={props.params} />
      </Suspense>
    </AdminMain>
  )
}
