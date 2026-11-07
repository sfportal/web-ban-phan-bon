'use client'

import { useState } from 'react'

const btn =
  'flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 text-xl font-semibold disabled:opacity-40'

export function QtyStepper({
  value,
  onChange,
  min = 1,
  label = 'Số lượng',
}: {
  value: number
  onChange: (qty: number) => void
  min?: number
  label?: string
}) {
  // Bản nháp khi đang gõ (cho phép xóa trống để nhập số mới); null = hiển thị `value`.
  const [draft, setDraft] = useState<string | null>(null)
  const step = (n: number) => {
    setDraft(null)
    onChange(n)
  }
  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label={label}>
      <button type="button" className={btn} aria-label="Giảm" disabled={value <= min} onClick={() => step(value - 1)}>
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft ?? String(value)}
        aria-label={label}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, '')
          setDraft(raw)
          const n = Number(raw)
          if (raw !== '' && Number.isInteger(n) && n >= min) onChange(n)
        }}
        onBlur={() => setDraft(null)}
        className="h-11 w-16 rounded-lg border border-gray-300 text-center text-base"
      />
      <button type="button" className={btn} aria-label="Tăng" onClick={() => step(value + 1)}>
        +
      </button>
    </div>
  )
}
