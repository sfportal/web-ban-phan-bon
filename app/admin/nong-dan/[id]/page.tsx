import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { FarmerTransfer } from '@/components/admin/FarmerTransfer'
import { Money } from '@/components/Money'
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
      <h1 className="text-2xl font-bold">{farmer.name}</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-gray-200 p-3">
        <dt className="text-gray-600">Số điện thoại</dt><dd>{farmer.phone}</dd>
        <dt className="text-gray-600">Địa chỉ</dt><dd>{farmer.address ?? '—'}</dd>
        <dt className="text-gray-600">CTV phụ trách</dt><dd>{farmer.partners?.name ?? 'Chưa có chủ'}</dd>
      </dl>

      {role === 'admin' && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-bold">Chuyển chủ</h2>
          <FarmerTransfer
            farmerId={farmer.id}
            ownerId={farmer.owner_partner_id}
            partners={eligible.map((p) => ({ id: p.id, label: `${p.name} · ${p.phone}` }))}
          />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">Lịch sử mua</h2>
        {history.length === 0 ? <p className="text-gray-600">Chưa mua hàng.</p> : (
          <ul className="divide-y rounded-xl border border-gray-200">
            {history.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 p-3">
                <span><b>{l.products?.name ?? 'Sản phẩm'}</b> × {l.qty}</span>
                <span className="text-sm text-gray-600">
                  {l.orders!.code} · {STATUS_LABEL[l.orders!.status]} · {formatDateTime(l.orders!.created_at)}
                </span>
                <Money value={Number(l.line_total)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">Lịch sử chuyển chủ</h2>
        {log.length === 0 ? <p className="text-gray-600">Chưa từng chuyển chủ.</p> : (
          <ul className="divide-y rounded-xl border border-gray-200">
            {log.map((l) => (
              <li key={l.id} className="p-3">
                {label(l.from_partner_id)} → {label(l.to_partner_id)}
                <span className="block text-sm text-gray-600">{formatDateTime(l.changed_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Link href="/admin/nong-dan" className="flex h-11 items-center font-semibold text-green-800">← Danh sách nông dân</Link>
    </>
  )
}

export default function FarmerDetailPage(props: PageProps<'/admin/nong-dan/[id]'>) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <Detail params={props.params} />
      </Suspense>
    </main>
  )
}
