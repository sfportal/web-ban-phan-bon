import type { ReactNode } from 'react'

export function SectionHeader({ title, subtitle, action, className = '' }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-end justify-between gap-3 ${className}`.trim()}>
      <div className="min-w-0">
        <h2 className="text-xl font-bold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-stone-600">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
