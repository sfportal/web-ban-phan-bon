import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Money } from '@/components/Money'
import { StatusBadge } from '@/components/StatusBadge'
import { requirePartner } from '@/lib/auth/guards'
import { getActivePromos, getProductsByIds } from '@/lib/catalog/queries'
import { formatDateTime } from '@/lib/format'
import { salePrice } from '@/lib/pricing'
import { STATUS_LABEL } from '@/lib/orders/status'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { OrderActions, type EditLine } from './OrderActions'

export const metadata = { title: `Chi tiết đơn — ${SITE_NAME}` }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function OrderDetail({ params }: Pick<PageProps<'/doi-tac/don-hang/[id]'>, 'params'>) {
  const session = await requirePartner()
  const { id } = await params
  if (!UUID.test(id)) notFound()

  // Quyền: RLS + lọc partner_id. Sau bước này mới đọc bằng service role (tên sản phẩm đã ẩn,
  // nông dân đã chuyển CTV, lịch sử trạng thái) — chỉ trong phạm vi đơn này.
  const { data: order } = await createServerClient()
    .from('orders').select('*').eq('id', id).eq('partner_id', session.partnerId).maybeSingle().throwOnError()
  if (!order) notFound()

  const db = adminClient()
  const [{ data: lines }, { data: log }] = await Promise.all([
    db.from('order_lines').select('*, farmers(name, phone)').eq('order_id', order.id).order('id').throwOnError(),
    db.from('order_status_log').select('id, from_status, to_status, changed_at')
      .eq('order_id', order.id).order('changed_at').order('id').throwOnError(),
  ])
  const productIds = [...new Set(lines.map((l) => l.product_id))]
  const [products, promos] = await Promise.all([getProductsByIds(db, productIds), getActivePromos(db)])
  const product = new Map(products.map((p) => [p.id, p]))

  // Nhóm theo nông dân (giữ thứ tự xuất hiện).
  const groups: { key: string; title: string | null; lines: typeof lines }[] = []
  for (const l of lines) {
    const key = l.farmer_id ?? ''
    let g = groups.find((x) => x.key === key)
    if (!g) {
      const title = l.farmers ? `${l.farmers.name} · ${l.farmers.phone}` : null
      groups.push((g = { key, title, lines: [] }))
    }
    g.lines.push(l)
  }

  const isCtv = session.kind === 'commission'
  const editable = order.source === 'partner' && order.status === 'new'
  const now = new Date()
  const editLines: EditLine[] = editable
    ? lines.map((l) => {
        const p = product.get(l.product_id)
        return {
          key: l.id,
          productId: l.product_id,
          farmerId: l.farmer_id,
          farmerName: l.farmers?.name ?? null,
          name: p?.name ?? 'Sản phẩm',
          unit: p?.unit ?? '',
          qty: l.qty,
          price: p ? salePrice(p, promos, now).price : 0,
          available: !!p && p.isActive && p.inStock,
        }
      })
    : []

  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">{order.code}</h1>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-gray-600">Đặt lúc {formatDateTime(order.created_at)}</p>
        {order.source === 'retail' ? (
          <p>Khách tự đặt: {order.retail_name} · {order.retail_phone}</p>
        ) : (
          order.delivery_address && <p>Giao tới: {order.delivery_address}</p>
        )}
        {order.note && <p className="text-gray-700">Ghi chú: {order.note}</p>}
      </div>

      <section className="flex flex-col gap-3">
        {groups.map((g) => (
          <div key={g.key} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
            {g.title && <h2 className="font-bold">{g.title}</h2>}
            <ul className="flex flex-col divide-y">
              {g.lines.map((l) => (
                <li key={l.id} className="flex flex-col gap-0.5 py-2">
                  <span className="font-semibold">{product.get(l.product_id)?.name ?? 'Sản phẩm'}</span>
                  <span className="flex justify-between gap-2 text-gray-700">
                    <span>{l.qty} × <Money value={Number(l.sale_price_snap)} /></span>
                    <Money value={Number(l.line_total)} className="font-semibold text-gray-900" />
                  </span>
                  {isCtv && Number(l.line_commission) > 0 && (
                    <span className="text-sm text-green-800">Hoa hồng <Money value={Number(l.line_commission)} /></span>
                  )}
                  {l.line_partner_price !== null && (
                    <span className="text-sm text-green-800">Giá đại lý <Money value={Number(l.line_partner_price)} /> / {product.get(l.product_id)?.unit}</span>
                  )}
                </li>
              ))}
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
          <div className="flex justify-between text-lg">
            <dt>Phải trả</dt><dd><Money value={Number(order.partner_payable)} className="font-bold" /></dd>
          </div>
        )}
        {Number(order.commission_expected) > 0 && (
          <div className="flex justify-between text-green-800">
            <dt>Hoa hồng dự kiến</dt><dd><Money value={Number(order.commission_expected)} className="font-semibold" /></dd>
          </div>
        )}
      </dl>

      <OrderActions orderId={order.id} kind={session.kind} editable={editable} lines={editLines} />

      {order.source === 'partner' && (
        <Link
          href={`/doi-tac/don-moi?tu-don=${order.id}`}
          className="flex h-11 items-center justify-center rounded-lg border border-green-700 font-semibold text-green-800"
        >
          Đặt lại
        </Link>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Lịch sử trạng thái</h2>
        <ol className="flex flex-col gap-1">
          {log.map((e) => (
            <li key={e.id} className="flex justify-between gap-2">
              <span>{STATUS_LABEL[e.to_status]}</span>
              <span className="text-gray-600">{formatDateTime(e.changed_at)}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}

export default function OrderDetailPage({ params }: PageProps<'/doi-tac/don-hang/[id]'>) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 text-base">
      <Link href="/doi-tac/don-hang" className="flex h-11 items-center font-semibold text-green-800">← Đơn hàng</Link>
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <OrderDetail params={params} />
      </Suspense>
    </main>
  )
}
