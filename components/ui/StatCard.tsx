import type { ReactNode } from 'react'
import { Card } from './Card'

export function StatCard({ label, value, hint, icon, className = '' }: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <Card className={`flex items-start justify-between gap-3 p-4 ${className}`.trim()}>
      <div className="min-w-0">
        <p className="text-sm text-stone-600">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{value}</p>
        {hint && <p className="mt-0.5 text-sm text-stone-600">{hint}</p>}
      </div>
      {icon && (
        <div aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          {icon}
        </div>
      )}
    </Card>
  )
}
