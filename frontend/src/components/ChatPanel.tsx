import { useEffect, useRef, useState } from 'react'
import { Download, Menu as MenuIcon, MoreHorizontal, PanelRightOpen, Trash2 } from 'lucide-react'
import type { Agent, ChatMessage, Conversation } from '@/types/chat'
import { AgentAvatar } from './AgentAvatar'
import { Composer } from './Composer'
import { IconButton, Menu } from '@/design-system'
import { MessageBubble } from './MessageBubble'
import { useSettings } from '@/settings/SettingsProvider'

interface ChatPanelProps {
  agent: Agent
  conversation: Conversation
  typing: boolean
  progress?: string
  onOpenSidebar: () => void
  inspectorVisible: boolean
  onToggleInspector: () => void
  onSend: (text: string, attachment?: string, quote?: string) => void
  onClear: () => void
  onNotify: (message: string) => void
}

export function ChatPanel({ agent, conversation, typing, progress, onOpenSidebar, inspectorVisible, onToggleInspector, onSend, onClear, onNotify }: ChatPanelProps) {
  const { profile, t } = useSettings()
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const visibleMessages = conversation.messages.filter((message) => message.sender !== 'event' || !message.taskTitle)

  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
  }, [conversation.id, conversation.messages.length, typing])

  const exportChat = () => {
    const content = visibleMessages.map((message) => `${message.sender === 'user' ? (profile?.name ?? t('你', 'You')) : message.sender === 'agent' ? agent.name : t('系统', 'System')}\n${message.text}`).join('\n\n')
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${conversation.title}-${t('聊天记录', 'chat-history')}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
    onNotify(t('聊天记录已导出', 'Chat history exported'))
  }

  const send = (text: string, attachment?: string) => {
    onSend(text, attachment, replyTo ? replyTo.text.replace(/\s+/g, ' ') : undefined)
    setReplyTo(null)
  }

  return (
    <main className="chat-panel">
      <header className="chat-header">
        <IconButton label={t('打开会话列表', 'Open conversations')} className="mobile-menu-button" onClick={onOpenSidebar}><MenuIcon size={20} /></IconButton>
        <button
          type="button"
          className="chat-agent-pill"
          onClick={onToggleInspector}
          aria-label={inspectorVisible ? t(`收起 ${agent.name} 详情`, `Hide ${agent.name} details`) : t(`查看 ${agent.name} 详情`, `View ${agent.name} details`)}
          aria-expanded={inspectorVisible}
          aria-controls="agent-inspector"
        >
          <AgentAvatar color={agent.color} variant={agent.variant} size={25} />
          <span>{agent.name}</span>
        </button>
        <div className="chat-header__actions">
          <div className="header-menu-wrap">
            <Menu
              label={t('会话操作', 'Conversation actions')}
              trigger={<IconButton label={t('更多会话操作', 'More conversation actions')}><MoreHorizontal size={19} /></IconButton>}
              items={[
                { id: 'export', label: t('导出聊天记录', 'Export chat history'), icon: <Download size={15} />, onSelect: exportChat },
                { id: 'clear', label: t('清空当前会话', 'Clear current conversation'), icon: <Trash2 size={15} />, danger: true, onSelect: onClear },
              ]}
            />
          </div>
          <IconButton label={t('打开详情面板', 'Open details panel')} className="mobile-inspector-button" onClick={onToggleInspector}><PanelRightOpen size={19} strokeWidth={1.7} /></IconButton>
        </div>
      </header>

      <div className="message-scroll" ref={scrollRef}>
        <div className="message-list">
          {visibleMessages.length === 0 ? (
            <div className="empty-chat">
              <AgentAvatar color={agent.color} variant={agent.variant} size={68} />
              <h1>{t(`和 ${agent.name} 开始新对话`, `Start a conversation with ${agent.name}`)}</h1>
              <p>{agent.description}</p>
            </div>
          ) : visibleMessages.map((message) => <MessageBubble key={message.id} message={message} onReply={setReplyTo} onNotify={onNotify} />)}
        </div>
      </div>

      <div className="composer-wrap">
        {typing && (
          <div className="agent-status" role="status" aria-label={`${agent.name} ${t('正在处理任务', 'is working')}`}>
            <AgentAvatar color={agent.color} variant={agent.variant} size={26} />
            <div className="agent-status__text">{progress || t('正在思考…', 'Thinking…')}</div>
          </div>
        )}
        <Composer
          key={conversation.id}
          agentName={agent.name}
          replyTo={replyTo}
          disabled={typing}
          onCancelReply={() => setReplyTo(null)}
          onSend={send}
          onNotify={onNotify}
        />
      </div>
    </main>
  )
}
