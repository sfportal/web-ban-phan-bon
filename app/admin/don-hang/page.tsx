import { Suspense } from 'react'
import { OrderBulkList, type OrderRow } from '@/components/admin/OrderBulkList'
import { requireStaff } from '@/lib/auth/guards'
import { vnDateStart } from '@/lib/format'
import { STATUS_LABEL, type OrderStatus } from '@/lib/orders/status'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetch-all'

export const metadata = { title: `Đơn hàng — ${SITE_NAME}` }

const LIMIT = 200
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SOURCES = { 'doi-tac': 'partner', 'don-le': 'retail' } as const
const input = 'h-11 rounded-lg border border-gray-300 px-3 text-base'

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '')

async function Orders({ searchParams }: Pick<PageProps<'/admin/don-hang'>, 'searchParams'>) {
  await requireStaff()
  const sp = await searchParams
  const status = Object.hasOwn(STATUS_LABEL, one(sp['trang-thai'])) ? (one(sp['trang-thai']) as OrderStatus) : ''
  const nguon = Object.hasOwn(SOURCES, one(sp.nguon)) ? (one(sp.nguon) as keyof typeof SOURCES) : ''
  const ctv = UUID.test(one(sp.ctv)) ? one(sp.ctv) : ''
  const from = vnDateStart(one(sp.tu))
  const to = vnDateStart(one(sp.den), 1) // ngày kết thúc tính cả ngày

  const db = adminClient()
  let q = db.from('orders')
    .select('id, code, created_at, source, status, subtotal, partner_payable, retail_name, retail_phone, partners(name, phone)')
  if (status) q = q.eq('status', status)
  if (nguon) q = q.eq('source', SOURCES[nguon])
  if (ctv) q = q.eq('partner_id', ctv)
  if (from) q = q.gte('created_at', from.toISOString())
  if (to) q = q.lt('created_at', to.toISOString())
  const [{ data: orders }, partners] = await Promise.all([
    q.order('created_at', { ascending: false }).order('id').limit(LIMIT + 1).throwOnError(),
    fetchAll((f, t) => db.from('partners').select('id, name, phone').neq('status', 'pending').order('name').order('id').range(f, t).throwOnError()),
  ])

  const rows: OrderRow[] = orders.slice(0, LIMIT).map((o) => ({
    id: o.id,
    code: o.code,
    createdAt: o.created_at,
    status: o.status,
    who: o.source === 'retail'
      ? `Đơn lẻ: ${o.retail_name ?? ''}${o.partners ? ` (khách của ${o.partners.name})` : ''}`
      : `${o.partners?.name ?? ''}${o.partner_payable !== null ? ' (đại lý)' : ''}`,
    phone: o.source === 'retail' ? o.retail_phone : o.partners?.phone ?? null,
    total: Number(o.partner_payable ?? o.subtotal),
  }))

  return (
    <>
      <form action="/admin/don-hang" role="search" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-700">Trạng thái</span>
          <select name="trang-thai" defaultValue={status} className={input}>
            <option value="">Tất cả</option>
            {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-700">Nguồn</span>
          <select name="nguon" defaultValue={nguon} className={input}>
            <option value="">Tất cả</option>
            <option value="doi-tac">Đối tác</option>
            <option value="don-le">Đơn lẻ</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-700">CTV / đại lý</span>
          <select name="ctv" defaultValue={ctv} className={`${input} max-w-60`}>
            <option value="">Tất cả</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.phone}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-700">Từ ngày</span>
          <input type="date" name="tu" defaultValue={from ? one(sp.tu) : ''} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-700">Đến ngày</span>
          <input type="date" name="den" defaultValue={to ? one(sp.den) : ''} className={input} />
        </label>
        <button type="submit" className="h-11 rounded-lg bg-green-700 px-4 font-semibold text-white">Lọc</button>
      </form>
      {orders.length > LIMIT && (
        <p className="text-sm text-gray-600">Chỉ hiện {LIMIT} đơn mới nhất, hãy lọc theo ngày, trạng thái hoặc CTV để thu hẹp.</p>
      )}
      <OrderBulkList rows={rows} />
    </>
  )
}

export default function OrdersPage(props: PageProps<'/admin/don-hang'>) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Đơn hàng</h1>
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <Orders searchParams={props.searchParams} />
      </Suspense>
    </main>
  )
}
