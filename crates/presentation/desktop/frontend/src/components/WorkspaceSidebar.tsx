
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
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
  onConversationAction?: (id: string, action: 'pin' | 'rename' | 'archive' | 'delete', value?: string) => void
  onNavigate?: (mode: RailMode) => void
  onOpenNotifications?: () => void
  notificationUnread?: number
  onAction?: (message: string) => void
  onOpenAppearance?: () => void
  onOpenSettings?: () => void
  footerExtra?: ReactNode
  runtimeConnected: boolean
}

const quickNav: Array<{ label: string; icon: Parameters<typeof Icon>[0]['name']; mode: RailMode | 'new-session' | 'search' }> = [
  { label: 'New Task', icon: 'plus', mode: 'new-session' },
  { label: 'Search', icon: 'search', mode: 'search' },
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
  onAction,
  onOpenAppearance,
  onOpenSettings,
}: WorkspaceSidebarProps) {
  const [query, setQuery] = useState('')
  const [gearOpen, setGearOpen] = useState(false)
  const [filter, setFilter] = useState<SidebarFilter>('All')
  const [tab, setTab] = useState<SidebarTab>('SESSIONS')
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [submenu, setSubmenu] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [unreadIds, setUnreadIds] = useState<ReadonlySet<string>>(new Set())
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

  function toggleUnread(id: string) {
    setMenuOpen(null)
    setSubmenu(null)
    setUnreadIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function openAppearance() {
    setMenuOpen(null)
    setSubmenu(null)
    onOpenAppearance?.()
  }

  function beginRename(conversation: ConversationSummary) {
    setMenuOpen(null)
    setSubmenu(null)
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
    const isUnread = unreadIds.has(conversation.id)
    return (
      <div
        className={activeConversation === conversation.id ? 'conversation-row conversation-row--active' : 'conversation-row'}
        key={conversation.id}
        onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setSubmenu(null); setMenuOpen(conversation.id) }}
      >
        {editingId === conversation.id ? (
          <div className="conversation-rename">
            <input autoFocus aria-label="Rename conversation" value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') commitRename(conversation.id); if (event.key === 'Escape') setEditingId(null) }} />
            <button type="button" onClick={() => commitRename(conversation.id)} aria-label="Save conversation name"><Icon name="check" size={13} /></button>
          </div>
        ) : (
          <>
            <button className="conversation-main-button" onClick={() => { onSelectConversation(conversation.id); setUnreadIds((current) => { if (!current.has(conversation.id)) return current; const next = new Set(current); next.delete(conversation.id); return next }) }} type="button">
              <span className={activeConversation === conversation.id || isUnread ? 'conversation-dot conversation-dot--active' : 'conversation-dot'} aria-hidden="true" />
              <div className="conversation-row__copy"><strong>{conversation.title}</strong></div>
              <time>{relativeTime(conversation.timestamp)}</time>
            </button>
            <div className="conversation-menu-wrap">
              <button ref={(element) => { menuButtonRefs.current[conversation.id] = element }} className="conversation-menu-button" type="button" aria-label={'Actions for ' + conversation.title} aria-haspopup="menu" aria-expanded={menuOpen === conversation.id} title="Conversation actions" onClick={() => setMenuOpen((current) => current === conversation.id ? null : conversation.id)}>
                <Icon name="more" size={13} />
              </button>
              {menuOpen === conversation.id && (
                <div ref={menuRef} className="conversation-menu" role="menu" aria-label={"Actions for " + conversation.title}>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(null); onAction?.('New window opens through the desktop runtime') }}><Icon name="layout" size={13} /><span>New window</span></button>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(null); onAction?.('Open in terminal through the desktop runtime') }}><Icon name="terminal" size={13} /><span>Open in terminal</span></button>
                  <div className="conversation-menu__divider" aria-hidden="true" />
                  <button type="button" role="menuitem" onClick={() => beginRename(conversation)}><Icon name="code" size={13} /><span>Rename</span></button>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(null); onConversationAction?.(conversation.id, 'pin') }}><Icon name="paperclip" size={13} /><span>{conversation.pinned ? 'Unpin' : 'Pin'}</span></button>
                  <button type="button" role="menuitem" onClick={() => toggleUnread(conversation.id)}><Icon name="message" size={13} /><span>{unreadIds.has(conversation.id) ? 'Mark as read' : 'Mark as unread'}</span></button>
                  <button type="button" role="menuitem" onClick={openAppearance}><Icon name="spark" size={13} /><span>Appearance</span><Icon name="chevron-right" size={11} /></button>
                  <button type="button" role="menuitem" onClick={() => { void navigator.clipboard?.writeText(conversation.id); setMenuOpen(null); onAction?.('Session ID copied to clipboard') }}><Icon name="copy" size={13} /><span>Copy ID</span></button>
                  <div className="conversation-menu__divider" aria-hidden="true" />
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(null); onAction?.('Session branch staged in preview') }}><Icon name="branch" size={13} /><span>Branch</span></button>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(null); onAction?.('Transcript export prepared in preview') }}><Icon name="arrow-down" size={13} /><span>Export</span></button>
                  <div className="conversation-submenu-wrap">
                    <button type="button" role="menuitem" aria-expanded={submenu === 'move'} onClick={() => setSubmenu(submenu === 'move' ? null : 'move')}><Icon name="folder" size={13} /><span>Move to project</span><Icon name="chevron-right" size={11} /></button>
                    {submenu === 'move' && (
                      <div className="conversation-submenu">
                        {['Personal workspace', 'agenticos'].map((project) => (
                          <button key={project} type="button" role="menuitem" onClick={() => { setMenuOpen(null); setSubmenu(null); onAction?.(`Moved to ${project} (preview)`) }}>{project}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="conversation-menu__divider" aria-hidden="true" />
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(null); onConversationAction?.(conversation.id, 'archive') }}><Icon name="archive" size={13} /><span>Archive</span></button>
                  <button type="button" role="menuitem" className="conversation-menu__danger" onClick={() => { setMenuOpen(null); onConversationAction?.(conversation.id, 'delete') }}><Icon name="x" size={13} /><span>Delete</span></button>
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
      <div className="qoder-sidebar-head">
        <span className="qoder-sidebar-head__app" aria-hidden="true"><Icon name="folder" size={13} /></span>
        <button type="button" className="qoder-workspace-pill">
          <Icon name="spark" size={12} />
          <span>General</span>
          <Icon name="chevron-right" size={10} />
        </button>
      </div>
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
            onClick={() => item.mode === 'new-session' ? onCreateConversation() : item.mode === 'search' ? onOpenSearch() : onNavigate?.(item.mode)}
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
              <span>Workspaces</span>
              <button className="sidebar-section__action" type="button" aria-label="New workspace" title="New workspace" onClick={() => onAction?.('Workspaces are not part of this build')}>
                <Icon name="plus" size={12} />
              </button>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section__title">
              <Icon name="message" size={11} />
              <span>Recent tasks</span>
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
            <button type="button" className="qoder-side-row" onClick={() => onNavigate?.('agents')}>Límite de agentes</button>
            <button type="button" className="qoder-side-row" onClick={() => onAction?.('Access to my PC is handled by the desktop runtime')}>Acceso a mi pc</button>
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
        <nav className="qoder-bottom-nav" aria-label="Workspace tools">
          <button type="button" className="qoder-bottom-row" onClick={() => onNavigate?.('knowledge')}>
            <Icon name="layers" size={15} /><span>Knowledge Center</span>
          </button>
          <button type="button" className="qoder-bottom-row" onClick={() => onAction?.('Sites is not part of this build')}>
            <Icon name="globe" size={15} /><span>Sites</span>
          </button>
          <button type="button" className="qoder-bottom-row" onClick={() => onNavigate?.('automations')}>
            <Icon name="clock" size={15} /><span>Automations</span>
          </button>
          <button type="button" className="qoder-bottom-row" onClick={() => onNavigate?.('marketplace')}>
            <Icon name="sliders" size={15} /><span>Extensions</span>
          </button>
        </nav>
        <div className="qoder-user">
          <span className="qoder-user__avatar" aria-hidden="true">M</span>
          <span className="qoder-user__name">Matías González</span>
          <button className="qoder-user__action" aria-label="Token usage" title="Token usage" type="button" onClick={() => onAction?.('Token usage is summarised in the status bar')}><Icon name="activity" size={14} /></button>
          <span className="qoder-gear-wrap">
            <button className="qoder-user__action" aria-label="Settings menu" title="Settings" type="button" aria-haspopup="menu" aria-expanded={gearOpen} onClick={() => setGearOpen((open) => !open)}><Icon name="settings" size={14} /></button>
            {gearOpen && (
              <div className="qoder-gear-menu" role="menu" aria-label="Settings menu">
                <button type="button" role="menuitem" onClick={() => { setGearOpen(false); onOpenSettings?.() }}><Icon name="settings" size={13} /><span>Settings</span><kbd>Ctrl+,</kbd></button>
                <button type="button" role="menuitem" onClick={() => { setGearOpen(false); onAction?.('Rewards are not part of this build') }}><Icon name="spark" size={13} /><span>Rewards center</span></button>
                <button type="button" role="menuitem" onClick={() => { setGearOpen(false); onAction?.('The desktop pet is not part of this build') }}><Icon name="bot" size={13} /><span>Hide pet</span></button>
                <button type="button" role="menuitem" onClick={() => { setGearOpen(false); onOpenAppearance?.() }}><Icon name="spark" size={13} /><span>Appearance</span><Icon name="chevron-right" size={11} /></button>
                <button type="button" role="menuitem" onClick={() => { setGearOpen(false); onAction?.('Changelog is not part of this build') }}><Icon name="history" size={13} /><span>Changelog</span><Icon name="external" size={11} /></button>
                <button type="button" role="menuitem" onClick={() => { setGearOpen(false); onAction?.('The mobile app is not part of this build') }}><Icon name="external" size={13} /><span>Get the mobile app</span></button>
                <button type="button" role="menuitem" onClick={() => { setGearOpen(false); onAction?.('AgentiCOS · local build') }}><Icon name="info" size={13} /><span>About AgentiCOS</span></button>
                <div className="qoder-gear-menu__divider" />
                <button type="button" role="menuitem" className="qoder-gear-menu__danger" onClick={() => { setGearOpen(false); onAction?.('There is no account session in this build') }}><Icon name="x" size={13} /><span>Sign out</span></button>
              </div>
            )}
          </span>
        </div>
      </div>
    </aside>
  )
}
