import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
  active?: boolean
  tooltip?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, active = false, tooltip = true, className, type = 'button', ...props },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      className={cn('icon-button', active && 'is-active', className)}
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  )

  if (!tooltip) return button
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{button}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content className="ds-tooltip" sideOffset={6} collisionPadding={8}>
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
})
