import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className, type = 'button', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('ds-button', `ds-button--${variant}`, `ds-button--${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle className="ds-button__spinner" size={15} aria-hidden="true" />}
      {children}
    </button>
  )
})
