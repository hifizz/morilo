import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import { Fragment, type ReactElement } from 'react'
import type { MenuItem } from './Menu'

export interface ContextMenuGroup {
  id: string
  items: MenuItem[]
}

interface ContextMenuProps {
  trigger: ReactElement
  label: string
  groups: ContextMenuGroup[]
  className?: string
}

export function ContextMenu({ trigger, label, groups, className = '' }: ContextMenuProps) {
  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>{trigger}</ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content className={`ds-menu ds-context-menu ${className}`} aria-label={label} collisionPadding={12} avoidCollisions>
          {groups.map((group, groupIndex) => (
            <Fragment key={group.id}>
              {groupIndex > 0 && <ContextMenuPrimitive.Separator className="ds-menu__separator" />}
              {group.items.map((item) => (
                <ContextMenuPrimitive.Item
                  key={item.id}
                  className="ds-menu__item"
                  data-danger={item.danger || undefined}
                  disabled={item.disabled}
                  onSelect={item.onSelect}
                >
                  {item.icon}{item.label}
                </ContextMenuPrimitive.Item>
              ))}
            </Fragment>
          ))}
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  )
}
