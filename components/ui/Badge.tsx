import type { ReactNode } from 'react'

export type BadgeTone = 'green' | 'yellow' | 'red' | 'gray' | 'blue'

const TONES: Record<BadgeTone, string> = {
  green: 'bg-primary-soft text-primary-hover',
  yellow: 'bg-accent-soft text-yellow-900',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-stone-100 text-stone-700',
  blue: 'bg-sky-100 text-sky-900',
}

export function Badge({ tone = 'gray', children, className = '' }: { tone?: BadgeTone; children?: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ${TONES[tone]} ${className}`.trim()}>
      {children}
    </span>
  )
}
