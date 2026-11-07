import { ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { Button, Card, EmptyState } from '@/components/ui'
import { requirePartner } from '@/lib/auth/guards'
import { STATUS_LABEL, type OrderStatus } from '@/lib/orders/status'
import { SITE_NAME } from '@/lib/site'
import { createServerClient } from '@/lib/supabase/server'
import { ORDER_SUMMARY_COLUMNS, OrderList, type OrderSummary } from './OrderList'

export const metadata = { title: `Đơn hàng — ${SITE_NAME}` }

const LIMIT = 100
const STATUSES = Object.keys(STATUS_LABEL) as OrderStatus[]

async function Orders({ searchParams }: Pick<PageProps<'/doi-tac/don-hang'>, 'searchParams'>) {
  const session = await requirePartner()
  const raw = (await searchParams)['trang-thai']
  const status = STATUSES.find((s) => s === raw) ?? null

  let query = createServerClient()
    .from('orders').select(ORDER_SUMMARY_COLUMNS).eq('partner_id', session.partnerId)
    .order('created_at', { ascending: false }).limit(LIMIT)
  if (status) query = query.eq('status', status)
  const { data } = await query.throwOnError()

  const chip = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? 'page' : undefined}
      prefetch={false}
      className={`flex h-11 shrink-0 items-center rounded-full border px-4 font-semibold transition-colors ${
        active ? 'border-primary bg-primary text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-primary/50'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <>
      <nav aria-label="Lọc theo trạng thái" className="-mx-4 overflow-x-auto px-4 pb-1">
        <div className="flex min-w-max gap-2">
          {chip('/doi-tac/don-hang', 'Tất cả', status === null)}
          {STATUSES.map((s) => chip(`/doi-tac/don-hang?trang-thai=${s}`, STATUS_LABEL[s], status === s))}
        </div>
      </nav>
      {data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="size-7" />}
            title="Không có đơn nào"
            description={status ? `Chưa có đơn ở trạng thái “${STATUS_LABEL[status]}”.` : 'Đơn bạn gửi sẽ hiện ở đây.'}
            action={<Button href="/doi-tac/don-moi" prefetch={false}>Lên đơn mới</Button>}
          />
        </Card>
      ) : (
        <>
          <OrderList orders={data as OrderSummary[]} kind={session.kind} />
          {data.length === LIMIT && <p className="text-center text-sm text-stone-600">Hiển thị {LIMIT} đơn gần nhất.</p>}
        </>
      )}
    </>
  )
}

export default function OrdersPage({ searchParams }: PageProps<'/doi-tac/don-hang'>) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 pb-8 pt-5 text-base">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Đơn hàng</h1>
      <Suspense fallback={<p className="py-8 text-center text-stone-600">Đang tải...</p>}>
        <Orders searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
