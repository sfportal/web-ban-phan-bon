import { Sprout } from 'lucide-react'
import type { ReactNode } from 'react'

/** Màn trống: nói rõ đang trống gì và việc cần làm tiếp. */
export function EmptyState({ icon, title, description, action, className = '' }: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center gap-3 px-4 py-10 text-center ${className}`.trim()}>
      <div aria-hidden className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
        {icon ?? <Sprout className="size-7" />}
      </div>
      <p className="text-lg font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-stone-600">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
