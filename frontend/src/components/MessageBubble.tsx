import { useState } from 'react'
import type { ChatMessage } from '@/types/chat'
import { MessageToolbar } from './MessageToolbar'
import { MarkdownText } from './MarkdownText'
import { useSettings } from '@/settings/SettingsProvider'

interface MessageBubbleProps {
  message: ChatMessage
  onReply: (message: ChatMessage) => void
  onNotify: (message: string) => void
}

export function MessageBubble({ message, onReply, onNotify }: MessageBubbleProps) {
  const [reaction, setReaction] = useState<string | null>(null)
  const { locale, snapshot } = useSettings()
  const timeLabel = message.createdAt
    ? new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: snapshot?.preferences.timezone === 'auto' ? undefined : snapshot?.preferences.timezone }).format(new Date(message.createdAt))
    : undefined

  if (message.sender === 'event') {
    if (message.taskTitle) {
      return <div className="task-event"><span className="task-event__icon">G</span><span>{message.taskTitle}</span></div>
    }
    return <div className="message-time">{message.text}</div>
  }

  return (
    <article className={`message-row message-row--${message.sender}`} title={timeLabel}>
      <div className={`message-bubble message-bubble--${message.sender}`}>
        {message.quote && <div className="message-quote">{message.quote}</div>}
        <div className={message.sender === 'agent' ? 'message-text message-text--markdown' : 'message-text'}>
          {message.sender === 'agent' ? <MarkdownText text={message.text} /> : message.text}
        </div>
        {message.code && <pre className="message-code"><code>{message.code}</code></pre>}
      </div>
      {message.sender === 'agent' && (
        <MessageToolbar
          message={message}
          reaction={reaction}
          onReaction={setReaction}
          onReply={onReply}
          onNotify={onNotify}
        />
      )}
    </article>
  )
}
