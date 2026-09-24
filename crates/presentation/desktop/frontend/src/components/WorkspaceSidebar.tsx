
import { useCallback, useMemo, useRef, useState } from 'react'
import type { ConversationSummary } from '../types/runtime'
import Icon from './Icon'
import PanelResizeHandle from './PanelResizeHandle'
import { useMenuKeyboard } from '../hooks/useMenuKeyboard'
import { useExclusiveOverlay } from '../hooks/useExclusiveOverlay'
import type { RailMode } from '../navigation'

type SidebarFilter = 'All' | 'Pinned' | 'Recent'
type SidebarTab = 'SESSIONS' | 'BOTS' | 'TERMINAL'

interface WorkspaceSidebarProps {
  conversations: ConversationSummary[]
  activeConversation: string
  onSelectConversation: (id: string) => void
  onCreateConversation: () => void
  onOpenSearch: () => void
  onConversationAction?: (id: string, action: 'pin' | 'rename' | 'archive', value?: string) => void
  onNavigate?: (mode: RailMode) => void
  runtimeConnected: boolean
}

const quickNav: Array<{ label: string; icon: Parameters<typeof Icon>[0]['name']; mode: RailMode | 'new-session' }> = [
  { label: 'New session', icon: 'plus', mode: 'new-session' },
  { label: 'Capabilities', icon: 'tool', mode: 'tools' },
  { label: 'Messaging', icon: 'message', mode: 'channels' },
  { label: 'Artifacts', icon: 'file-code', mode: 'artifacts' },
  { label: 'Scheduled jobs', icon: 'calendar', mode: 'automations' },
  { label: 'Memory', icon: 'database', mode: 'memory' },
  { label: 'RSS', icon: 'globe', mode: 'integrations' },
  { label: 'Kanban', icon: 'layers', mode: 'kanban' },
  { label: 'Newswire', icon: 'search', mode: 'research' },
  { label: 'Resetwatch', icon: 'activity', mode: 'operations' },
]

const bots: Array<{ name: string; role: string; mode: RailMode }> = [
  { name: 'Builder', role: 'Implementation specialist', mode: 'agents' },
  { name: 'Reviewer', role: 'Diff and policy review', mode: 'agents' },
  { name: 'Researcher', role: 'Sources and citations', mode: 'research' },
  { name: 'Release Bot', role: 'Release evidence', mode: 'release' },
]

function relativeTime(timestamp: number) {
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000))
  if (minutes < 60) return minutes + 'm'
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours + 'h'
  return Math.round(hours / 24) + 'd'
}

export default function WorkspaceSidebar({
  conversations,
  activeConversation,
  onSelectConversation,
  onCreateConversation,
  onOpenSearch,
  onConversationAction,
  onNavigate,
  runtimeConnected,
}: WorkspaceSidebarProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SidebarFilter>('All')
  const [tab, setTab] = useState<SidebarTab>('SESSIONS')
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const menuRef = useRef<HTMLDivElement>(null)
  const activeMenuButton = menuOpen ? menuButtonRefs.current[menuOpen] : null
  const triggerRef = useMemo(() => ({ current: activeMenuButton }), [activeMenuButton])
  const closeConversationMenu = useCallback(() => setMenuOpen(null), [])
  useMenuKeyboard({ open: menuOpen !== null, menuRef, triggerRef, onClose: closeConversationMenu })
  useExclusiveOverlay('conversation-menu', menuOpen !== null, closeConversationMenu)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return conversations
      .filter((conversation) => {
        if (filter === 'Pinned') return Boolean(conversation.pinned)
        if (filter === 'Recent') return Date.now() - conversation.timestamp < 1000 * 60 * 60 * 24 * 7
        return true
      })
      .filter((conversation) => !normalized || (conversation.title + ' ' + conversation.preview).toLowerCase().includes(normalized))
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.timestamp - a.timestamp)
  }, [conversations, filter, query])

  const pinnedConversations = filtered.filter((conversation) => conversation.pinned)
  const sessionRows = pinnedConversations.length > 0 ? filtered.filter((conversation) => !conversation.pinned) : filtered

  function beginRename(conversation: ConversationSummary) {
    setMenuOpen(null)
    setEditingId(conversation.id)
    setEditingTitle(conversation.title)
  }

  function commitRename(id: string) {
    const title = editingTitle.trim()
    if (title) onConversationAction?.(id, 'rename', title)
    setEditingId(null)
    setEditingTitle('')
  }

  function renderConversationRow(conversation: ConversationSummary) {
    return (
      <div className={activeConversation === conversation.id ? 'conversation-row conversation-row--active' : 'conversation-row'} key={conversation.id}>
        {editingId === conversation.id ? (
          <div className="conversation-rename">
            <input autoFocus aria-label="Rename conversation" value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') commitRename(conversation.id); if (event.key === 'Escape') setEditingId(null) }} />
            <button type="button" onClick={() => commitRename(conversation.id)} aria-label="Save conversation name"><Icon name="check" size={13} /></button>
          </div>
        ) : (
          <>
            <button className="conversation-main-button" onClick={() => onSelectConversation(conversation.id)} type="button">
              <span className={activeConversation === conversation.id ? 'conversation-dot conversation-dot--active' : 'conversation-dot'} aria-hidden="true" />
              <div className="conversation-row__copy"><strong>{conversation.title}</strong></div>
              <time>{relativeTime(conversation.timestamp)}</time>
            </button>
            <div className="conversation-menu-wrap">
              <button ref={(element) => { menuButtonRefs.current[conversation.id] = element }} className="conversation-menu-button" type="button" aria-label={'Actions for ' + conversation.title} aria-haspopup="menu" aria-expanded={menuOpen === conversation.id} title="Conversation actions" onClick={() => setMenuOpen((current) => current === conversation.id ? null : conversation.id)}>
                <Icon name="more" size={13} />
              </button>
              {menuOpen === conversation.id && (
                <div ref={menuRef} className="conversation-menu" role="menu" aria-label={"Actions for " + conversation.title}>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(null); onConversationAction?.(conversation.id, 'pin') }}><Icon name="archive" size={13} /><span>{conversation.pinned ? 'Unpin' : 'Pin'}</span></button>
                  <button type="button" role="menuitem" onClick={() => beginRename(conversation)}><Icon name="code" size={13} /><span>Rename</span></button>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(null); onConversationAction?.(conversation.id, 'archive') }}><Icon name="archive" size={13} /><span>Archive</span></button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <aside className="workspace-sidebar">
      <PanelResizeHandle axis="sidebar" />
      <div className="sidebar-tabs" role="tablist" aria-label="Sidebar views" aria-orientation="horizontal">
        {(['SESSIONS', 'BOTS', 'TERMINAL'] as SidebarTab[]).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            tabIndex={tab === item ? 0 : -1}
            className={tab === item ? 'sidebar-tab sidebar-tab--active' : 'sidebar-tab'}
            onKeyDown={(event) => {
              const tabs: SidebarTab[] = ['SESSIONS', 'BOTS', 'TERMINAL']
              const currentIndex = tabs.indexOf(tab)
              const nextIndex = event.key === 'ArrowRight' || event.key === 'ArrowDown'
                ? (currentIndex + 1) % tabs.length
                : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                  ? (currentIndex - 1 + tabs.length) % tabs.length
                  : -1
              if (nextIndex >= 0) {
                event.preventDefault()
                setTab(tabs[nextIndex])
                window.requestAnimationFrame(() => {
                  const buttons = document.querySelectorAll<HTMLButtonElement>('.sidebar-tabs .sidebar-tab')
                  buttons[tabs.indexOf(tabs[nextIndex])]?.focus()
                })
              }
            }}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <nav className="sidebar-quicknav" aria-label="Sidebar navigation">
        {quickNav.map((item) => (
          <button
            key={item.label}
            type="button"
            className="sidebar-quicknav__row"
            onClick={() => item.mode === 'new-session' ? onCreateConversation() : onNavigate?.(item.mode)}
          >
            <Icon name={item.icon} size={15} />
            <span>{item.label}</span>
            {item.mode === 'new-session' && <kbd>Ctrl N</kbd>}
          </button>
        ))}
      </nav>

      {tab === 'SESSIONS' && (
        <>
          <div className="sidebar-search">
            <Icon name="search" size={14} />
            <input aria-label="Filter conversations" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sessions…" />
          </div>

          <div className="sidebar-section sidebar-section--pinned">
            <div className="sidebar-section__title">
              <Icon name="archive" size={11} />
              <span>Pinned</span>
            </div>
            {pinnedConversations.length === 0 && <div className="sidebar-hint">Shift-click a chat to pin</div>}
            {pinnedConversations.map(renderConversationRow)}
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section__title">
              <Icon name="message" size={11} />
              <span>Sessions</span>
              <button className="sidebar-section__action" type="button" aria-label={'Filter sessions (current: ' + filter + ')'} title={'Filter sessions (current: ' + filter + ')'} onClick={() => setFilter(filter === 'All' ? 'Recent' : filter === 'Recent' ? 'Pinned' : 'All')}>
                <Icon name="filter" size={12} />
              </button>
            </div>
            <div id="conversation-list" className="conversation-list" role="tabpanel" aria-labelledby={"conversation-filter-" + filter.toLowerCase()} tabIndex={0}>
              <span id="conversation-filter-all" hidden />
              <span id="conversation-filter-pinned" hidden />
              <span id="conversation-filter-recent" hidden />
              {sessionRows.length === 0 ? (
                <div className="sidebar-empty">{query ? 'No sessions match “' + query + '”.' : 'No sessions in this filter.'}</div>
              ) : sessionRows.map(renderConversationRow)}
            </div>
          </div>
        </>
      )}

      {tab === 'BOTS' && (
        <div className="sidebar-section">
          <div className="sidebar-section__title">
            <Icon name="bot" size={11} />
            <span>Bots</span>
          </div>
          <div className="sidebar-bot-list">
            {bots.map((bot) => (
              <button key={bot.name} type="button" className="sidebar-bot-row" onClick={() => onNavigate?.(bot.mode)}>
                <span className="sidebar-bot-row__avatar">{bot.name.charAt(0)}</span>
                <span className="sidebar-bot-row__copy"><strong>{bot.name}</strong><small>{bot.role}</small></span>
                <Icon name="chevron-right" size={12} />
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'TERMINAL' && (
        <div className="sidebar-section">
          <div className="sidebar-section__title">
            <Icon name="terminal" size={11} />
            <span>Terminal</span>
          </div>
          <div className="sidebar-terminal-card">
            <Icon name="terminal" size={16} />
            <strong>Integrated shell</strong>
            <small>Shell sessions and command execution with guardrails.</small>
            <button type="button" className="sw-button" onClick={() => onNavigate?.('terminal')}>Open terminal</button>
          </div>
        </div>
      )}

      <div className="sidebar-footer sidebar-footer--icons">
        <button className="sidebar-footer__action" aria-label="Workspace overview" title="Workspace overview" type="button" onClick={() => onNavigate?.('overview')}>
          <Icon name="home" size={15} />
        </button>
        <button className="sidebar-footer__action" aria-label="New conversation" title="New conversation" type="button" onClick={onCreateConversation}>
          <Icon name="plus" size={15} />
        </button>
        <button className="sidebar-footer__action" aria-label="Workspace navigator" title="Workspace navigator" type="button" onClick={() => onNavigate?.('navigation-center')}>
          <Icon name="layers" size={15} />
        </button>
        <button className="sidebar-footer__action" aria-label="Sessions" title="Sessions" type="button" onClick={() => onNavigate?.('sessions')}>
          <Icon name="history" size={15} />
        </button>
        <span className="mini-status mini-status--inline" title={runtimeConnected ? 'Runtime online' : 'Runtime offline'}>
          <span className={runtimeConnected ? 'status-dot status-dot--live' : 'status-dot status-dot--offline'} />
        </span>
        <button className="sidebar-footer__action" title="Command palette" aria-label="Command palette" type="button" onClick={onOpenSearch}>
          <Icon name="command" size={15} />
        </button>
      </div>
    </aside>
  )
}
