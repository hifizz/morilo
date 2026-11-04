import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Channel, isCallError, isMyGo } from 'mygo-runtime'
import { Chat, Store, type ChatEvent } from './mygo'
import './App.css'
import type { BotContextAction } from '@/components/BotContextMenu'
import { ChatPanel } from '@/components/ChatPanel'
import { ConversationSearchDialog } from '@/components/ConversationSearchDialog'
import { InspectorPanel } from '@/components/InspectorPanel'
import { InspectorResizer } from '@/components/InspectorResizer'
import { MobileDrawer } from '@/components/MobileDrawer'
import { NewBotDialog, type NewBotInput } from '@/components/NewBotDialog'
import { RenameBotDialog } from '@/components/RenameBotDialog'
import { Sidebar } from '@/components/Sidebar'
import { agents, initialConversations, libraryFiles } from '@/data/demo'
import { IntegrationDialog } from '@/integrations/IntegrationDialog'
import { useIntegrationStore } from '@/integrations/useIntegrationStore'
import { SettingsDialog } from '@/settings/SettingsDialog'
import { Onboarding } from '@/settings/Onboarding'
import { useConnections } from '@/settings/ConnectionProvider'
import { useSettings } from '@/settings/SettingsProvider'
import { LocalProfilePicker } from '@/components/LocalProfilePicker'
import { palette } from '@/components/AgentAvatar'
import type { SettingsSection } from '@/settings/types'
import type { Agent, ChatMessage, Conversation } from '@/types/chat'

type MobilePanel = 'sidebar' | 'inspector' | null

// A fresh native install starts with one clean bot and one empty chat; the
// browser preview keeps the demo seed data.
function freshSeed(t: (zh: string, en: string) => string): { agent: Agent; conversation: Conversation } {
  return {
    agent: {
      id: 'default',
      name: 'Morilo',
      color: 'white',
      role: t('AI 工作伙伴', 'AI companion'),
      description: t('使用你配置的模型与工作环境。', 'Uses your model and chosen work environment.'),
      capabilities: [],
    },
    conversation: { id: 'default', agentId: 'default', title: 'Morilo', preview: '', time: '', messages: [], tasks: [] },
  }
}

const toolProgress: Record<string, [string, string]> = {
  read: ['正在查看文件…', 'Reading file…'],
  computer_read: ['正在查看文件…', 'Reading file…'],
  write: ['正在保存文件…', 'Saving file…'],
  edit: ['正在修改文件…', 'Editing file…'],
  computer_write: ['正在保存文件…', 'Saving file…'],
  grep: ['正在查找内容…', 'Searching content…'],
  find: ['正在查找文件…', 'Finding files…'],
  ls: ['正在查看文件目录…', 'Listing directory…'],
  bash: ['正在执行任务…', 'Running task…'],
  computer_exec: ['正在执行任务…', 'Running task…'],
  computer_desktop: ['正在操作电脑…', 'Controlling computer…'],
}

export default function App() {
  const { snapshot, profile, loading, error, retry, t } = useSettings()
  if (loading) return <div className="app-loading" aria-busy="true" aria-label={t('正在读取设置', 'Loading settings')} />
  if (!snapshot) return <div className="app-loading"><p>{error || t('设置读取失败', 'Could not load settings')}</p><button type="button" onClick={retry}>{t('重试', 'Retry')}</button></div>
  if (!profile) return <LocalProfilePicker />
  return <OnboardingGate key={profile.id} profileID={profile.id} />
}

// OnboardingGate shows first-run setup on native until FinishOnboarding (or a
// valid legacy configuration) completes it. Browser keeps the demo preview;
// a dev-only ?onboarding flag previews the flow visually.
function OnboardingGate({ profileID }: { profileID: string }) {
  const { snapshot, loading, error, refresh } = useConnections()
  if (isMyGo()) {
    if (loading) return <div className="app-loading" aria-busy="true" aria-label="Loading" />
    if (!snapshot) {
      return (
        <div className="app-loading">
          <p role="alert">{error || 'Could not load connection settings'}</p>
          <button type="button" onClick={() => void refresh()}>Retry</button>
        </div>
      )
    }
    if (!snapshot.onboardingComplete) return <Onboarding />
  } else if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('onboarding')) {
    return <Onboarding />
  }
  return <ConversationApp profileID={profileID} />
}

function ConversationApp({ profileID }: { profileID: string }) {
  const { snapshot, t } = useSettings()
  const isLegacyProfile = snapshot?.profiles[0]?.id === profileID
  const seed = useMemo(() => freshSeed(t), [t])
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    isMyGo() ? [seed.conversation] : isLegacyProfile ? initialConversations : [{ ...initialConversations[0], messages: [], tasks: [], preview: '' }],
  )
  const [availableAgents, setAvailableAgents] = useState<Agent[]>(() => (isMyGo() ? [seed.agent] : agents))
  const [activeId, setActiveId] = useState(() => {
    if (isMyGo() || !isLegacyProfile) return 'default'
    const hash = window.location.hash.slice(1)
    return initialConversations.some((item) => item.id === hash) ? hash : 'xresearcher'
  })
  const [collapsed, setCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [sidebarResizing, setSidebarResizing] = useState(false)
  const [inspectorWidth, setInspectorWidth] = useState(420)
  const [inspectorResizing, setInspectorResizing] = useState(false)
  const [inspectorVisible, setInspectorVisible] = useState(true)
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null)
  const [newBotOpen, setNewBotOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [integrationsOpen, setIntegrationsOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null)
  const integrationStore = useIntegrationStore(integrationsOpen)
  const [typingFor, setTypingFor] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, string>>({})
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | undefined>(undefined)
  const replyTimer = useRef<number | undefined>(undefined)
  const stateLoaded = useRef(false)

  const activeConversation = conversations.find((item) => item.id === activeId) ?? conversations[0]
  const activeAgent = useMemo(() => availableAgents.find((agent) => agent.id === activeConversation.agentId) ?? availableAgents[0], [activeConversation, availableAgents])

  const accentPref = snapshot?.preferences.accent ?? 'bot'
  useEffect(() => {
    const root = document.documentElement
    const base = accentPref === 'bot' ? palette[activeAgent.color] : accentPref === 'blue' ? '#4d8dff' : '#858585'
    const control = `color-mix(in srgb, ${base} 45%, black)`
    root.style.setProperty('--ds-accent-default', `light-dark(${control}, ${base})`)
    root.style.setProperty('--ds-accent-control', control)
    root.style.setProperty('--ds-surface-message-user', control)
    return () => {
      root.style.removeProperty('--ds-accent-default')
      root.style.removeProperty('--ds-accent-control')
      root.style.removeProperty('--ds-surface-message-user')
    }
  }, [accentPref, activeAgent.color])
  const renameConversation = conversations.find((item) => item.id === renameId)

  const notify = useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2200)
  }, [])

  useEffect(() => () => { window.clearTimeout(toastTimer.current); window.clearTimeout(replyTimer.current) }, [])

  // Restore persisted conversations and bots, then keep saving them.
  const stateKey = `morilo-state-${profileID}`
  const [loadError, setLoadError] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [loadRetry, setLoadRetry] = useState(0)
  const latestState = useRef('')
  const typingRef = useRef<string | null>(null)
  typingRef.current = typingFor
  useEffect(() => {
    stateLoaded.current = false
    setHydrated(false)
    let canceled = false
    const apply = (raw: string) => {
      if (canceled) return
      let nextConversations = conversations
      let nextAgents = availableAgents
      if (raw) {
        try {
          const saved = JSON.parse(raw) as { conversations?: Conversation[]; agents?: Agent[] }
          if (!Array.isArray(saved.conversations) || !saved.conversations.length) throw new Error('Invalid saved conversations')
          nextConversations = saved.conversations
          if (saved.agents?.length) nextAgents = saved.agents
          const hash = window.location.hash.slice(1)
          setActiveId(nextConversations.some((item) => item.id === hash) ? hash : nextConversations[0].id)
        } catch (err) { /* corrupted state: keep the demo data */ throw err }
      }
      latestState.current = JSON.stringify({ conversations: nextConversations, agents: nextAgents })
      setConversations(nextConversations)
      setAvailableAgents(nextAgents)
      stateLoaded.current = true
      setHydrated(true)
    }
    const failed = (err: unknown) => { if (!canceled) setLoadError(err instanceof Error ? err.message : String(err)) }
    if (isMyGo()) void Store.load(profileID).then(apply).catch(failed)
    else {
      try { apply(localStorage.getItem(stateKey) ?? '') } catch (err) { failed(err) }
    }
    return () => { canceled = true }
  }, [profileID, stateKey, loadRetry])

  latestState.current = stateLoaded.current ? JSON.stringify({ conversations, agents: availableAgents }) : latestState.current

  useEffect(() => () => {
    if (stateLoaded.current && latestState.current) {
      if (isMyGo()) Store.save(profileID, latestState.current).catch(() => {})
      else localStorage.setItem(stateKey, latestState.current)
    }
    if (typingRef.current && isMyGo()) Chat.stop(profileID, typingRef.current).catch(() => {})
  }, [profileID, stateKey])

  useEffect(() => {
    if (!stateLoaded.current) return
    const timer = window.setTimeout(() => {
      const raw = latestState.current
      if (isMyGo()) Store.save(profileID, raw).catch(() => notify(t('会话保存失败，请重试', 'Could not save conversations. Please retry.')))
      else {
        try { localStorage.setItem(stateKey, raw) } catch { notify(t('会话保存失败，请检查浏览器存储空间', 'Could not save conversations. Check browser storage.')) }
      }
    }, 600)
    return () => window.clearTimeout(timer)
  }, [conversations, availableAgents, profileID, stateKey, notify, t])

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
    const userMessage: ChatMessage = { id: `user-${Date.now()}`, sender: 'user', text: attachment ? `${text}\n\n附件：${attachment}` : text, quote, createdAt: new Date().toISOString() }
    setConversations((items) => items.map((item) => item.id === targetId ? { ...item, preview: text, messages: [...item.messages, userMessage] } : item))
    setTypingFor(targetId)

    if (!isMyGo()) {
      // In a plain browser there is no Go backend: keep the demo reply.
      window.clearTimeout(replyTimer.current)
      replyTimer.current = window.setTimeout(() => {
        const reply: ChatMessage = {
          id: `agent-${Date.now()}`, sender: 'agent',
          text: `收到。我会先把这个需求整理成一个最小可验证的步骤，再在当前会话里同步进度。\n\n这是前端演示回复；接入真实 Agent 后，这里会返回 ${activeAgent.name} 的实际执行结果。`,
          createdAt: new Date().toISOString(),
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
          if (index === -1) next.push({ id: msgId, sender: 'agent' as const, text, createdAt: new Date().toISOString() })
          else next[index] = { ...next[index], text }
        })
        return next
      })
    }

    const channel = new Channel<ChatEvent>((e) => {
      if (e.type === 'text' && e.delta) {
        appendAgentText(e.seg ?? 0, e.delta)
        setProgress((current) => ({ ...current, [targetId]: t('正在回复…', 'Replying…') }))
      } else if (e.type === 'thinking') {
        setProgress((current) => ({ ...current, [targetId]: t('正在思考…', 'Thinking…') }))
      } else if (e.type === 'tool_start') {
        setProgress((current) => ({ ...current, [targetId]: toolProgress[e.tool ?? ''] ? t(...toolProgress[e.tool ?? '']) : t('正在处理任务…', 'Working…') }))
      } else if (e.type === 'tool_end') {
        setProgress((current) => ({ ...current, [targetId]: e.failed ? t('正在处理执行问题…', 'Handling an issue…') : t('正在整理结果…', 'Wrapping up…') }))
      } else if (e.type === 'error') {
        pushEvent({ text: t(`出错：${e.detail || t('未知错误', 'Unknown error')}`, `Error: ${e.detail || t('未知错误', 'Unknown error')}`) })
      }
    })
    const prompt = quote ? `> ${quote}\n\n${text}` : text
    Chat.send(profileID, targetId, prompt, channel)
      .catch((err) => {
        pushEvent({ text: t(`发送失败：${isCallError(err) ? err.message : String(err)}`, `Could not send: ${isCallError(err) ? err.message : String(err)}`) })
      })
      .finally(() => {
        setTypingFor(null)
        setProgress((current) => {
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
    notify(t(`已创建 Bot「${input.name}」`, `Created bot “${input.name}”`))
  }

  const handleConversationAction = async (id: string, action: BotContextAction) => {
    const target = conversations.find((item) => item.id === id)
    if (!target) return

    if (action === 'pin') {
      setConversations((items) => items.map((item) => item.id === id ? { ...item, pinned: !item.pinned } : item))
      notify(target.pinned ? t(`已取消置顶「${target.title}」`, `Unpinned “${target.title}”`) : t(`已置顶「${target.title}」`, `Pinned “${target.title}”`))
    } else if (action === 'move') {
      const section = t('新分区', 'New section')
      setConversations((items) => items.map((item) => item.id === id ? { ...item, section } : item))
      notify(t(`已将「${target.title}」移动到${section}`, `Moved “${target.title}” to ${section}`))
    } else if (action === 'unread') {
      setConversations((items) => items.map((item) => item.id === id ? { ...item, unread: !item.unread } : item))
      notify(target.unread ? t('已标记为已读', 'Marked as read') : t('已标记为未读', 'Marked as unread'))
    } else if (action === 'rename') {
      setRenameId(id)
    } else if (action === 'copy') {
      try {
        await navigator.clipboard.writeText(id)
        notify(t(`已复制会话 ID：${id}`, `Copied conversation ID: ${id}`))
      } catch {
        notify(t(`会话 ID：${id}`, `Conversation ID: ${id}`))
      }
    } else if (action === 'hide' || action === 'delete') {
      const remaining = conversations.filter((item) => item.id !== id && !item.hidden)
      if (remaining.length === 0) {
        notify(t('列表中至少需要保留一个 Bot', 'Keep at least one bot in the list'))
        return
      }
      if (action === 'hide') {
        setConversations((items) => items.map((item) => item.id === id ? { ...item, hidden: true } : item))
        notify(t(`已从侧栏隐藏「${target.title}」`, `Hid “${target.title}” from the sidebar`))
      } else {
        setConversations((items) => items.filter((item) => item.id !== id))
        if (!remaining.some((item) => item.agentId === target.agentId)) {
          setAvailableAgents((items) => items.filter((agent) => agent.id !== target.agentId))
        }
        notify(t(`已删除「${target.title}」`, `Deleted “${target.title}”`))
      }
      if (activeId === id) selectConversation(remaining[0].id)
    }
  }

  const renameBot = (name: string) => {
    if (!renameConversation) return
    setConversations((items) => items.map((item) => item.id === renameConversation.id ? { ...item, title: name } : item))
    setAvailableAgents((items) => items.map((agent) => agent.id === renameConversation.agentId ? { ...agent, name } : agent))
    setRenameId(null)
    notify(t(`已重命名为「${name}」`, `Renamed to “${name}”`))
  }

  const clearChat = () => {
    if (isMyGo()) Chat.reset(profileID, activeId).catch(() => {})
    setConversations((items) => items.map((item) => item.id === activeId ? { ...item, messages: [], preview: '新会话', tasks: [] } : item))
    notify(t('当前会话已清空', 'Current conversation cleared'))
  }

  const shellStyle = { '--sidebar-width': `${collapsed ? 74 : sidebarWidth}px`, '--inspector-width': `${inspectorWidth}px` } as CSSProperties

  if (loadError) {
    return (
      <div className="app-loading">
        <p>{t('会话状态读取失败', 'Could not load conversations')}: {loadError}</p>
        <button type="button" onClick={() => { setLoadError(''); setLoadRetry((v) => v + 1) }}>{t('重试', 'Retry')}</button>
      </div>
    )
  }

  if (!hydrated) return <div className="app-loading" aria-busy="true" aria-label={t('正在读取会话', 'Loading conversations')} />

  return (
    <div className="app-stage">
      <div className={`app-shell ${collapsed ? 'is-collapsed' : ''} ${!inspectorVisible ? 'no-inspector' : ''} ${sidebarResizing || inspectorResizing ? 'is-resizing' : ''}`} style={shellStyle}>
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
          progress={progress[activeId]}
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
          <InspectorResizer width={inspectorWidth} sidebarWidth={collapsed ? 74 : sidebarWidth} onWidthChange={setInspectorWidth} onResizingChange={setInspectorResizing} />
          <InspectorPanel key={activeAgent.id} agent={activeAgent} conversation={activeConversation} files={isMyGo() ? [] : libraryFiles} onClose={() => setInspectorVisible(false)} onNotify={notify} />
        </div>
      </div>

      {mobilePanel === 'sidebar' && (
        <MobileDrawer side="left" label={t('会话列表', 'Conversations')} onClose={() => setMobilePanel(null)}>
          <Sidebar mobile agents={availableAgents} conversations={conversations} activeId={activeId} collapsed={false} onCollapse={() => setMobilePanel(null)} onSelect={selectConversation} onNew={() => { setMobilePanel(null); setNewBotOpen(true) }} onSearch={() => { setMobilePanel(null); setSearchOpen(true) }} onOpenIntegrations={openIntegrations} onCloseMobile={() => setMobilePanel(null)} onOpenSettings={openSettings} onConversationAction={handleConversationAction} onNotify={notify} />
        </MobileDrawer>
      )}
      {mobilePanel === 'inspector' && (
        <MobileDrawer side="right" label={t('Agent 详情', 'Agent details')} onClose={() => setMobilePanel(null)}>
          <InspectorPanel key={activeAgent.id} mobile agent={activeAgent} conversation={activeConversation} files={isMyGo() ? [] : libraryFiles} onClose={() => setMobilePanel(null)} onNotify={notify} />
        </MobileDrawer>
      )}
      {newBotOpen && <NewBotDialog onCreate={createBot} onClose={() => setNewBotOpen(false)} />}
      {searchOpen && <ConversationSearchDialog agents={availableAgents} conversations={conversations} activeId={activeId} onSelect={selectConversation} onClose={() => setSearchOpen(false)} />}
      {integrationsOpen && <IntegrationDialog store={integrationStore} onClose={() => setIntegrationsOpen(false)} />}
      {renameConversation && <RenameBotDialog key={renameConversation.id} initialName={renameConversation.title} onRename={renameBot} onClose={() => setRenameId(null)} />}
      {settingsSection && <SettingsDialog initialSection={settingsSection} onClose={() => setSettingsSection(null)} onNotify={notify} />}
      <div className={`toast ${toast ? 'is-visible' : ''}`} role="status" aria-live="polite">{toast}</div>
    </div>
  )
}
