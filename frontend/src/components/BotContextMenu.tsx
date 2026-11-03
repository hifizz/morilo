import { BellDot, Copy, EyeOff, Pin, PinOff, SquarePen, SquarePlus, Trash2 } from 'lucide-react'
import type { ReactElement } from 'react'
import { ContextMenu, type ContextMenuGroup } from '@/design-system'
import type { Conversation } from '@/types/chat'
import { useSettings } from '@/settings/SettingsProvider'

export type BotContextAction = 'pin' | 'move' | 'unread' | 'rename' | 'copy' | 'hide' | 'delete'

interface BotContextMenuProps {
  conversation: Pick<Conversation, 'title' | 'pinned' | 'unread'>
  children: ReactElement
  onAction: (action: BotContextAction) => void
}

export function BotContextMenu({ conversation, children, onAction }: BotContextMenuProps) {
  const { t } = useSettings()
  const groups: ContextMenuGroup[] = [
    {
      id: 'organization',
      items: [
        { id: 'pin', label: conversation.pinned ? t('取消置顶', 'Unpin') : t('置顶', 'Pin'), icon: conversation.pinned ? <PinOff size={17} /> : <Pin size={17} />, onSelect: () => onAction('pin') },
        { id: 'move', label: t('移动到新分区', 'Move to new section'), icon: <SquarePlus size={17} />, onSelect: () => onAction('move') },
        { id: 'unread', label: conversation.unread ? t('标记为已读', 'Mark as Read') : t('标记为未读', 'Mark as Unread'), icon: <BellDot size={17} />, onSelect: () => onAction('unread') },
      ],
    },
    {
      id: 'conversation',
      items: [
        { id: 'rename', label: t('重命名 Bot', 'Rename Bot'), icon: <SquarePen size={17} />, onSelect: () => onAction('rename') },
        { id: 'copy', label: t('复制会话 ID', 'Copy conversation ID'), icon: <Copy size={17} />, onSelect: () => onAction('copy') },
      ],
    },
    {
      id: 'visibility',
      items: [
        { id: 'hide', label: t('从侧栏隐藏', 'Hide from sidebar'), icon: <EyeOff size={17} />, onSelect: () => onAction('hide') },
        { id: 'delete', label: t('删除', 'Delete'), icon: <Trash2 size={17} />, danger: true, onSelect: () => onAction('delete') },
      ],
    },
  ]

  return <ContextMenu trigger={children} label={t(`${conversation.title} 的 Bot 操作`, `Bot actions for ${conversation.title}`)} groups={groups} className="bot-context-menu" />
}
