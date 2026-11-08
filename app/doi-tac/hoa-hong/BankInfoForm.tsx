'use client'

import { Landmark } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button, Card, Field, Input } from '@/components/ui'
import { saveBankInfo } from '@/lib/payouts/partner-actions'
import { PAYOUT_ERROR_MESSAGES } from '@/lib/payouts/validate'

export type BankValue = { bankName: string; bankAccount: string; bankHolder: string }

/** Ngân hàng nhận tiền. Chưa khai → hiện sẵn form; đã khai → tóm tắt kèm nút "Sửa". */
export function BankInfoForm({ initial }: { initial: BankValue | null }) {
  const router = useRouter()
  const [editing, setEditing] = useState(!initial)
  const [error, setError] = useState<{ field: 'account' | 'other'; message: string } | null>(null)
  const [pending, start] = useTransition()

  function submit(form: FormData) {
    setError(null)
    start(async () => {
      try {
        const res = await saveBankInfo(form)
        if ('error' in res) {
          setError({ field: res.error === 'invalid_account' ? 'account' : 'other', message: PAYOUT_ERROR_MESSAGES[res.error] })
          return
        }
        setEditing(false)
        router.refresh()
      } catch {
        setError({ field: 'other', message: 'Không lưu được thông tin ngân hàng. Thử lại sau.' })
      }
    })
  }

  if (!editing && initial) {
    return (
      <Card className="flex items-center gap-3 p-4">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Landmark className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words font-semibold text-ink">{initial.bankName} · {initial.bankAccount}</p>
          <p className="truncate text-sm text-stone-600">{initial.bankHolder}</p>
        </div>
        <Button variant="ghost" onClick={() => setEditing(true)}>Sửa</Button>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <form action={submit} className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-ink">Thông tin ngân hàng nhận tiền</h2>
        {!initial && <p className="text-sm text-stone-600">Khai ngân hàng trước khi rút tiền.</p>}
        <Field label="Ngân hàng">
          <Input name="bank_name" defaultValue={initial?.bankName} maxLength={120} autoComplete="off" required />
        </Field>
        <Field label="Số tài khoản" error={error?.field === 'account' ? error.message : null}>
          <Input name="bank_account" defaultValue={initial?.bankAccount} inputMode="numeric" autoComplete="off" required />
        </Field>
        <Field label="Chủ tài khoản" error={error?.field === 'other' ? error.message : null}>
          <Input name="bank_holder" defaultValue={initial?.bankHolder} maxLength={120} autoComplete="off" required />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending} className="flex-1">Lưu thông tin ngân hàng</Button>
          {initial && <Button variant="secondary" onClick={() => { setEditing(false); setError(null) }}>Hủy</Button>}
        </div>
      </form>
    </Card>
  )
}
