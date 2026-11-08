'use client'

import { useEffect, useId, useState } from 'react'
import { Button, Field, Input } from '@/components/ui'
import { MAX_PROOF_BYTES, PROOF_TYPES, vnToday } from '@/lib/payouts/validate'

export type MarkPaidValues = { ref: string; date: string; proof: File | null }

/**
 * Hộp thoại đánh dấu đã chuyển: mã giao dịch (bắt buộc), ngày chuyển (không sau hôm nay),
 * chứng từ tùy chọn (`withProof`). `onSubmit` trả thông báo lỗi (hoặc null nếu xong → hộp tự đóng).
 */
export function MarkPaidDialog({
  title, description, withProof = true, submitLabel = 'Xác nhận đã chuyển', onSubmit, onClose,
}: {
  title: string
  description?: string
  withProof?: boolean
  submitLabel?: string
  onSubmit: (values: MarkPaidValues) => Promise<string | null>
  onClose: () => void
}) {
  const titleId = useId()
  const [ref, setRef] = useState('')
  const [date, setDate] = useState(vnToday())
  const [proof, setProof] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (proof && proof.size > MAX_PROOF_BYTES) return setError('Chứng từ tối đa 5MB')
    setBusy(true)
    try {
      const err = await onSubmit({ ref: ref.trim(), date, proof })
      if (err) setError(err)
      else onClose()
    } catch {
      setError('Không lưu được. Kiểm tra kết nối mạng rồi thử lại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        className="flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
      >
        <div>
          <h2 id={titleId} className="text-xl font-bold tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-stone-600">{description}</p>}
        </div>
        <Field label="Mã giao dịch">
          <Input autoFocus value={ref} onChange={(e) => setRef(e.target.value)} maxLength={100} required autoComplete="off" />
        </Field>
        <Field label="Ngày chuyển">
          <Input type="date" value={date} max={vnToday()} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        {withProof && (
          <Field label="Chứng từ (không bắt buộc)" hint="Ảnh JPG, PNG, WebP hoặc PDF, tối đa 5MB.">
            <Input type="file" accept={PROOF_TYPES.join(',')} onChange={(e) => setProof(e.target.files?.[0] ?? null)} className="h-auto py-2" />
          </Field>
        )}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 font-semibold text-red-800">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Hủy</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : submitLabel}</Button>
        </div>
      </form>
    </div>
  )
}
