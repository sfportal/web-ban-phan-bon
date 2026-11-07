import type { ReactNode } from 'react'

type CardTag = 'div' | 'section' | 'article' | 'li' | 'aside'

/** Khối nền trắng trên nền kem, viền mảnh. */
export function Card({ className = '', children, as: Tag = 'div' }: { className?: string; children?: ReactNode; as?: CardTag }) {
  return <Tag className={`rounded-2xl border border-stone-200 bg-white ${className}`.trim()}>{children}</Tag>
}
