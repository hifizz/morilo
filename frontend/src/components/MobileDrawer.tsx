import type { ReactNode } from 'react'
import { Drawer } from '@/design-system'

interface MobileDrawerProps {
  side: 'left' | 'right'
  label: string
  children: ReactNode
  onClose: () => void
}

export function MobileDrawer({ side, label, children, onClose }: MobileDrawerProps) {
  return (
    <Drawer open side={side} label={label} onOpenChange={(open) => { if (!open) onClose() }}>
      {children}
    </Drawer>
  )
}
