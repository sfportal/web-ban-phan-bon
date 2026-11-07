import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { OrderStatusActions } from '@/components/admin/OrderStatusActions'
import { StaffOrderEdit, type StaffEditLine } from '@/components/admin/StaffOrderEdit'
import { Money } from '@/components/Money'
import { StatusBadge } from '@/components/StatusBadge'
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
    db.from('commission_entries').select('id, kind, amount, period, status').eq('order_id', order.id).order('created_at').throwOnError(),
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

  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">{order.code}</h1>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-gray-600">Đặt lúc {formatDateTime(order.created_at)}</p>
        {order.source === 'retail' ? (
          <>
            <p>Đơn lẻ: <b>{order.retail_name}</b> · {order.retail_phone}</p>
            <p>Địa chỉ: {order.retail_address}</p>
            <p>Thanh toán: {order.payment_method === 'transfer' ? 'Chuyển khoản' : 'COD'}</p>
            {partner && <p className="text-gray-700">Khách của CTV <Link href={`/admin/doi-tac/${partner.id}`} className="font-semibold text-green-800 underline">{partner.name}</Link></p>}
          </>
        ) : (
          <>
            {partner && (
              <p>
                <Link href={`/admin/doi-tac/${partner.id}`} className="font-semibold text-green-800 underline">{partner.name}</Link>
                {' '}· {partner.phone}{partner.partner_tiers && ` · ${partner.partner_tiers.name}`}
              </p>
            )}
            {order.delivery_address && <p>Giao tới: {order.delivery_address}</p>}
          </>
        )}
        {order.note && <p className="text-gray-700">Ghi chú: {order.note}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/admin/don-hang/${order.id}/in`} className="flex h-11 items-center rounded-lg border border-gray-300 px-4 font-semibold">
          In phiếu giao hàng
        </Link>
      </div>

      <OrderStatusActions orderId={order.id} status={order.status} />

      <section className="flex flex-col gap-3">
        {groups.map((g) => (
          <div key={g.key} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
            {g.title && <h2 className="font-bold">{g.title}</h2>}
            <ul className="flex flex-col divide-y">
              {g.lines.map((l) => {
                const p = product.get(l.product_id)
                return (
                  <li key={l.id} className="flex flex-col gap-0.5 py-2">
                    <span className="font-semibold">{p?.name ?? 'Sản phẩm'}{p?.unit && <span className="font-normal text-gray-600"> · {p.unit}</span>}</span>
                    <span className="flex justify-between gap-2 text-gray-700">
                      <span>{l.qty} × <Money value={Number(l.sale_price_snap)} /></span>
                      <Money value={Number(l.line_total)} className="font-semibold text-gray-900" />
                    </span>
                    {Number(l.line_commission) > 0 && (
                      <span className="text-sm text-green-800">Hoa hồng {Number(l.rate_pct_snap)}% · <Money value={Number(l.line_commission)} /></span>
                    )}
                    {l.line_partner_price !== null && (
                      <span className="text-sm text-green-800">Giá đại lý <Money value={Number(l.line_partner_price)} /> ({Number(l.rate_pct_snap)}%)</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </section>

      <dl className="flex flex-col gap-1 rounded-xl bg-gray-50 p-4">
        <div className="flex justify-between"><dt>Số lượng</dt><dd>{order.total_qty}</dd></div>
        <div className="flex justify-between">
          <dt>{order.partner_payable !== null ? 'Tổng theo giá bán lẻ' : 'Tổng tiền'}</dt>
          <dd><Money value={Number(order.subtotal)} className="font-semibold" /></dd>
        </div>
        {order.partner_payable !== null && (
          <div className="flex justify-between text-lg"><dt>Đại lý phải trả</dt><dd><Money value={Number(order.partner_payable)} className="font-bold" /></dd></div>
        )}
        {Number(order.commission_expected) > 0 && (
          <div className="flex justify-between text-green-800"><dt>Hoa hồng dự kiến</dt><dd><Money value={Number(order.commission_expected)} className="font-semibold" /></dd></div>
        )}
      </dl>

      {editable && <StaffOrderEdit orderId={order.id} lines={editLines} />}

      {entries.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">Hoa hồng đã ghi nhận</h2>
          <ul className="flex flex-col gap-1">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2">
                <span>{e.kind === 'earn' ? 'Ghi nhận' : 'Hoàn (trả hàng)'} · kỳ {e.period} · {e.status === 'paid' ? 'Đã chi' : 'Chờ chi'}</span>
                <Money value={Number(e.amount)} className="font-semibold" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Lịch sử trạng thái</h2>
        <ol className="flex flex-col gap-1">
          {log.map((e) => (
            <li key={e.id} className="flex flex-col">
              <span className="flex justify-between gap-2">
                <span>{STATUS_LABEL[e.to_status]}</span>
                <span className="text-gray-600">{formatDateTime(e.changed_at)}</span>
              </span>
              {e.note && <span className="text-sm text-gray-700">{e.note}</span>}
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}

export default function AdminOrderPage({ params }: PageProps<'/admin/don-hang/[id]'>) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 text-base">
      <Link href="/admin/don-hang" className="flex h-11 items-center font-semibold text-green-800">← Đơn hàng</Link>
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <OrderDetail params={params} />
      </Suspense>
    </main>
  )
}
