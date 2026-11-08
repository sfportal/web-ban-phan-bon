import { Printer } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense, type ReactNode } from 'react'
import { AdminMain, Loading, PageHeader } from '@/components/admin/AdminPage'
import { OrderStatusActions } from '@/components/admin/OrderStatusActions'
import { StaffOrderEdit, type StaffEditLine } from '@/components/admin/StaffOrderEdit'
import { Money } from '@/components/Money'
import { StatusBadge } from '@/components/StatusBadge'
import { Button, Card } from '@/components/ui'
import { requireStaff } from '@/lib/auth/guards'
import { getActivePromos, getProductsByIds } from '@/lib/catalog/queries'
import { formatDateTime } from '@/lib/format'
import { groupByFarmer } from '@/lib/orders/group-lines'
import { STATUS_LABEL } from '@/lib/orders/status'
import { salePrice } from '@/lib/pricing'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'

export const metadata = { title: `Chi tiết đơn — ${SITE_NAME}` }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function OrderDetail({ params }: Pick<PageProps<'/admin/don-hang/[id]'>, 'params'>) {
  await requireStaff()
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const db = adminClient()
  const { data: order } = await db
    .from('orders').select('*, partners(id, name, phone, partner_tiers(name, kind))').eq('id', id).maybeSingle().throwOnError()
  if (!order) notFound()

  const [{ data: lines }, { data: log }, { data: entries }] = await Promise.all([
    db.from('order_lines').select('*, farmers(name, phone)').eq('order_id', order.id).order('id').throwOnError(),
    db.from('order_status_log').select('id, to_status, changed_at, note').eq('order_id', order.id).order('changed_at').order('id').throwOnError(),
    db.from('commission_entries').select('id, kind, amount, period').eq('order_id', order.id).order('created_at').throwOnError(),
  ])
  const productIds = [...new Set(lines.map((l) => l.product_id))]
  const [products, promos] = await Promise.all([getProductsByIds(db, productIds), getActivePromos(db)])
  const product = new Map(products.map((p) => [p.id, p]))
  const groups = groupByFarmer(lines)

  const editable = order.status === 'new' || order.status === 'confirmed'
  const now = new Date()
  const editLines: StaffEditLine[] = editable
    ? lines.map((l) => {
        const p = product.get(l.product_id)
        return {
          key: l.id, productId: l.product_id, farmerId: l.farmer_id, farmerName: l.farmers?.name ?? null,
          name: p?.name ?? 'Sản phẩm', unit: p?.unit ?? '', qty: l.qty,
          price: p ? salePrice(p, promos, now).price : 0, available: !!p && p.isActive && p.inStock,
        }
      })
    : []
  const partner = order.partners

  const linkCls = 'font-semibold text-primary underline-offset-4 hover:underline'
  const info: [string, ReactNode][] = order.source === 'retail'
    ? [
        ['Khách lẻ', <><b>{order.retail_name}</b> · {order.retail_phone}</>],
        ['Địa chỉ', order.retail_address],
        ['Thanh toán', order.payment_method === 'transfer' ? 'Chuyển khoản' : 'COD'],
        ...(partner ? [['Khách của CTV', <Link key="p" href={`/admin/doi-tac/${partner.id}`} className={linkCls}>{partner.name}</Link>] as [string, ReactNode]] : []),
      ]
    : [
        ...(partner
          ? [['Đối tác', <><Link href={`/admin/doi-tac/${partner.id}`} className={linkCls}>{partner.name}</Link> · {partner.phone}</>] as [string, ReactNode]]
          : []),
        ...(partner?.partner_tiers ? [['Bậc', partner.partner_tiers.name] as [string, ReactNode]] : []),
        ...(order.delivery_address ? [['Giao tới', order.delivery_address] as [string, ReactNode]] : []),
      ]
  if (order.note) info.push(['Ghi chú', order.note])

  return (
    <>
      <PageHeader
        back={{ href: '/admin/don-hang', label: 'Đơn hàng' }}
        title={<span className="flex flex-wrap items-center gap-3">{order.code}<StatusBadge status={order.status} /></span>}
        subtitle={`Đặt lúc ${formatDateTime(order.created_at)}`}
        actions={
          <Button href={`/admin/don-hang/${order.id}/in`} variant="secondary">
            <Printer aria-hidden className="size-5" />In phiếu giao hàng
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <Card as="section" className="overflow-hidden">
            <h2 className="border-b border-stone-100 px-4 py-3 text-lg font-bold">Hàng trong đơn</h2>
            {groups.map((g) => (
              <div key={g.key} className="border-b border-stone-100 last:border-0">
                {g.title && <h3 className="bg-stone-50 px-4 py-2 font-semibold text-stone-700">{g.title}</h3>}
                <ul className="flex flex-col divide-y divide-stone-100">
                  {g.lines.map((l) => {
                    const p = product.get(l.product_id)
                    return (
                      <li key={l.id} className="flex flex-col gap-0.5 px-4 py-3">
                        <span className="font-semibold">{p?.name ?? 'Sản phẩm'}{p?.unit && <span className="font-normal text-stone-600"> · {p.unit}</span>}</span>
                        <span className="flex justify-between gap-2 text-stone-700">
                          <span className="tabular-nums">{l.qty} × <Money value={Number(l.sale_price_snap)} /></span>
                          <Money value={Number(l.line_total)} className="font-semibold tabular-nums text-ink" />
                        </span>
                        {Number(l.line_commission) > 0 && (
                          <span className="text-sm text-primary">Hoa hồng {Number(l.rate_pct_snap)}% · <Money value={Number(l.line_commission)} /></span>
                        )}
                        {l.line_partner_price !== null && (
                          <span className="text-sm text-primary">Giá đại lý <Money value={Number(l.line_partner_price)} /> ({Number(l.rate_pct_snap)}%)</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
            <dl className="flex flex-col gap-1.5 border-t border-stone-200 bg-stone-50 px-4 py-4">
              <div className="flex justify-between"><dt>Số lượng</dt><dd className="tabular-nums">{order.total_qty}</dd></div>
              <div className="flex justify-between">
                <dt>{order.partner_payable !== null ? 'Tổng theo giá bán lẻ' : 'Tổng tiền'}</dt>
                <dd><Money value={Number(order.subtotal)} className="font-semibold tabular-nums" /></dd>
              </div>
              {order.partner_payable !== null && (
                <div className="flex justify-between text-lg"><dt>Đại lý phải trả</dt><dd><Money value={Number(order.partner_payable)} className="font-bold tabular-nums" /></dd></div>
              )}
              {Number(order.commission_expected) > 0 && (
                <div className="flex justify-between text-primary"><dt>Hoa hồng dự kiến</dt><dd><Money value={Number(order.commission_expected)} className="font-semibold tabular-nums" /></dd></div>
              )}
            </dl>
          </Card>

          {editable && <StaffOrderEdit orderId={order.id} lines={editLines} />}
        </div>

        <div className="flex flex-col gap-4">
          <Card as="section" className="flex flex-col gap-3 p-4">
            <h2 className="text-lg font-bold">Người nhận</h2>
            <dl className="flex flex-col gap-2">
              {info.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm text-stone-600">{k}</dt>
                  <dd className="break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <OrderStatusActions orderId={order.id} status={order.status} />

          {entries.length > 0 && (
            <Card as="section" className="flex flex-col gap-2 p-4">
              <h2 className="text-lg font-bold">Hoa hồng đã ghi nhận</h2>
              <ul className="flex flex-col divide-y divide-stone-100">
                {entries.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{e.kind === 'earn' ? 'Ghi nhận' : 'Hoàn (trả hàng)'}, kỳ {e.period}</span>
                    <Money value={Number(e.amount)} className="font-semibold tabular-nums" />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card as="section" className="flex flex-col gap-3 p-4">
            <h2 className="text-lg font-bold">Lịch sử trạng thái</h2>
            <ol className="flex flex-col">
              {log.map((e, i) => (
                <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < log.length - 1 && <span aria-hidden className="absolute left-[5px] top-4 h-full w-0.5 bg-stone-200" />}
                  <span aria-hidden className={`relative mt-1.5 size-3 shrink-0 rounded-full ${i === log.length - 1 ? 'bg-primary ring-4 ring-primary-soft' : 'bg-stone-300'}`} />
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold">{STATUS_LABEL[e.to_status]}</span>
                    <span className="text-sm text-stone-600">{formatDateTime(e.changed_at)}</span>
                    {e.note && <span className="text-sm text-stone-700">{e.note}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  )
}

export default function AdminOrderPage({ params }: PageProps<'/admin/don-hang/[id]'>) {
  return (
    <AdminMain>
      <Suspense fallback={<Loading />}>
        <OrderDetail params={params} />
      </Suspense>
    </AdminMain>
  )
}
