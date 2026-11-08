import { Download, Inbox } from 'lucide-react'
import Link from 'next/link'
import { Card, EmptyState, buttonClass } from '@/components/ui'
import { PAYOUT_STATUS_LABEL, type PayoutStatus } from '@/lib/payouts/validate'
import type { AdminPayoutRow } from '@/lib/payouts/wallet'
import { PayoutItem } from './PayoutItem'

const STATUSES = Object.keys(PAYOUT_STATUS_LABEL) as PayoutStatus[]

const pill = (on: boolean) =>
  `flex h-11 items-center rounded-full px-4 font-semibold transition-colors ${
    on ? 'bg-primary text-white' : 'border border-stone-300 bg-white text-stone-700 hover:border-primary/40 hover:text-primary'
  }`

/** Tab "Yêu cầu rút": lọc theo trạng thái (?trang-thai=), danh sách khoản chi dạng thẻ. */
export function RequestList({ rows, status, canAct }: { rows: AdminPayoutRow[]; status?: PayoutStatus; canAct: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Lọc trạng thái" className="flex flex-wrap gap-2">
          <Link href="/admin/hoa-hong?tab=yeu-cau" aria-current={!status ? 'page' : undefined} className={pill(!status)}>Tất cả</Link>
          {STATUSES.map((s) => (
            <Link key={s} href={`/admin/hoa-hong?tab=yeu-cau&trang-thai=${s}`} aria-current={status === s ? 'page' : undefined} className={pill(status === s)}>
              {PAYOUT_STATUS_LABEL[s]}
            </Link>
          ))}
        </nav>
        {canAct && (
          <a
            href={`/admin/xuat-du-lieu?loai=chi-tra-yeu-cau${status ? `&trang-thai=${status}` : ''}`}
            download
            className={buttonClass({ variant: 'secondary' })}
          >
            <Download aria-hidden className="size-5" />Xuất Excel
          </a>
        )}
      </div>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Inbox className="size-7" />} title="Không có yêu cầu rút nào" description="Yêu cầu rút tiền của CTV sẽ hiện ở đây để duyệt và chuyển khoản." />
        </Card>
      ) : (
        <ul aria-label="Yêu cầu rút" className="grid gap-3 lg:grid-cols-2">
          {rows.map((p) => <li key={p.id}><PayoutItem p={p} canAct={canAct} /></li>)}
        </ul>
      )}
    </div>
  )
}
