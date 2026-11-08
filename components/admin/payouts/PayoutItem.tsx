'use client'

import { Check, FileText, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Badge, Button, Card, Textarea, type BadgeTone } from '@/components/ui'
import { formatDate, formatVnd } from '@/lib/format'
import { approvePayout, getAdminProofUrl, markPayoutPaid, rejectPayout } from '@/lib/payouts/admin-actions'
import { PAYOUT_ERROR_MESSAGES, PAYOUT_STATUS_LABEL, type PayoutErrorCode, type PayoutStatus } from '@/lib/payouts/validate'
import type { AdminPayoutRow } from '@/lib/payouts/wallet'
import { MarkPaidDialog } from './MarkPaidDialog'

export const STATUS_TONE: Record<PayoutStatus, BadgeTone> = { requested: 'yellow', approved: 'blue', paid: 'green', rejected: 'red' }
const msg = (code: string) => PAYOUT_ERROR_MESSAGES[code as PayoutErrorCode] ?? 'Không thực hiện được. Thử lại sau.'

function ProofButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function open() {
    setError(null)
    setBusy(true)
    // Mở tab trống ngay trong lúc bấm để trình duyệt không chặn cửa sổ, rồi mới gán địa chỉ.
    const tab = window.open('', '_blank')
    try {
      const res = await getAdminProofUrl(id)
      if ('error' in res) {
        tab?.close()
        setError(msg(res.error))
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
      <Button variant="secondary" disabled={busy} onClick={open}>
        <FileText aria-hidden className="size-4" />Xem chứng từ
      </Button>
      {error && <p role="alert" className="w-full text-sm font-semibold text-red-700">{error}</p>}
    </>
  )
}

/** Một khoản chi: thông tin CTV, số tiền, ngân hàng (bản chụp lúc yêu cầu), trạng thái và (admin) các nút thao tác. */
export function PayoutItem({ p, canAct }: { p: AdminPayoutRow; canAct: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [paying, setPaying] = useState(false)
  const open = p.status === 'requested' || p.status === 'approved'

  async function run(fn: () => Promise<{ ok: true } | { error: string }>) {
    setError(null)
    setBusy(true)
    try {
      const res = await fn()
      if ('error' in res) setError(msg(res.error))
      else {
        setRejecting(false)
        router.refresh()
      }
    } catch {
      setError('Không lưu được. Kiểm tra kết nối mạng rồi thử lại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <Link href={`/admin/doi-tac/${p.partnerId}`} className="font-semibold text-primary underline-offset-4 hover:underline">{p.partnerName}</Link>
          <span className="block text-sm text-stone-600">{p.phone}</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-lg font-bold tabular-nums text-ink">{formatVnd(p.amount)}</span>
          <Badge tone={STATUS_TONE[p.status]}>{PAYOUT_STATUS_LABEL[p.status]}</Badge>
        </div>
      </div>
      <p className="break-words text-sm text-stone-700">
        {p.bankName ? `${p.bankName} · ${p.bankAccount} · ${p.bankHolder}` : 'Chưa có thông tin ngân hàng'}
      </p>
      <p className="text-sm text-stone-600">
        {p.source === 'batch' ? 'Đợt chi' : 'Yêu cầu'} {formatDate(p.requestedAt)}
        {p.status === 'paid' && p.transferredOn && ` · chuyển ${formatDate(p.transferredOn)}`}
      </p>
      {p.transferRef && <p className="break-all text-sm text-stone-700">Mã GD: {p.transferRef}</p>}
      {p.status === 'rejected' && p.rejectReason && <p className="text-sm text-red-800">Lý do: {p.rejectReason}</p>}

      {canAct && (open || (p.status === 'paid' && p.hasProof)) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {p.status === 'requested' && (
            <Button disabled={busy} onClick={() => run(() => approvePayout(p.id))}>
              <Check aria-hidden className="size-4" />Duyệt
            </Button>
          )}
          {open && (
            <Button variant="secondary" disabled={busy} onClick={() => { setError(null); setPaying(true) }}>Đánh dấu đã chuyển</Button>
          )}
          {open && (
            <Button variant="ghost" disabled={busy} onClick={() => setRejecting((v) => !v)} aria-expanded={rejecting}>
              <X aria-hidden className="size-4" />Từ chối
            </Button>
          )}
          {p.status === 'paid' && p.hasProof && <ProofButton id={p.id} />}
        </div>
      )}
      {canAct && rejecting && (
        <form
          className="flex flex-col gap-2 rounded-xl bg-stone-50 p-3"
          onSubmit={(e) => { e.preventDefault(); void run(() => rejectPayout(p.id, reason)) }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">Lý do từ chối</span>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} required />
          </label>
          <Button type="submit" variant="danger" disabled={busy} className="self-start">Xác nhận từ chối</Button>
        </form>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
      {paying && (
        <MarkPaidDialog
          title={`Đã chuyển ${formatVnd(p.amount)} cho ${p.partnerName}`}
          description={p.bankName ? `${p.bankName} · ${p.bankAccount} · ${p.bankHolder}` : undefined}
          onClose={() => setPaying(false)}
          onSubmit={async ({ ref, date, proof }) => {
            const form = new FormData()
            form.set('id', p.id)
            form.set('ref', ref)
            form.set('date', date)
            if (proof) form.set('proof', proof)
            const res = await markPayoutPaid(form)
            if ('error' in res) return msg(res.error)
            router.refresh()
            return null
          }}
        />
      )}
    </Card>
  )
}
