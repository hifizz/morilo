import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Channel, isCallError, isMyGo } from 'mygo-runtime'
import { Chat, Store, type ChatEvent } from './mygo'
import './App.css'
import type { BotContextAction } from '@/components/BotContextMenu'
import { ChatPanel } from '@/components/ChatPanel'
import { ConversationSearchDialog } from '@/components/ConversationSearchDialog'
import { InspectorPanel } from '@/components/InspectorPanel'
import { MobileDrawer } from '@/components/MobileDrawer'
import { NewBotDialog, type NewBotInput } from '@/components/NewBotDialog'
import { RenameBotDialog } from '@/components/RenameBotDialog'
import { Sidebar } from '@/components/Sidebar'
import { agents, initialConversations, libraryFiles } from '@/data/demo'
import { IntegrationDialog } from '@/integrations/IntegrationDialog'
import { useIntegrationStore } from '@/integrations/useIntegrationStore'
import { ReferralDialog } from '@/settings/ReferralDialog'
import { SettingsDialog } from '@/settings/SettingsDialog'
import type { SettingsSection } from '@/settings/types'
import type { Agent, ChatMessage, Conversation } from '@/types/chat'

type MobilePanel = 'sidebar' | 'inspector' | null

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations)
  const [availableAgents, setAvailableAgents] = useState<Agent[]>(agents)
  const [activeId, setActiveId] = useState(() => {
    const hash = window.location.hash.slice(1)
    return initialConversations.some((item) => item.id === hash) ? hash : 'xresearcher'
  })
  const [collapsed, setCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [sidebarResizing, setSidebarResizing] = useState(false)
  const [inspectorVisible, setInspectorVisible] = useState(true)
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null)
  const [newBotOpen, setNewBotOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [integrationsOpen, setIntegrationsOpen] = useState(false)
  const [referralOpen, setReferralOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null)
  const integrationStore = useIntegrationStore()
  const [typingFor, setTypingFor] = useState<string | null>(null)
  const [thoughts, setThoughts] = useState<Record<string, string>>({})
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | undefined>(undefined)
  const replyTimer = useRef<number | undefined>(undefined)
  const stateLoaded = useRef(false)

  const activeConversation = conversations.find((item) => item.id === activeId) ?? conversations[0]
  const activeAgent = useMemo(() => availableAgents.find((agent) => agent.id === activeConversation.agentId) ?? availableAgents[0], [activeConversation, availableAgents])
  const renameConversation = conversations.find((item) => item.id === renameId)

  const notify = useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2200)
  }, [])

  useEffect(() => () => { window.clearTimeout(toastTimer.current); window.clearTimeout(replyTimer.current) }, [])

  // Restore persisted conversations and bots, then keep saving them.
  useEffect(() => {
    if (!isMyGo()) { stateLoaded.current = true; return }
    Store.load()
      .then((raw) => {
        if (!raw) return
        try {
          const state = JSON.parse(raw) as { conversations?: Conversation[]; agents?: Agent[] }
          if (state.conversations?.length) setConversations(state.conversations)
          if (state.agents?.length) setAvailableAgents(state.agents)
        } catch { /* corrupted state: keep the demo data */ }
      })
      .catch(() => {})
      .finally(() => { stateLoaded.current = true })
  }, [])

  useEffect(() => {
    if (!stateLoaded.current || !isMyGo()) return
    const timer = window.setTimeout(() => {
      Store.save(JSON.stringify({ conversations, agents: availableAgents })).catch(() => {})
    }, 600)
    return () => window.clearTimeout(timer)
  }, [conversations, availableAgents])

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setMobilePanel(null)
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', openSearch)
    return () => document.removeEventListener('keydown', openSearch)
  }, [])

  const selectConversation = (id: string) => {
    setActiveId(id)
    setConversations((items) => items.map((item) => item.id === id ? { ...item, unread: false } : item))
    window.history.replaceState(null, '', `#${id}`)
    setMobilePanel(null)
  }

  const toggleInspector = () => {
    if (window.matchMedia('(max-width: 1023px)').matches) setMobilePanel('inspector')
    else setInspectorVisible((visible) => !visible)
  }

  const sendMessage = (text: string, attachment?: string, quote?: string) => {
    const targetId = activeConversation.id
    const userMessage: ChatMessage = { id: `user-${Date.now()}`, sender: 'user', text: attachment ? `${text}\n\n附件：${attachment}` : text, quote }
    setConversations((items) => items.map((item) => item.id === targetId ? { ...item, preview: text, messages: [...item.messages, userMessage] } : item))
    setTypingFor(targetId)

    if (!isMyGo()) {
      // In a plain browser there is no Go backend: keep the demo reply.
      window.clearTimeout(replyTimer.current)
      replyTimer.current = window.setTimeout(() => {
        const reply: ChatMessage = {
          id: `agent-${Date.now()}`, sender: 'agent',
          text: `收到。我会先把这个需求整理成一个最小可验证的步骤，再在当前会话里同步进度。\n\n这是前端演示回复；接入真实 Agent 后，这里会返回 ${activeAgent.name} 的实际执行结果。`,
        }
        setConversations((items) => items.map((item) => item.id === targetId ? { ...item, messages: [...item.messages, reply] } : item))
        setTypingFor(null)
      }, 900)
      return
    }

    const patchMessages = (fn: (messages: ChatMessage[]) => ChatMessage[]) => {
      setConversations((items) => items.map((item) => item.id === targetId ? { ...item, messages: fn(item.messages) } : item))
    }
    let seq = 0
    const pushEvent = (event: Partial<ChatMessage>) => {
      patchMessages((messages) => [...messages, { id: `ev-${Date.now()}-${seq++}`, sender: 'event' as const, text: '', ...event }])
    }
    const runId = Date.now()
    const segText: Record<number, string> = {}
    const appendAgentText = (seg: number, delta: string) => {
      // One assistant message can carry several chat-style parts split by ¶;
      // each part gets its own bubble.
      const parts = (segText[seg] = (segText[seg] ?? '') + delta).split('¶')
      patchMessages((messages) => {
        const next = [...messages]
        parts.forEach((part, k) => {
          const text = part.trim()
          if (!text) return
          const msgId = `agent-${runId}-${seg}-${k}`
          const index = next.findIndex((message) => message.id === msgId)
          if (index === -1) next.push({ id: msgId, sender: 'agent' as const, text })
          else next[index] = { ...next[index], text }
        })
        return next
      })
    }

    const channel = new Channel<ChatEvent>((e) => {
      if (e.type === 'text' && e.delta) {
        appendAgentText(e.seg ?? 0, e.delta)
      } else if (e.type === 'thinking' && e.delta) {
        setThoughts((current) => ({ ...current, [targetId]: ((current[targetId] ?? '') + e.delta).slice(-4000) }))
      } else if (e.type === 'tool_start') {
        pushEvent({ taskTitle: `${e.tool ?? 'tool'}${e.detail ? `：${e.detail}` : ''}` })
      } else if (e.type === 'tool_end' && e.failed) {
        pushEvent({ taskTitle: `${e.tool ?? 'tool'} 执行失败` })
      } else if (e.type === 'error') {
        pushEvent({ text: `出错：${e.detail || '未知错误'}` })
      }
    })
    const prompt = quote ? `> ${quote}\n\n${text}` : text
    Chat.send(targetId, prompt, channel)
      .catch((err) => {
        pushEvent({ text: `发送失败：${isCallError(err) ? err.message : String(err)}` })
      })
      .finally(() => {
        setTypingFor(null)
        setThoughts((current) => {
          const next = { ...current }
          delete next[targetId]
          return next
        })
      })
  }

  const openSettings = (section: SettingsSection = 'general') => {
    setMobilePanel(null)
    setSettingsSection(section)
  }

  const openIntegrations = () => {
    setMobilePanel(null)
    setIntegrationsOpen(true)
  }

  const openReferral = () => {
    setMobilePanel(null)
    setReferralOpen(true)
  }

  const createBot = (input: NewBotInput) => {
    const agentId = `custom-bot-${Date.now()}`
    const agent: Agent = {
      id: agentId,
      name: input.name,
      color: input.color,
      variant: input.variant,
      role: '自定义 Bot',
      description: `${input.name} 是在当前演示中创建的自定义 Bot，可以继续对话并体验完整界面。`,
      capabilities: ['对话与任务整理', '个性化上下文', '演示工作流'],
    }
    const conversation: Conversation = {
      id: agentId,
      agentId,
      title: input.name,
      preview: '新的 Bot 已准备好',
      time: '现在',
      messages: [{ id: `${agentId}-welcome`, sender: 'agent', text: `你好，我是 ${input.name}。外形和颜色已经设置好了，现在可以开始我们的第一段对话。` }],
      tasks: [],
    }
    setAvailableAgents((items) => [...items, agent])
    setConversations((items) => [conversation, ...items])
    setNewBotOpen(false)
    selectConversation(agentId)
    notify(`已创建 Bot「${input.name}」`)
  }

  const handleConversationAction = async (id: string, action: BotContextAction) => {
    const target = conversations.find((item) => item.id === id)
    if (!target) return

    if (action === 'pin') {
      setConversations((items) => items.map((item) => item.id === id ? { ...item, pinned: !item.pinned } : item))
      notify(target.pinned ? `已取消置顶「${target.title}」` : `已置顶「${target.title}」`)
    } else if (action === 'move') {
      setConversations((items) => items.map((item) => item.id === id ? { ...item, section: 'New section' } : item))
      notify(`已将「${target.title}」移动到 New section`)
    } else if (action === 'unread') {
      setConversations((items) => items.map((item) => item.id === id ? { ...item, unread: !item.unread } : item))
      notify(target.unread ? '已标记为已读' : '已标记为未读')
    } else if (action === 'rename') {
      setRenameId(id)
    } else if (action === 'copy') {
      try {
        await navigator.clipboard.writeText(id)
        notify(`已复制会话 ID：${id}`)
      } catch {
        notify(`会话 ID：${id}`)
      }
    } else if (action === 'hide' || action === 'delete') {
      const remaining = conversations.filter((item) => item.id !== id && !item.hidden)
      if (remaining.length === 0) {
        notify('列表中至少需要保留一个 Bot')
        return
      }
      if (action === 'hide') {
        setConversations((items) => items.map((item) => item.id === id ? { ...item, hidden: true } : item))
        notify(`已从侧栏隐藏「${target.title}」`)
      } else {
        setConversations((items) => items.filter((item) => item.id !== id))
        if (!remaining.some((item) => item.agentId === target.agentId)) {
          setAvailableAgents((items) => items.filter((agent) => agent.id !== target.agentId))
        }
        notify(`已删除「${target.title}」`)
      }
      if (activeId === id) selectConversation(remaining[0].id)
    }
  }

  const renameBot = (name: string) => {
    if (!renameConversation) return
    setConversations((items) => items.map((item) => item.id === renameConversation.id ? { ...item, title: name } : item))
    setAvailableAgents((items) => items.map((agent) => agent.id === renameConversation.agentId ? { ...agent, name } : agent))
    setRenameId(null)
    notify(`已重命名为「${name}」`)
  }

  const clearChat = () => {
    if (isMyGo()) Chat.reset(activeId).catch(() => {})
    setConversations((items) => items.map((item) => item.id === activeId ? { ...item, messages: [], preview: '新会话', tasks: [] } : item))
    notify('当前会话已清空')
  }

  const shellStyle = { '--sidebar-width': `${collapsed ? 74 : sidebarWidth}px` } as CSSProperties

  return (
    <div className="app-stage">
      <div className={`app-shell ${collapsed ? 'is-collapsed' : ''} ${!inspectorVisible ? 'no-inspector' : ''} ${sidebarResizing ? 'is-resizing' : ''}`} style={shellStyle}>
        <Sidebar
          agents={availableAgents}
          conversations={conversations}
          activeId={activeId}
          collapsed={collapsed}
          onCollapse={() => setCollapsed((value) => !value)}
          onSelect={selectConversation}
          onNew={() => setNewBotOpen(true)}
          onSearch={() => setSearchOpen(true)}
          onOpenIntegrations={openIntegrations}
          onOpenReferral={openReferral}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          onResizingChange={setSidebarResizing}
          onOpenSettings={openSettings}
          onConversationAction={handleConversationAction}
          onNotify={notify}
        />
        <ChatPanel
          agent={activeAgent}
          conversation={activeConversation}
          typing={typingFor === activeId}
          thought={thoughts[activeId]}
          onOpenSidebar={() => setMobilePanel('sidebar')}
          inspectorVisible={inspectorVisible}
          onToggleInspector={toggleInspector}
          onSend={sendMessage}
          onClear={clearChat}
          onNotify={notify}
        />
        <div
          id="agent-inspector"
          className="inspector-slot"
          aria-hidden={!inspectorVisible}
          inert={!inspectorVisible}
        >
          <InspectorPanel key={activeAgent.id} agent={activeAgent} conversation={activeConversation} files={libraryFiles} onClose={() => setInspectorVisible(false)} onNotify={notify} />
        </div>
      </div>

      {mobilePanel === 'sidebar' && (
        <MobileDrawer side="left" label="会话列表" onClose={() => setMobilePanel(null)}>
          <Sidebar mobile agents={availableAgents} conversations={conversations} activeId={activeId} collapsed={false} onCollapse={() => setMobilePanel(null)} onSelect={selectConversation} onNew={() => { setMobilePanel(null); setNewBotOpen(true) }} onSearch={() => { setMobilePanel(null); setSearchOpen(true) }} onOpenIntegrations={openIntegrations} onOpenReferral={openReferral} onCloseMobile={() => setMobilePanel(null)} onOpenSettings={openSettings} onConversationAction={handleConversationAction} onNotify={notify} />
        </MobileDrawer>
      )}
      {mobilePanel === 'inspector' && (
        <MobileDrawer side="right" label="Agent 详情" onClose={() => setMobilePanel(null)}>
          <InspectorPanel key={activeAgent.id} mobile agent={activeAgent} conversation={activeConversation} files={libraryFiles} onClose={() => setMobilePanel(null)} onNotify={notify} />
        </MobileDrawer>
      )}
      {newBotOpen && <NewBotDialog onCreate={createBot} onClose={() => setNewBotOpen(false)} />}
      {searchOpen && <ConversationSearchDialog agents={availableAgents} conversations={conversations} activeId={activeId} onSelect={selectConversation} onClose={() => setSearchOpen(false)} />}
      {integrationsOpen && <IntegrationDialog store={integrationStore} onClose={() => setIntegrationsOpen(false)} />}
      {referralOpen && <ReferralDialog onClose={() => setReferralOpen(false)} onNotify={notify} />}
      {renameConversation && <RenameBotDialog key={renameConversation.id} initialName={renameConversation.title} onRename={renameBot} onClose={() => setRenameId(null)} />}
      {settingsSection && <SettingsDialog initialSection={settingsSection} onClose={() => setSettingsSection(null)} onNotify={notify} />}
      <div className={`toast ${toast ? 'is-visible' : ''}`} role="status" aria-live="polite">{toast}</div>
    </div>
  )
}
