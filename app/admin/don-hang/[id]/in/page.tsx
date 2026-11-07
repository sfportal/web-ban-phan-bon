import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PrintButton } from '@/components/admin/PrintButton'
import { requireStaff } from '@/lib/auth/guards'
import { formatDate, formatVnd } from '@/lib/format'
import { groupByFarmer } from '@/lib/orders/group-lines'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'

export const metadata = { title: `Phiếu giao hàng — ${SITE_NAME}` }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PRINT_CSS = '@page { size: A5; margin: 8mm; } @media print { body { font-size: 12px; } }'

// Phiếu giao hàng A5. KHÔNG có hoa hồng / tỷ lệ ở bất kỳ đâu trên trang này.
async function DeliverySlip({ params }: Pick<PageProps<'/admin/don-hang/[id]/in'>, 'params'>) {
  await requireStaff()
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const db = adminClient()
  const [{ data: order }, { data: store }] = await Promise.all([
    db.from('orders')
      .select('id, code, created_at, source, delivery_address, payment_method, retail_name, retail_phone, retail_address, note, subtotal, partner_payable, total_qty, partners(name, phone)')
      .eq('id', id).maybeSingle().throwOnError(),
    db.from('settings').select('value').eq('key', 'store_name').maybeSingle().throwOnError(),
  ])
  if (!order) notFound()
  const { data: lines } = await db
    .from('order_lines').select('id, farmer_id, qty, sale_price_snap, line_total, line_partner_price, farmers(name, phone), products(name, unit)')
    .eq('order_id', order.id).order('id').throwOnError()

  const storeName = typeof store?.value === 'string' && store.value.trim() ? store.value.trim() : SITE_NAME
  // Đơn đại lý: thu theo giá mua của đại lý; còn lại theo giá bán.
  const wholesale = order.partner_payable !== null
  const unitPrice = (l: (typeof lines)[number]) => Number(wholesale ? l.line_partner_price ?? l.sale_price_snap : l.sale_price_snap)
  const amount = (l: (typeof lines)[number]) => (wholesale ? unitPrice(l) * l.qty : Number(l.line_total))
  const total = wholesale ? Number(order.partner_payable) : Number(order.subtotal)
  const recipient = order.source === 'retail'
    ? { name: order.retail_name, phone: order.retail_phone, address: order.retail_address }
    : { name: order.partners?.name ?? '', phone: order.partners?.phone ?? '', address: order.delivery_address }
  const groups = groupByFarmer(lines)
  const cellCls = 'border border-gray-400 px-1.5 py-1'

  return (
    <article className="mx-auto flex w-full max-w-[148mm] flex-col gap-3 text-sm text-black">
      <style>{PRINT_CSS}</style>
      <header className="flex items-start justify-between gap-2 border-b border-black pb-2">
        <div>
          <p className="text-lg font-bold">{storeName}</p>
          <p className="text-base font-bold uppercase">Phiếu giao hàng</p>
        </div>
        <div className="text-right">
          <p>Mã đơn: <b>{order.code}</b></p>
          <p>Ngày: {formatDate(order.created_at)}</p>
        </div>
      </header>

      <section>
        <p>Người nhận: <b>{recipient.name}</b>{recipient.phone && ` · ${recipient.phone}`}</p>
        <p>Điểm giao: {recipient.address ?? ''}</p>
        <p>Thanh toán: {order.payment_method === 'transfer' ? 'Chuyển khoản' : 'Thu tiền khi giao (COD)'}</p>
        {order.note && <p>Ghi chú: {order.note}</p>}
      </section>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${cellCls} text-left`}>Sản phẩm</th>
            <th className={`${cellCls} text-right`}>SL</th>
            <th className={`${cellCls} text-right`}>Đơn giá</th>
            <th className={`${cellCls} text-right`}>Thành tiền</th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.key}>
            {g.title && (
              <tr>
                <td colSpan={4} className={`${cellCls} bg-gray-100 font-bold`}>{g.title}</td>
              </tr>
            )}
            {g.lines.map((l) => (
              <tr key={l.id}>
                <td className={cellCls}>{l.products?.name}{l.products?.unit && ` (${l.products.unit})`}</td>
                <td className={`${cellCls} text-right`}>{l.qty}</td>
                <td className={`${cellCls} text-right whitespace-nowrap`}>{formatVnd(unitPrice(l))}</td>
                <td className={`${cellCls} text-right whitespace-nowrap`}>{formatVnd(amount(l))}</td>
              </tr>
            ))}
            {g.title && groups.length > 1 && (
              <tr>
                <td colSpan={3} className={`${cellCls} text-right`}>Cộng</td>
                <td className={`${cellCls} text-right whitespace-nowrap font-semibold`}>{formatVnd(g.lines.reduce((s, l) => s + amount(l), 0))}</td>
              </tr>
            )}
          </tbody>
        ))}
        <tfoot>
          <tr>
            <td className={`${cellCls} font-bold`}>Tổng cộng</td>
            <td className={`${cellCls} text-right font-bold`}>{order.total_qty}</td>
            <td className={cellCls} />
            <td className={`${cellCls} text-right whitespace-nowrap font-bold`}>{formatVnd(total)}</td>
          </tr>
        </tfoot>
      </table>

      <section className="mt-4 grid grid-cols-2 gap-4 text-center">
        <div className="pb-20">
          <p className="font-bold">Người giao<br /><span className="font-normal italic">(ký, ghi rõ họ tên)</span></p>
        </div>
        <div className="pb-20">
          <p className="font-bold">Người nhận<br /><span className="font-normal italic">(ký, ghi rõ họ tên)</span></p>
        </div>
      </section>

      <div className="flex gap-2 print:hidden">
        <PrintButton />
        <Link href={`/admin/don-hang/${order.id}`} className="flex h-11 items-center rounded-lg border border-gray-300 px-4 font-semibold">Quay lại đơn</Link>
      </div>
    </article>
  )
}

export default function DeliverySlipPage({ params }: PageProps<'/admin/don-hang/[id]/in'>) {
  return (
    <main className="flex flex-1 flex-col p-4 print:p-0">
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <DeliverySlip params={params} />
      </Suspense>
    </main>
  )
}
