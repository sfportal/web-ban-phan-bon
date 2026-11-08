'use client'

import { Download, Layers } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Badge, Button, buttonClass, Card, EmptyState, SectionHeader } from '@/components/ui'
import { formatDate, formatVnd } from '@/lib/format'
import { markBatchPaid } from '@/lib/payouts/admin-actions'
import { BATCH_KIND_LABEL } from '@/lib/payouts/validate'
import type { AdminPayoutRow, BatchRow } from '@/lib/payouts/wallet'
import { BatchCreate } from './BatchCreate'
import { MarkPaidDialog } from './MarkPaidDialog'
import { PayoutItem } from './PayoutItem'

/** Tab "Đợt chi": tạo đợt, danh sách đợt; có `detail` thì hiện các khoản của đợt đó. */
export function BatchList({
  batches, detail, canAct,
}: { batches: BatchRow[]; detail: { batch: BatchRow; payouts: AdminPayoutRow[] } | null; canAct: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      {canAct && <BatchCreate />}
      {detail && <BatchDetail batch={detail.batch} payouts={detail.payouts} canAct={canAct} />}
      <section className="flex flex-col gap-3">
        <SectionHeader title="Các đợt chi" />
        {batches.length === 0 ? (
          <Card>
            <EmptyState icon={<Layers className="size-7" />} title="Chưa có đợt chi nào" description="Tạo đợt chi để trả hoa hồng cho nhiều CTV cùng lúc." />
          </Card>
        ) : (
          <Card as="div" className="overflow-hidden">
            <ul className="divide-y divide-stone-100">
              {batches.map((b) => (
                <li key={b.id} className="even:bg-stone-50/70">
                  <Link
                    href={`/admin/hoa-hong?tab=dot-chi&dot=${b.id}`}
                    aria-current={detail?.batch.id === b.id ? 'true' : undefined}
                    className="flex flex-col gap-0.5 px-4 py-3 hover:bg-primary-soft/50"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <b className="font-semibold">Đợt {BATCH_KIND_LABEL[b.kind]} · chốt {formatDate(b.cutoffDate)}</b>
                      {b.isDemo && <Badge tone="gray">Thử</Badge>}
                    </span>
                    <span className="text-sm text-stone-600">Tạo {formatDate(b.createdAt)}{b.note && ` · ${b.note}`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  )
}

function BatchDetail({ batch, payouts, canAct }: { batch: BatchRow; payouts: AdminPayoutRow[]; canAct: boolean }) {
  const router = useRouter()
  const [paying, setPaying] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const unpaid = payouts.filter((p) => p.status === 'requested' || p.status === 'approved')
  const total = payouts.reduce((s, p) => s + p.amount, 0)

  return (
    <section aria-label="Chi tiết đợt chi" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeader
          title={`Đợt ${BATCH_KIND_LABEL[batch.kind]} · chốt ${formatDate(batch.cutoffDate)}`}
          subtitle={`${payouts.length} khoản, tổng ${formatVnd(total)}${batch.note ? ` · ${batch.note}` : ''}`}
        />
        {canAct && (
          <div className="flex flex-wrap gap-2">
            <a href={`/admin/xuat-du-lieu?loai=chi-tra-dot&dot=${batch.id}`} download className={buttonClass({ variant: 'secondary' })}>
              <Download aria-hidden className="size-5" />Xuất Excel
            </a>
            <Button disabled={unpaid.length === 0} onClick={() => setPaying(true)}>Đánh dấu tất cả đã chuyển</Button>
          </div>
        )}
      </div>
      {result && <p role="status" className="rounded-xl border border-stone-200 bg-white p-3">{result}</p>}
      {payouts.length === 0 ? (
        <Card><EmptyState title="Đợt này không có khoản chi nào" /></Card>
      ) : (
        <ul aria-label="Khoản chi của đợt" className="grid gap-3 lg:grid-cols-2">
          {payouts.map((p) => <li key={p.id}><PayoutItem p={p} canAct={canAct} /></li>)}
        </ul>
      )}
      {paying && (
        <MarkPaidDialog
          title={`Đánh dấu ${unpaid.length} khoản đã chuyển`}
          description="Dùng chung một mã giao dịch và ngày chuyển cho các khoản chưa chuyển trong đợt."
          withProof={false}
          onClose={() => setPaying(false)}
          onSubmit={async (v) => {
            const res = await markBatchPaid(batch.id, { ref: v.ref, date: v.date })
            if (res.ok === 0 && res.failed.length > 0) {
              return `Không đánh dấu được khoản nào (${res.failed.length} lỗi). Kiểm tra mã giao dịch và ngày.`
            }
            setResult(
              res.failed.length
                ? `Đã đánh dấu ${res.ok} khoản đã chuyển; ${res.failed.length} khoản lỗi, thử lại sau.`
                : `Đã đánh dấu ${res.ok} khoản đã chuyển.`,
            )
            router.refresh()
            return null
          }}
        />
      )}
    </section>
  )
}
