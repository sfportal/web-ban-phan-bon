import Link from 'next/link'
import { Suspense } from 'react'
import { AdminMain, Loading, PageHeader } from '@/components/admin/AdminPage'
import { BalanceTable } from '@/components/admin/payouts/BalanceTable'
import { BatchList } from '@/components/admin/payouts/BatchList'
import { RequestList } from '@/components/admin/payouts/RequestList'
import { requireStaff } from '@/lib/auth/guards'
import { PAYOUT_STATUS_LABEL, type PayoutStatus } from '@/lib/payouts/validate'
import { getBatch, listBalances, listBatches, listPayoutRequests } from '@/lib/payouts/wallet'
import { SITE_NAME } from '@/lib/site'

export const metadata = { title: `Chi trả — ${SITE_NAME}` }

const TITLE = 'Chi trả'
const TABS = [
  { key: 'yeu-cau', label: 'Yêu cầu rút' },
  { key: 'dot-chi', label: 'Đợt chi' },
  { key: 'so-du', label: 'Số dư' },
] as const
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const first = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined)

async function Payouts({ searchParams }: Pick<PageProps<'/admin/hoa-hong'>, 'searchParams'>) {
  const { role } = await requireStaff()
  const canAct = role === 'admin'
  const q = await searchParams
  const tab = TABS.find((t) => t.key === first(q.tab))?.key ?? 'yeu-cau'
  const rawStatus = first(q['trang-thai'])
  const status = rawStatus && Object.hasOwn(PAYOUT_STATUS_LABEL, rawStatus) ? (rawStatus as PayoutStatus) : undefined
  const dot = first(q.dot)

  let body
  if (tab === 'yeu-cau') {
    body = <RequestList rows={await listPayoutRequests(status)} status={status} canAct={canAct} />
  } else if (tab === 'dot-chi') {
    const [batches, detail] = await Promise.all([listBatches(), dot && UUID.test(dot) ? getBatch(dot) : null])
    body = <BatchList batches={batches} detail={detail} canAct={canAct} />
  } else {
    body = <BalanceTable rows={await listBalances()} canAct={canAct} />
  }
  return (
    <>
      <nav aria-label="Mục chi trả" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const on = t.key === tab
          return (
            <Link
              key={t.key}
              href={`/admin/hoa-hong?tab=${t.key}`}
              aria-current={on ? 'page' : undefined}
              className={`flex h-11 items-center rounded-full px-4 font-semibold transition-colors ${
                on ? 'bg-primary text-white' : 'border border-stone-300 bg-white text-stone-700 hover:border-primary/40 hover:text-primary'
              }`}
            >
              {t.label}
            </Link>
          )
        })}
      </nav>
      {body}
    </>
  )
}

export default function PayoutsPage(props: PageProps<'/admin/hoa-hong'>) {
  return (
    <AdminMain>
      <PageHeader
        title={TITLE}
        subtitle="Duyệt yêu cầu rút tiền, chi theo đợt và theo dõi số dư hoa hồng của cộng tác viên."
      />
      <Suspense fallback={<Loading />}>
        <Payouts searchParams={props.searchParams} />
      </Suspense>
    </AdminMain>
  )
}
