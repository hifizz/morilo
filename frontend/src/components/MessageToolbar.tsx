import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Copy, MoreHorizontal, Smile, SmilePlus, Undo2 } from 'lucide-react'
import { IconButton, Menu } from '@/design-system'
import type { ChatMessage } from '@/types/chat'

const quickReactions = [
  { emoji: '👍', label: '赞同' },
  { emoji: '👎', label: '不赞同' },
  { emoji: '❤️', label: '喜欢' },
  { emoji: '😂', label: '好笑' },
  { emoji: '🎉', label: '庆祝' },
]

const moreReactions = [
  { emoji: '🔥', label: '很棒' },
  { emoji: '😮', label: '惊讶' },
  { emoji: '😢', label: '难过' },
  { emoji: '🙏', label: '感谢' },
  { emoji: '👀', label: '关注' },
]

interface MessageToolbarProps {
  message: ChatMessage
  reaction: string | null
  onReaction: (reaction: string | null) => void
  onReply: (message: ChatMessage) => void
  onNotify: (message: string) => void
}

export function MessageToolbar({ message, reaction, onReaction, onReply, onNotify }: MessageToolbarProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const requestId = `req_${message.id}`

  const copy = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value)
      onNotify(successMessage)
    } catch {
      onNotify('浏览器未允许剪贴板访问')
    }
  }

  const selectReaction = (emoji: string) => {
    const nextReaction = reaction === emoji ? null : emoji
    onReaction(nextReaction)
    setPickerOpen(false)
    setExpanded(false)
    onNotify(nextReaction ? `已添加 ${emoji} 回应` : '已取消表情回应')
  }

  return (
    <div className={`message-toolbar ${reaction ? 'has-reaction' : ''}`} aria-label="消息操作">
      <Popover.Root open={pickerOpen} onOpenChange={setPickerOpen}>
        <Popover.Trigger asChild>
          <IconButton
            label="添加表情回应"
            tooltip={false}
            title="添加表情回应"
            className={`message-toolbar__button message-toolbar__reaction ${reaction ? 'is-selected' : ''}`}
          >
            {reaction ? <span aria-label={`当前回应 ${reaction}`}>{reaction}</span> : <Smile size={17} />}
          </IconButton>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="message-reaction-picker" side="top" align="start" sideOffset={7} collisionPadding={12} aria-label="选择表情回应">
            {quickReactions.map((item) => (
              <button key={item.emoji} type="button" className={reaction === item.emoji ? 'is-selected' : ''} aria-label={item.label} aria-pressed={reaction === item.emoji} onClick={() => selectReaction(item.emoji)}>
                <span aria-hidden="true">{item.emoji}</span>
              </button>
            ))}
            <button type="button" className="message-reaction-picker__more" aria-label="更多表情" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
              <SmilePlus size={19} />
            </button>
            {expanded && (
              <div className="message-reaction-picker__expanded">
                {moreReactions.map((item) => (
                  <button key={item.emoji} type="button" className={reaction === item.emoji ? 'is-selected' : ''} aria-label={item.label} aria-pressed={reaction === item.emoji} onClick={() => selectReaction(item.emoji)}>
                    <span aria-hidden="true">{item.emoji}</span>
                  </button>
                ))}
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <IconButton label="回复并引用消息" tooltip={false} title="回复并引用消息" className="message-toolbar__button" onClick={() => onReply(message)}>
        <Undo2 size={17} />
      </IconButton>

      <Menu
        label="消息更多操作"
        align="start"
        trigger={<IconButton label="更多消息操作" tooltip={false} title="更多消息操作" className="message-toolbar__button"><MoreHorizontal size={18} /></IconButton>}
        items={[
          { id: 'copy', label: 'Copy', icon: <Copy size={15} />, onSelect: () => void copy(message.text, '消息已复制') },
          { id: 'copy-request', label: 'Copy request ID', icon: <Copy size={15} />, onSelect: () => void copy(requestId, `已复制请求 ID：${requestId}`) },
        ]}
      />
    </div>
  )
}
