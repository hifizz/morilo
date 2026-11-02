import { useState } from 'react'
import type { ChatMessage } from '@/types/chat'
import { MessageToolbar } from './MessageToolbar'

interface MessageBubbleProps {
  message: ChatMessage
  onReply: (message: ChatMessage) => void
  onNotify: (message: string) => void
}

export function MessageBubble({ message, onReply, onNotify }: MessageBubbleProps) {
  const [reaction, setReaction] = useState<string | null>(null)

  if (message.sender === 'event') {
    if (message.taskTitle) {
      return <div className="task-event"><span className="task-event__icon">G</span><span>{message.taskTitle}</span></div>
    }
    return <div className="message-time">{message.text}</div>
  }

  return (
    <article className={`message-row message-row--${message.sender}`}>
      <div className={`message-bubble message-bubble--${message.sender}`}>
        {message.quote && <div className="message-quote">{message.quote}</div>}
        <div className="message-text">{message.text}</div>
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
