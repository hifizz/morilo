import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Copy, MoreHorizontal, Smile, SmilePlus, Undo2 } from 'lucide-react'
import { IconButton, Menu } from '@/design-system'
import type { ChatMessage } from '@/types/chat'
import { useSettings } from '@/settings/SettingsProvider'

const quickReactions = [
  { emoji: '👍', label: '赞同', en: 'Agree' },
  { emoji: '👎', label: '不赞同', en: 'Disagree' },
  { emoji: '❤️', label: '喜欢', en: 'Love' },
  { emoji: '😂', label: '好笑', en: 'Funny' },
  { emoji: '🎉', label: '庆祝', en: 'Celebrate' },
]

const moreReactions = [
  { emoji: '🔥', label: '很棒', en: 'Great' },
  { emoji: '😮', label: '惊讶', en: 'Surprised' },
  { emoji: '😢', label: '难过', en: 'Sad' },
  { emoji: '🙏', label: '感谢', en: 'Thanks' },
  { emoji: '👀', label: '关注', en: 'Watching' },
]

interface MessageToolbarProps {
  message: ChatMessage
  reaction: string | null
  onReaction: (reaction: string | null) => void
  onReply: (message: ChatMessage) => void
  onNotify: (message: string) => void
}

export function MessageToolbar({ message, reaction, onReaction, onReply, onNotify }: MessageToolbarProps) {
  const { t } = useSettings()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const requestId = `req_${message.id}`

  const copy = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value)
      onNotify(successMessage)
    } catch {
      onNotify(t('浏览器未允许剪贴板访问', 'Clipboard access was not allowed by the browser'))
    }
  }

  const selectReaction = (emoji: string) => {
    const nextReaction = reaction === emoji ? null : emoji
    onReaction(nextReaction)
    setPickerOpen(false)
    setExpanded(false)
    onNotify(nextReaction ? t(`已添加 ${emoji} 回应`, `Added ${emoji} reaction`) : t('已取消表情回应', 'Reaction removed'))
  }

  return (
    <div className={`message-toolbar ${reaction ? 'has-reaction' : ''}`} aria-label={t('消息操作', 'Message actions')}>
      <Popover.Root open={pickerOpen} onOpenChange={setPickerOpen}>
        <Popover.Trigger asChild>
          <IconButton
            label={t('添加表情回应', 'Add reaction')}
            tooltip={false}
            title={t('添加表情回应', 'Add reaction')}
            className={`message-toolbar__button message-toolbar__reaction ${reaction ? 'is-selected' : ''}`}
          >
            {reaction ? <span aria-label={t(`当前回应 ${reaction}`, `Current reaction ${reaction}`)}>{reaction}</span> : <Smile size={17} />}
          </IconButton>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="message-reaction-picker" side="top" align="start" sideOffset={7} collisionPadding={12} aria-label={t('选择表情回应', 'Choose a reaction')}>
            {quickReactions.map((item) => (
              <button key={item.emoji} type="button" className={reaction === item.emoji ? 'is-selected' : ''} aria-label={t(item.label, item.en)} aria-pressed={reaction === item.emoji} onClick={() => selectReaction(item.emoji)}>
                <span aria-hidden="true">{item.emoji}</span>
              </button>
            ))}
            <button type="button" className="message-reaction-picker__more" aria-label={t('更多表情', 'More reactions')} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
              <SmilePlus size={19} />
            </button>
            {expanded && (
              <div className="message-reaction-picker__expanded">
                {moreReactions.map((item) => (
                  <button key={item.emoji} type="button" className={reaction === item.emoji ? 'is-selected' : ''} aria-label={t(item.label, item.en)} aria-pressed={reaction === item.emoji} onClick={() => selectReaction(item.emoji)}>
                    <span aria-hidden="true">{item.emoji}</span>
                  </button>
                ))}
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <IconButton label={t('回复并引用消息', 'Reply and quote message')} tooltip={false} title={t('回复并引用消息', 'Reply and quote message')} className="message-toolbar__button" onClick={() => onReply(message)}>
        <Undo2 size={17} />
      </IconButton>

      <Menu
        label={t('消息更多操作', 'More message actions')}
        align="start"
        trigger={<IconButton label={t('更多消息操作', 'More message actions')} tooltip={false} title={t('更多消息操作', 'More message actions')} className="message-toolbar__button"><MoreHorizontal size={18} /></IconButton>}
        items={[
          { id: 'copy', label: t('复制', 'Copy'), icon: <Copy size={15} />, onSelect: () => void copy(message.text, t('消息已复制', 'Message copied')) },
          { id: 'copy-request', label: t('复制请求 ID', 'Copy request ID'), icon: <Copy size={15} />, onSelect: () => void copy(requestId, t(`已复制请求 ID：${requestId}`, `Copied request ID: ${requestId}`)) },
        ]}
      />
    </div>
  )
}
