
import { useCallback, useMemo, useRef, useState } from 'react'
import type { ConversationSummary } from '../types/runtime'
import Icon from './Icon'
import PanelResizeHandle from './PanelResizeHandle'
import { useMenuKeyboard } from '../hooks/useMenuKeyboard'

type SidebarFilter = 'All' | 'Pinned' | 'Recent'

interface WorkspaceSidebarProps {
  conversations: ConversationSummary[]
  activeConversation: string
  onSelectConversation: (id: string) => void
  onCreateConversation: () => void
  onOpenSearch: () => void
  onConversationAction?: (id: string, action: 'pin' | 'rename' | 'archive', value?: string) => void
  runtimeConnected: boolean
}

export default function WorkspaceSidebar({
  conversations,
  activeConversation,
  onSelectConversation,
  onCreateConversation,
  onOpenSearch,
  onConversationAction,
  runtimeConnected,
}: WorkspaceSidebarProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SidebarFilter>('All')
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const menuRef = useRef<HTMLDivElement>(null)
  const activeMenuButton = menuOpen ? menuButtonRefs.current[menuOpen] : null
  const triggerRef = useMemo(() => ({ current: activeMenuButton }), [activeMenuButton])
  const closeConversationMenu = useCallback(() => setMenuOpen(null), [])
  useMenuKeyboard({ open: menuOpen !== null, menuRef, triggerRef, onClose: closeConversationMenu })

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

  return (
    <aside className="workspace-sidebar">
      <PanelResizeHandle axis="sidebar" />
      <div className="workspace-sidebar__header">
        <div>
          <div className="eyebrow">Workspace</div>
          <div className="workspace-title">Local Agent</div>
        </div>
        <button className="icon-button" aria-label="New conversation" title="New conversation" onClick={onCreateConversation} type="button">
          <Icon name="plus" size={17} />
        </button>
      </div>

      <button className="workspace-switcher" type="button" onClick={onOpenSearch} aria-label="Open workspace launcher">
        <div className="workspace-avatar">A</div>
        <div className="workspace-switcher__copy">
          <strong>AgentiCOS</strong>
          <span>Personal workspace · 1 project</span>
        </div>
        <Icon name="chevron-right" size={15} />
      </button>

      <div className="sidebar-search">
        <Icon name="search" size={14} />
        <input aria-label="Filter conversations" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter conversations…" />
        <kbd>⌘K</kbd>
      </div>

      <div className="sidebar-filters" role="tablist" aria-label="Conversation filters" aria-orientation="horizontal">
        {(['All', 'Pinned', 'Recent'] as SidebarFilter[]).map((item) => (
          <button key={item} id={'conversation-filter-' + item.toLowerCase()} type="button" role="tab" tabIndex={filter === item ? 0 : -1} aria-selected={filter === item} aria-controls="conversation-list" className={filter === item ? 'sidebar-filter sidebar-filter--active' : 'sidebar-filter'} onClick={() => setFilter(item)} onKeyDown={(event) => {
            const filters = ['All', 'Pinned', 'Recent'] as SidebarFilter[]
            const currentIndex = filters.indexOf(item)
            const nextIndex = event.key === 'ArrowRight' || event.key === 'ArrowDown'
              ? (currentIndex + 1) % filters.length
              : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                ? (currentIndex - 1 + filters.length) % filters.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? filters.length - 1 : -1
            if (nextIndex >= 0) {
              event.preventDefault()
              const next = filters[nextIndex]
              setFilter(next)
              window.requestAnimationFrame(() => document.getElementById('conversation-filter-' + next.toLowerCase())?.focus())
            }
          }}>
            {item}{item === 'Pinned' && <span>{conversations.filter((conversation) => conversation.pinned).length}</span>}
          </button>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section__title">
          <span>Conversations</span>
          <span className="count-pill">{filtered.length}</span>
        </div>
        <div id="conversation-list" className="conversation-list" role="tabpanel" aria-labelledby={"conversation-filter-" + filter.toLowerCase()} tabIndex={0}>
          {filtered.length === 0 ? (
            <div className="sidebar-empty">{query ? 'No conversations match “' + query + '”.' : 'No conversations in this filter.'}</div>
          ) : (
            filtered.map((conversation) => (
              <div className={activeConversation === conversation.id ? 'conversation-row conversation-row--active' : 'conversation-row'} key={conversation.id}>
                {editingId === conversation.id ? (
                  <div className="conversation-rename">
                    <input autoFocus aria-label="Rename conversation" value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') commitRename(conversation.id); if (event.key === 'Escape') setEditingId(null) }} />
                    <button type="button" onClick={() => commitRename(conversation.id)} aria-label="Save conversation name"><Icon name="check" size={13} /></button>
                  </div>
                ) : (
                  <>
                    <button className="conversation-main-button" onClick={() => onSelectConversation(conversation.id)} type="button">
                      <div className="conversation-row__icon"><Icon name={conversation.pinned ? 'archive' : 'message'} size={15} /></div>
                      <div className="conversation-row__copy"><strong>{conversation.title}</strong><span>{conversation.preview}</span></div>
                      <time>{new Date(conversation.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</time>
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
            ))
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="mini-status">
          <span className={runtimeConnected ? 'status-dot status-dot--live' : 'status-dot status-dot--offline'} />
          <span>{runtimeConnected ? 'Runtime online' : 'Runtime offline'}</span>
        </div>
        <button className="sidebar-footer__action" title="Command palette" aria-label="Command palette" type="button" onClick={onOpenSearch}>
          <Icon name="command" size={15} />
        </button>
      </div>
    </aside>
  )
}
