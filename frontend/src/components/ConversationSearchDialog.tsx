import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Dialog, TextField } from '@/design-system'
import type { Agent, Conversation } from '@/types/chat'
import { AgentAvatar } from './AgentAvatar'
import { useSettings } from '@/settings/SettingsProvider'

interface SearchResult {
  id: string
  title: string
  description: string
  conversationId: string
  agent: Agent
}

interface ConversationSearchDialogProps {
  agents: Agent[]
  conversations: Conversation[]
  activeId: string
  onSelect: (id: string) => void
  onClose: () => void
}

export function ConversationSearchDialog({ agents, conversations, activeId, onSelect, onClose }: ConversationSearchDialogProps) {
  const { t, snapshot } = useSettings()
  const [query, setQuery] = useState('')
  const [requestedIndex, setRequestedIndex] = useState(() => Math.max(0, conversations.findIndex((item) => item.id === activeId)))
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo<SearchResult[]>(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    const agentMap = new Map(agents.map((agent) => [agent.id, agent]))
    return conversations
      .filter((conversation) => !conversation.hidden)
      .map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        description: conversation.preview,
        conversationId: conversation.id,
        agent: agentMap.get(conversation.agentId) ?? agents[0],
      }))
      .filter((item) => `${item.title} ${item.description}`.toLocaleLowerCase().includes(normalizedQuery))
  }, [agents, conversations, query])

  const selectedIndex = results.length === 0 ? -1 : Math.min(requestedIndex, results.length - 1)

  const selectResult = useCallback((result: SearchResult) => {
    onSelect(result.conversationId)
    onClose()
  }, [onClose, onSelect])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (results.length === 0) return
        setRequestedIndex((current) => {
          const safeIndex = Math.min(current, results.length - 1)
          return event.key === 'ArrowDown'
            ? (safeIndex + 1) % results.length
            : (safeIndex - 1 + results.length) % results.length
        })
      } else if (event.key === 'Enter' && selectedIndex >= 0) {
        event.preventDefault()
        selectResult(results[selectedIndex])
      } else if ((event.metaKey || event.ctrlKey) && /^[1-8]$/.test(event.key)) {
        const index = Number(event.key) - 1
        if (!results[index]) return
        event.preventDefault()
        selectResult(results[index])
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [results, selectedIndex, selectResult])

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }} title={t('搜索并切换会话', 'Search and switch conversations')} closeLabel={t('关闭', 'Close')} hideHeader hideCloseButton className="conversation-search-dialog">
      <label className="conversation-search-dialog__input">
        <Search size={19} aria-hidden="true" />
        <TextField
          variant="bare"
          autoFocus
          value={query}
          onChange={(event) => { setQuery(event.target.value); setRequestedIndex(0) }}
          placeholder={t('搜索', 'Search')}
          aria-label={t('搜索 Bot 或会话', 'Search bots or conversations')}
          spellCheck={snapshot?.preferences.spellcheck ?? true}
          autoComplete="off"
        />
        {query && <kbd>ESC</kbd>}
      </label>
      <div className="conversation-search-results" ref={listRef} role="listbox" aria-label={t('会话搜索结果', 'Conversation search results')}>
        {results.map((result, index) => (
          <button
            type="button"
            role="option"
            aria-selected={selectedIndex === index}
            className="conversation-search-result"
            key={result.id}
            onMouseEnter={() => setRequestedIndex(index)}
            onClick={() => selectResult(result)}
          >
            <AgentAvatar color={result.agent.color} variant={result.agent.variant} size={32} />
            <span className="conversation-search-result__copy">
              <strong>{result.title}</strong>
              <span>{result.description}</span>
            </span>
            {index < 8 && <kbd aria-label={t(`快捷键 Command ${index + 1}`, `Shortcut Command ${index + 1}`)}>⌘{index + 1}</kbd>}
          </button>
        ))}
        {results.length === 0 && (
          <div className="conversation-search-empty">
            <Search size={22} />
            <strong>{t('没有找到相关会话', 'No matching conversations')}</strong>
            <span>{t('试试 Bot 名称或消息关键词', 'Try a bot name or message keyword')}</span>
          </div>
        )}
      </div>
    </Dialog>
  )
}
