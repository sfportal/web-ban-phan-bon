import { Check } from 'lucide-react'

export type FlowStep = 'farmer' | 'products' | 'confirm'

const LABEL: Record<FlowStep, string> = { farmer: 'Nông dân', products: 'Sản phẩm', confirm: 'Xác nhận' }

/** Thanh bước lên đơn: CTV 3 bước (Nông dân → Sản phẩm → Xác nhận), đại lý 2 bước. Chỉ hiển thị. */
export function StepBar({ current, withFarmer }: { current: FlowStep; withFarmer: boolean }) {
  const steps: FlowStep[] = withFarmer ? ['farmer', 'products', 'confirm'] : ['products', 'confirm']
  const at = steps.indexOf(current)
  return (
    <ol aria-label="Các bước lên đơn" className="flex items-center">
      {steps.map((s, i) => {
        const done = i < at
        const active = i === at
        return (
          <li key={s} aria-current={active ? 'step' : undefined} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
            <span className="flex items-center gap-1.5 sm:gap-2">
              <span
                aria-hidden
                className={`flex size-7 shrink-0 sm:size-8 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
                  done
                    ? 'bg-primary text-white'
                    : active
                      ? 'bg-primary text-white ring-4 ring-primary-soft'
                      : 'border-2 border-stone-300 bg-white text-stone-500'
                }`}
              >
                {done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className={`whitespace-nowrap text-sm font-semibold sm:text-base ${active ? 'text-ink' : done ? 'text-primary' : 'text-stone-500'}`}>
                {LABEL[s]}
                {done && <span className="sr-only"> (xong)</span>}
              </span>
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden className={`mx-1.5 h-0.5 min-w-3 sm:mx-3 flex-1 rounded-full ${done ? 'bg-primary' : 'bg-stone-300'}`} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
