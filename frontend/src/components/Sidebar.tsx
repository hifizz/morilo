import { useMemo } from 'react'
import { PanelLeftClose, PanelLeftOpen, Plus, Search, X, Gift, Pin, LayoutGrid } from 'lucide-react'
import { AgentAvatar } from './AgentAvatar'
import { AccountMenu } from './AccountMenu'
import { BotContextMenu, type BotContextAction } from './BotContextMenu'
import { SidebarResizer } from './SidebarResizer'
import { IconButton } from '@/design-system'
import { IntegrationIcon } from '@/integrations/IntegrationIcon'
import type { Agent, Conversation } from '@/types/chat'

interface SidebarProps {
  agents: Agent[]
  conversations: Conversation[]
  activeId: string
  collapsed: boolean
  mobile?: boolean
  onCollapse: () => void
  onSelect: (id: string) => void
  onNew: () => void
  onSearch: () => void
  onOpenIntegrations: () => void
  onOpenReferral: () => void
  width?: number
  onWidthChange?: (width: number) => void
  onResizingChange?: (resizing: boolean) => void
  onCloseMobile?: () => void
  onOpenSettings: (section: 'general' | 'billing') => void
  onConversationAction: (id: string, action: BotContextAction) => void
  onNotify: (message: string) => void
}

export function Sidebar({ agents, conversations, activeId, collapsed, mobile = false, onCollapse, onSelect, onNew, onSearch, onOpenIntegrations, onOpenReferral, width = 260, onWidthChange, onResizingChange, onCloseMobile, onOpenSettings, onConversationAction, onNotify }: SidebarProps) {
  const agentMap = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents])
  const filtered = conversations.filter((conversation) => !conversation.hidden && conversation.id !== 'default')
  const sorted = [...filtered].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
  const groups = sorted.reduce<Array<{ name: string; items: Conversation[] }>>((result, conversation) => {
    const name = conversation.section ?? ''
    const group = result.find((item) => item.name === name)
    if (group) group.items.push(conversation)
    else result.push({ name, items: [conversation] })
    return result
  }, [])

  return (
    <aside className={`sidebar ${collapsed && !mobile ? 'sidebar--collapsed' : ''} ${mobile ? 'sidebar--mobile' : ''}`} aria-label="Agent 会话列表">
      <div className="sidebar__actions">
        <IconButton label={collapsed ? '展开会话栏' : '收起会话栏'} onClick={onCollapse} className="desktop-only sidebar-collapse-button">
          {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.7} /> : <PanelLeftClose size={18} strokeWidth={1.7} />}
        </IconButton>
        {mobile && <IconButton label="关闭会话列表" onClick={onCloseMobile}><X size={19} /></IconButton>}
        <span className="sidebar__actions-spacer" />
        <IconButton label="搜索会话" onClick={onSearch}>
          <Search size={18} />
        </IconButton>
        {!collapsed && <IconButton label="新增 Bot" onClick={onNew}><Plus size={20} /></IconButton>}
      </div>

      <button
        type="button"
        className={`workspace-brand ${activeId === 'default' ? 'is-active' : ''}`}
        title="打开 Grok Bot 默认会话"
        aria-label="打开 Grok Bot 默认会话"
        aria-current={activeId === 'default' ? 'page' : undefined}
        onClick={() => onSelect('default')}
      >
        <AgentAvatar color="white" size={48} badge />
        {!collapsed && <span>Grok Bot</span>}
      </button>

      <nav className="conversation-list">
        {groups.map((group) => (
          <section className="conversation-group" key={group.name || 'all'} aria-label={group.name || '全部会话'}>
            {group.name && !collapsed && <h2 className="conversation-section__title">{group.name}</h2>}
            {group.items.map((conversation) => {
              const agent = agentMap.get(conversation.agentId) ?? agents[0]
              const active = conversation.id === activeId
              return (
                <BotContextMenu key={conversation.id} conversation={conversation} onAction={(action) => onConversationAction(conversation.id, action)}>
                  <button
                    type="button"
                    className={`conversation-item ${active ? 'is-active' : ''} ${conversation.unread ? 'is-unread' : ''}`}
                    onClick={() => onSelect(conversation.id)}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? conversation.title : undefined}
                  >
                    <AgentAvatar color={agent.color} variant={agent.variant} size={35} />
                    {!collapsed && (
                      <span className="conversation-item__copy">
                        <span className="conversation-item__topline">
                          <strong>{conversation.title}</strong>
                          {conversation.pinned && <Pin className="conversation-item__pin" size={11} aria-label="已置顶" />}
                          {conversation.tag && <span className="conversation-item__tag">{conversation.tag}</span>}
                        </span>
                        <span className="conversation-item__preview">{conversation.preview}</span>
                      </span>
                    )}
                    {conversation.unread && <span className="conversation-item__unread-dot" aria-label="未读" />}
                    {collapsed && active && !conversation.unread && <span className="conversation-item__active-dot" />}
                  </button>
                </BotContextMenu>
              )
            })}
          </section>
        ))}
        {filtered.length === 0 && <p className="sidebar-empty">没有找到相关会话</p>}
      </nav>

      <div className="sidebar__footer">
        {collapsed && (
          <>
            <IconButton label="新增 Bot" onClick={onNew} className="collapsed-footer-action">
              <Plus size={22} strokeWidth={1.6} />
            </IconButton>
            <IconButton label="Connect Apps" onClick={onOpenIntegrations} className="collapsed-footer-action">
              <LayoutGrid size={20} strokeWidth={1.6} />
            </IconButton>
            <IconButton label="Gift Grok Bot to a friend" onClick={onOpenReferral} className="collapsed-footer-action">
              <Gift size={19} strokeWidth={1.6} />
            </IconButton>
          </>
        )}
        <AccountMenu collapsed={collapsed} onOpenSettings={onOpenSettings} onNotify={onNotify}>
          <button type="button" className="user-profile" aria-label="打开账户资料与设置" title={collapsed ? '账户资料与设置' : undefined}>
            <span className="user-avatar">Z</span>
          </button>
        </AccountMenu>
        {!collapsed && (
          <div className="footer-badges">
            <button type="button" className="connect-apps-entry" aria-label="Connect Apps" title="Connect Apps" onClick={onOpenIntegrations}>
              <span>Connect apps</span>
              <span className="connect-apps-entry__icons" aria-hidden="true">
                <IntegrationIcon icon="notion" size={16} />
                <IntegrationIcon icon="gmail" size={16} />
                <IntegrationIcon icon="context7" size={16} />
              </span>
            </button>
            <button type="button" className="gift-entry" aria-label="Gift Grok Bot to a friend" title="Gift Grok Bot to a friend" onClick={onOpenReferral}><Gift size={15} /></button>
          </div>
        )}
      </div>
      {!mobile && onWidthChange && onResizingChange && (
        <SidebarResizer
          width={width}
          collapsed={collapsed}
          onWidthChange={onWidthChange}
          onCollapsedChange={onCollapse}
          onResizingChange={onResizingChange}
        />
      )}
    </aside>
  )
}
