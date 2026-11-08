'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button, Card, Field, Input } from '@/components/ui'
import { formatVnd } from '@/lib/format'
import { requestPayout } from '@/lib/payouts/partner-actions'
import { PAYOUT_ERROR_MESSAGES } from '@/lib/payouts/validate'

/** Nút "Rút tiền" mở form: số tiền, "Rút hết", gợi ý mức tối thiểu. */
export function WithdrawForm({ available, min }: { available: number; min: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await requestPayout({ amount })
      if ('error' in res) {
        setError(PAYOUT_ERROR_MESSAGES[res.error])
        return
      }
      setOpen(false)
      setAmount('')
      router.refresh()
    })
  }

  if (!open) {
    return <Button size="lg" onClick={() => setOpen(true)}>Rút tiền</Button>
  }

  return (
    <Card className="p-4">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-ink">Rút tiền hoa hồng</h2>
        <Field label="Số tiền muốn rút" error={error} hint={`Tối thiểu ${formatVnd(min)}. Khả dụng: ${formatVnd(Math.max(0, available))}.`}>
          <Input
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ví dụ 500000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </Field>
        <Button variant="ghost" className="self-start" onClick={() => setAmount(String(Math.max(0, available)))}>Rút hết</Button>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending} className="flex-1">Gửi yêu cầu rút</Button>
          <Button variant="secondary" onClick={() => { setOpen(false); setError(null) }}>Hủy</Button>
        </div>
      </form>
    </Card>
  )
}
