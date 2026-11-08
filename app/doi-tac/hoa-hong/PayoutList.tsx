'use client'

import { FileText } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Card, EmptyState, type BadgeTone } from '@/components/ui'
import { formatDate, formatVnd } from '@/lib/format'
import { getProofUrl } from '@/lib/payouts/partner-actions'
import { PAYOUT_ERROR_MESSAGES, PAYOUT_SOURCE_LABEL, PAYOUT_STATUS_LABEL, type PayoutStatus } from '@/lib/payouts/validate'
import type { PayoutRow } from '@/lib/payouts/wallet'

const TONE: Record<PayoutStatus, BadgeTone> = { requested: 'yellow', approved: 'blue', paid: 'green', rejected: 'red' }

function ProofButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function open() {
    setError(null)
    setBusy(true)
    // Mở tab trống ngay trong lúc bấm để trình duyệt không chặn cửa sổ, rồi mới gán địa chỉ.
    const tab = window.open('', '_blank')
    try {
      const res = await getProofUrl(id)
      if ('error' in res) {
        tab?.close()
        setError(PAYOUT_ERROR_MESSAGES[res.error])
      } else if (tab) {
        tab.opener = null
        tab.location.href = res.url
      } else {
        window.location.href = res.url
      }
    } catch {
      tab?.close()
      setError('Không mở được chứng từ. Thử lại sau.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="secondary" disabled={busy} onClick={open} className="self-start">
        <FileText aria-hidden className="size-4" />Xem chứng từ
      </Button>
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
    </>
  )
}

export function PayoutList({ payouts }: { payouts: PayoutRow[] }) {
  if (payouts.length === 0) {
    return (
      <Card>
        <EmptyState title="Chưa có khoản chi nào." description="Yêu cầu rút tiền và các khoản cửa hàng chi sẽ hiện ở đây." />
      </Card>
    )
  }
  return (
    <ul aria-label="Khoản chi" className="flex flex-col gap-2.5">
      {payouts.map((p) => (
        <li key={p.id}>
          <Card className="flex flex-col gap-1.5 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-lg font-bold tabular-nums text-ink">{formatVnd(p.amount)}</span>
              <Badge tone={TONE[p.status]}>{PAYOUT_STATUS_LABEL[p.status]}</Badge>
            </div>
            <p className="text-sm text-stone-600">
              {PAYOUT_SOURCE_LABEL[p.source]} · {formatDate(p.paidAt ?? p.requestedAt)}
            </p>
            {p.status === 'rejected' && p.rejectReason && (
              <p className="text-sm text-red-800">Lý do: {p.rejectReason}</p>
            )}
            {p.transferRef && <p className="break-all text-sm text-stone-700">Mã GD: {p.transferRef}</p>}
            {p.hasProof && <ProofButton id={p.id} />}
          </Card>
        </li>
      ))}
    </ul>
  )
}
