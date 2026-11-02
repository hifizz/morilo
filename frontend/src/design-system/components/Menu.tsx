import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { ReactElement, ReactNode } from 'react'

export interface MenuItem {
  id: string
  label: string
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}

interface MenuProps {
  trigger: ReactElement
  label: string
  items: MenuItem[]
  align?: 'start' | 'center' | 'end'
}

export function Menu({ trigger, label, items, align = 'end' }: MenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="ds-menu" align={align} sideOffset={6} aria-label={label}>
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.id}
              className="ds-menu__item"
              data-danger={item.danger || undefined}
              disabled={item.disabled}
              onSelect={item.onSelect}
            >
              {item.icon}{item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
