import { formatVnd } from '@/lib/format'

export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={className}>{formatVnd(value)}</span>
}
