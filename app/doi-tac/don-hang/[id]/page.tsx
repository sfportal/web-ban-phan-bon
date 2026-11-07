import { ChevronLeft, MapPin, RotateCcw, UserRound } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Money } from '@/components/Money'
import { StatusBadge } from '@/components/StatusBadge'
import { Button, Card } from '@/components/ui'
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
      <Card className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{order.code}</h1>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-stone-600">Đặt lúc {formatDateTime(order.created_at)}</p>
        {order.source === 'retail' ? (
          <p className="text-stone-800">Khách tự đặt: {order.retail_name} · {order.retail_phone}</p>
        ) : (
          order.delivery_address && (
            <p className="flex items-start gap-2 text-stone-800">
              <MapPin aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>Giao tới: {order.delivery_address}</span>
            </p>
          )
        )}
        {order.note && <p className="text-stone-700">Ghi chú: {order.note}</p>}
      </Card>

      <section className="flex flex-col gap-3">
        {groups.map((g) => (
          <Card key={g.key} className="overflow-hidden">
            {g.title && (
              <h2 className="flex items-center gap-2 border-b border-stone-100 bg-primary-soft/50 px-4 py-2.5 font-bold text-ink">
                <UserRound aria-hidden className="size-5 shrink-0 text-primary" />
                {g.title}
              </h2>
            )}
            <ul className="flex flex-col divide-y divide-stone-100 px-4">
              {g.lines.map((l) => (
                <li key={l.id} className="flex flex-col gap-0.5 py-3">
                  <span className="font-semibold text-ink">{product.get(l.product_id)?.name ?? 'Sản phẩm'}</span>
                  <span className="flex justify-between gap-2 text-stone-700">
                    <span>{l.qty} × <Money value={Number(l.sale_price_snap)} /></span>
                    <Money value={Number(l.line_total)} className="font-semibold tabular-nums text-ink" />
                  </span>
                  {isCtv && Number(l.line_commission) > 0 && (
                    <span className="text-sm text-primary">Hoa hồng <Money value={Number(l.line_commission)} /></span>
                  )}
                  {l.line_partner_price !== null && (
                    <span className="text-sm text-primary">Giá đại lý <Money value={Number(l.line_partner_price)} /> / {product.get(l.product_id)?.unit}</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </section>

      <Card as="section" className="p-4">
        <dl className="flex flex-col gap-1.5">
          <div className="flex justify-between text-stone-700"><dt>Số lượng</dt><dd className="tabular-nums">{order.total_qty}</dd></div>
          <div className="flex justify-between text-stone-700">
            <dt>{order.partner_payable !== null ? 'Tổng theo giá bán lẻ' : 'Tổng tiền'}</dt>
            <dd><Money value={Number(order.subtotal)} className="font-semibold tabular-nums text-ink" /></dd>
          </div>
          {order.partner_payable !== null && (
            <div className="flex justify-between border-t border-stone-100 pt-2 text-lg text-ink">
              <dt className="font-semibold">Phải trả</dt><dd><Money value={Number(order.partner_payable)} className="font-bold tabular-nums" /></dd>
            </div>
          )}
          {Number(order.commission_expected) > 0 && (
            <div className="flex justify-between rounded-xl bg-primary-soft px-3 py-2 text-primary-hover">
              <dt className="font-semibold">Hoa hồng dự kiến</dt><dd><Money value={Number(order.commission_expected)} className="font-bold tabular-nums" /></dd>
            </div>
          )}
        </dl>
      </Card>

      <OrderActions orderId={order.id} kind={session.kind} editable={editable} lines={editLines} />

      {order.source === 'partner' && (
        <Button href={`/doi-tac/don-moi?tu-don=${order.id}`} variant="secondary" prefetch={false}>
          <RotateCcw aria-hidden className="size-5" />
          Đặt lại
        </Button>
      )}

      <Card as="section" className="flex flex-col gap-3 p-4">
        <h2 className="text-lg font-bold text-ink">Lịch sử trạng thái</h2>
        <ol className="flex flex-col">
          {log.map((e, i) => (
            <li key={e.id} className="relative flex justify-between gap-3 pb-3 pl-6 last:pb-0">
              <span aria-hidden className={`absolute left-0 top-1.5 size-3 rounded-full ${i === log.length - 1 ? 'bg-primary ring-4 ring-primary-soft' : 'bg-stone-300'}`} />
              {i < log.length - 1 && <span aria-hidden className="absolute bottom-0 left-[5px] top-5 w-0.5 bg-stone-200" />}
              <span className="font-semibold text-ink">{STATUS_LABEL[e.to_status]}</span>
              <span className="text-sm text-stone-600">{formatDateTime(e.changed_at)}</span>
            </li>
          ))}
        </ol>
      </Card>
    </>
  )
}

export default function OrderDetailPage({ params }: PageProps<'/doi-tac/don-hang/[id]'>) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 pb-8 pt-3 text-base">
      <Link href="/doi-tac/don-hang" prefetch={false} className="-ml-1 flex h-11 items-center gap-1 self-start font-semibold text-primary">
        <ChevronLeft aria-hidden className="size-5" />
        Đơn hàng
      </Link>
      <Suspense fallback={<p className="py-8 text-center text-stone-600">Đang tải...</p>}>
        <OrderDetail params={params} />
      </Suspense>
    </main>
  )
}
