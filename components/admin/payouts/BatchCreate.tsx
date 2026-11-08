'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button, Card, Field, Input, Select, SectionHeader } from '@/components/ui'
import { createBatch } from '@/lib/payouts/admin-actions'
import { BATCH_KINDS, BATCH_KIND_LABEL, PAYOUT_ERROR_MESSAGES, vnToday, type PayoutErrorCode } from '@/lib/payouts/validate'

type Result = { created: number; skippedNoBank: number; skippedBelowMin: number }

/** Tạo đợt chi: gom số dư khả dụng của CTV đến ngày chốt thành các khoản chi. */
export function BatchCreate() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setError(null)
    setResult(null)
    setBusy(true)
    try {
      const res = await createBatch(form)
      if ('error' in res) setError(PAYOUT_ERROR_MESSAGES[res.error as PayoutErrorCode])
      else {
        setResult(res)
        router.refresh()
      }
    } catch {
      setError('Không lưu được. Kiểm tra kết nối mạng rồi thử lại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card as="section" className="flex flex-col gap-4 p-5">
      <SectionHeader title="Tạo đợt chi" subtitle="Mỗi CTV đủ mức rút tối thiểu và đã khai ngân hàng được một khoản bằng số dư khả dụng." />
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
        <Field label="Loại đợt">
          <Select name="kind" defaultValue="monthly">
            {BATCH_KINDS.map((k) => <option key={k} value={k}>{BATCH_KIND_LABEL[k]}</option>)}
          </Select>
        </Field>
        <Field label="Ngày chốt">
          <Input type="date" name="cutoff" defaultValue={vnToday()} max={vnToday()} required />
        </Field>
        <Field label="Ghi chú">
          <Input name="note" maxLength={200} />
        </Field>
        <div className="sm:col-span-3">
          <Button type="submit" disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo đợt chi'}</Button>
        </div>
      </form>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 font-semibold text-red-800">{error}</p>}
      {result && (
        <p role="status" className="rounded-xl bg-primary-soft p-3 text-primary-hover">
          Đã tạo {result.created} khoản chi. Bỏ qua {result.skippedNoBank} CTV thiếu ngân hàng, {result.skippedBelowMin} CTV dưới mức tối thiểu.
        </p>
      )}
    </Card>
  )
}
