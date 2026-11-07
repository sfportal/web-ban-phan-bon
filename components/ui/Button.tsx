import Link from 'next/link'
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'md' | 'lg'

const BASE =
  'inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-colors ' +
  'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'border border-primary/25 bg-white text-primary hover:bg-primary-soft',
  ghost: 'text-primary hover:bg-primary-soft',
  danger: 'bg-red-700 text-white hover:bg-red-800',
}

// md 44px, lg 52px: đủ vùng chạm trên điện thoại.
const SIZES: Record<ButtonSize, string> = {
  md: 'h-11 px-5 text-base',
  lg: 'h-[52px] px-6 text-lg',
}

export function buttonClass({ variant = 'primary', size = 'md', className = '' }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`.trim()
}

type Common = { variant?: ButtonVariant; size?: ButtonSize; className?: string; children?: ReactNode; asChild?: never }
type LinkButtonProps = Common & {
  href: string
  /** Liên kết bị khóa: span role="link" aria-disabled, không href, không nhận focus. */
  disabled?: boolean
} & Omit<ComponentProps<typeof Link>, 'href' | 'className' | 'children'>
type NativeButtonProps = Common & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>

/** Nút chuẩn; có `href` thì là liên kết (next/link) mang dáng nút, kèm `disabled` thì thành span mờ. */
export function Button(props: LinkButtonProps | NativeButtonProps) {
  if (props.href !== undefined) {
    const { variant, size, className, children, href, disabled, ...rest } = props
    if (disabled) {
      return (
        <span role="link" aria-disabled="true" className={buttonClass({ variant, size, className })}>
          {children}
        </span>
      )
    }
    return (
      <Link href={href} className={buttonClass({ variant, size, className })} {...rest}>
        {children}
      </Link>
    )
  }
  const { variant, size, className, children, type = 'button', ...rest } = props as NativeButtonProps
  return (
    <button type={type} className={buttonClass({ variant, size, className })} {...rest}>
      {children}
    </button>
  )
}
