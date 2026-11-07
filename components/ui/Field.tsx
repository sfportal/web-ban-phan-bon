import { cloneElement, isValidElement, useId, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const CONTROL =
  'w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-ink placeholder:text-stone-400 ' +
  'aria-invalid:border-red-600 disabled:bg-stone-100'

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`h-11 ${CONTROL} ${className}`.trim()} {...props} />
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`h-11 ${CONTROL} ${className}`.trim()} {...props} />
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`py-2.5 ${CONTROL} ${className}`.trim()} {...props} />
}

type ControlProps = { id?: string; 'aria-invalid'?: boolean | 'true' | 'false'; 'aria-describedby'?: string }

/**
 * Nhãn + ô nhập + gợi ý/lỗi. Ô nhập (phần tử con duy nhất) được gắn id, aria-invalid và
 * aria-describedby trỏ tới gợi ý và lỗi.
 */
export function Field({ label, error, hint, children, className = '' }: {
  label: ReactNode
  error?: string | null
  hint?: ReactNode
  children: ReactElement<ControlProps>
  className?: string
}) {
  const autoId = useId()
  const control = isValidElement(children) ? children : null
  const id = control?.props.id ?? `${autoId}-control`
  const hintId = hint ? `${autoId}-hint` : null
  const errorId = error ? `${autoId}-error` : null
  const describedBy = [control?.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={`flex flex-col gap-1.5 ${className}`.trim()}>
      <label htmlFor={id} className="font-semibold text-ink">{label}</label>
      {control &&
        cloneElement(control, {
          id,
          'aria-describedby': describedBy,
          ...(error ? { 'aria-invalid': true } : {}),
        })}
      {hint && <p id={hintId!} className="text-sm text-stone-600">{hint}</p>}
      {error && <p id={errorId!} role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
    </div>
  )
}
