'use client'

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
  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label={label}>
      <button type="button" className={btn} aria-label="Giảm" disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        value={value}
        aria-label={label}
        onChange={(e) => {
          const n = Math.floor(Number(e.target.value))
          if (Number.isFinite(n) && n >= min) onChange(n)
        }}
        className="h-11 w-16 rounded-lg border border-gray-300 text-center text-base"
      />
      <button type="button" className={btn} aria-label="Tăng" onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  )
}
