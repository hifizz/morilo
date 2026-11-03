import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { IconButton } from './IconButton'
import { useDismissOnEscape } from '../useDismissOnEscape'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  className?: string
  hideHeader?: boolean
  hideCloseButton?: boolean
  closeLabel?: string
}

export function Dialog({ open, onOpenChange, title, description, children, className, hideHeader = false, hideCloseButton = false, closeLabel = '关闭' }: DialogProps) {
  useDismissOnEscape(open, onOpenChange)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ds-dialog-overlay" />
        <DialogPrimitive.Content className={cn('ds-dialog', className)} aria-describedby={description ? undefined : undefined}>
          {hideHeader ? (
            <>
              <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
              {description && <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>}
              {!hideCloseButton && <DialogPrimitive.Close asChild><IconButton label={closeLabel} className="ds-dialog__floating-close"><X size={19} /></IconButton></DialogPrimitive.Close>}
            </>
          ) : (
            <header className="ds-dialog__header">
              <div>
                <DialogPrimitive.Title className="ds-dialog__title">{title}</DialogPrimitive.Title>
                {description && <DialogPrimitive.Description className="ds-dialog__description">{description}</DialogPrimitive.Description>}
              </div>
              {!hideCloseButton && <DialogPrimitive.Close asChild><IconButton label={closeLabel}><X size={19} /></IconButton></DialogPrimitive.Close>}
            </header>
          )}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
