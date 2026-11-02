import { BellDot, Copy, EyeOff, Pin, PinOff, SquarePen, SquarePlus, Trash2 } from 'lucide-react'
import type { ReactElement } from 'react'
import { ContextMenu, type ContextMenuGroup } from '@/design-system'
import type { Conversation } from '@/types/chat'

export type BotContextAction = 'pin' | 'move' | 'unread' | 'rename' | 'copy' | 'hide' | 'delete'

interface BotContextMenuProps {
  conversation: Pick<Conversation, 'title' | 'pinned' | 'unread'>
  children: ReactElement
  onAction: (action: BotContextAction) => void
}

export function BotContextMenu({ conversation, children, onAction }: BotContextMenuProps) {
  const groups: ContextMenuGroup[] = [
    {
      id: 'organization',
      items: [
        { id: 'pin', label: conversation.pinned ? 'Unpin' : 'Pin', icon: conversation.pinned ? <PinOff size={17} /> : <Pin size={17} />, onSelect: () => onAction('pin') },
        { id: 'move', label: 'Move to new section', icon: <SquarePlus size={17} />, onSelect: () => onAction('move') },
        { id: 'unread', label: conversation.unread ? 'Mark as Read' : 'Mark as Unread', icon: <BellDot size={17} />, onSelect: () => onAction('unread') },
      ],
    },
    {
      id: 'conversation',
      items: [
        { id: 'rename', label: 'Rename Bot', icon: <SquarePen size={17} />, onSelect: () => onAction('rename') },
        { id: 'copy', label: 'Copy conversation ID', icon: <Copy size={17} />, onSelect: () => onAction('copy') },
      ],
    },
    {
      id: 'visibility',
      items: [
        { id: 'hide', label: 'Hide from sidebar', icon: <EyeOff size={17} />, onSelect: () => onAction('hide') },
        { id: 'delete', label: 'Delete', icon: <Trash2 size={17} />, danger: true, onSelect: () => onAction('delete') },
      ],
    },
  ]

  return <ContextMenu trigger={children} label={`${conversation.title} 的 Bot 操作`} groups={groups} className="bot-context-menu" />
}
