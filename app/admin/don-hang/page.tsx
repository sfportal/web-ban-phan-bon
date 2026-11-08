import { Suspense } from 'react'
import { Filter } from 'lucide-react'
import { AdminMain, Loading, PageHeader } from '@/components/admin/AdminPage'
import { OrderBulkList, type OrderRow } from '@/components/admin/OrderBulkList'
import { Button, Card, Input, Select } from '@/components/ui'
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
const label = 'flex min-w-0 flex-col gap-1.5'
const caption = 'text-sm font-semibold text-stone-700'

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
    .select('id, code, created_at, source, status, subtotal, partner_payable, retail_name, retail_phone, is_demo, partners(name, phone)')
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
    isDemo: o.is_demo,
  }))

  return (
    <>
      <Card className="p-4">
        <form action="/admin/don-hang" role="search" className="grid grid-cols-2 items-end gap-3 md:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
          <label className={label}>
            <span className={caption}>Trạng thái</span>
            <Select name="trang-thai" defaultValue={status}>
              <option value="">Tất cả</option>
              {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </Select>
          </label>
          <label className={label}>
            <span className={caption}>Nguồn</span>
            <Select name="nguon" defaultValue={nguon}>
              <option value="">Tất cả</option>
              <option value="doi-tac">Đối tác</option>
              <option value="don-le">Đơn lẻ</option>
            </Select>
          </label>
          <label className={`${label} col-span-2 md:col-span-1`}>
            <span className={caption}>CTV / đại lý</span>
            <Select name="ctv" defaultValue={ctv}>
              <option value="">Tất cả</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.phone}</option>)}
            </Select>
          </label>
          <label className={label}>
            <span className={caption}>Từ ngày</span>
            <Input type="date" name="tu" defaultValue={from ? one(sp.tu) : ''} />
          </label>
          <label className={label}>
            <span className={caption}>Đến ngày</span>
            <Input type="date" name="den" defaultValue={to ? one(sp.den) : ''} />
          </label>
          <Button type="submit" className="col-span-2 md:col-span-1"><Filter aria-hidden className="size-5" />Lọc</Button>
        </form>
      </Card>
      {orders.length > LIMIT && (
        <p className="text-stone-600">Chỉ hiện {LIMIT} đơn mới nhất, hãy lọc theo ngày, trạng thái hoặc CTV để thu hẹp.</p>
      )}
      <OrderBulkList rows={rows} />
    </>
  )
}

export default function OrdersPage(props: PageProps<'/admin/don-hang'>) {
  return (
    <AdminMain>
      <PageHeader title="Đơn hàng" subtitle="Chọn nhiều đơn để đổi trạng thái cùng lúc. Bấm mã đơn để xem chi tiết và in phiếu giao." />
      <Suspense fallback={<Loading />}>
        <Orders searchParams={props.searchParams} />
      </Suspense>
    </AdminMain>
  )
}
