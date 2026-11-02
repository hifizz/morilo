import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useDismissOnEscape } from '../useDismissOnEscape'

interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  side: 'left' | 'right'
  label: string
  children: ReactNode
}

export function Drawer({ open, onOpenChange, side, label, children }: DrawerProps) {
  useDismissOnEscape(open, onOpenChange)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <div className={cn('drawer-layer', `drawer-layer--${side}`)}>
          <DialogPrimitive.Overlay className="drawer-backdrop" />
          <DialogPrimitive.Content className="mobile-drawer" aria-label={label} aria-describedby={undefined}>
            <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
            {children}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
