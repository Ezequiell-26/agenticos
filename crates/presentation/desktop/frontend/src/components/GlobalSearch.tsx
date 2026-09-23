import { useEffect, useMemo, useRef, useState } from 'react'
import type { ConversationSummary } from '../types/runtime'
import { navigationItems, type RailMode } from '../navigation'
import Icon, { type IconName } from './Icon'

interface SearchItem {
  id: string
  label: string
  detail: string
  group: string
  icon: IconName
  mode?: RailMode
  conversationId?: string
}

interface GlobalSearchProps {
  open: boolean
  conversations: ConversationSummary[]
  onClose: () => void
  onSelectMode: (mode: RailMode) => void
  onSelectConversation: (id: string) => void
}

const supplementalItems: SearchItem[] = [
  { id: 'settings-ai', label: 'AI & Agent settings', detail: 'Models, reasoning, autonomy and subagents', group: 'Settings', icon: 'bot', mode: 'settings' },
  { id: 'settings-security', label: 'Execution & Security', detail: 'Permissions, sandbox and network policy', group: 'Settings', icon: 'lock', mode: 'settings' },
  { id: 'settings-editor', label: 'Editor, Git & Verification', detail: 'Autocomplete, VCS and verification', group: 'Settings', icon: 'code', mode: 'settings' },
  { id: 'settings-customize', label: 'Customizations', detail: 'Rules, skills, plugins, MCP and agents', group: 'Settings', icon: 'spark', mode: 'settings' },
  { id: 'model-router', label: 'Model routing', detail: 'Providers, fallback and auxiliary models', group: 'Configuration', icon: 'network', mode: 'providers' },
  { id: 'permission-matrix', label: 'Effective permissions', detail: 'Allow / ask / deny policy preview', group: 'Security', icon: 'shield', mode: 'security' },
  { id: 'context-inspector', label: 'Context inspector', detail: 'Context packs, memory and token budget', group: 'Build', icon: 'archive', mode: 'context' },
  { id: 'run-center', label: 'Run Center', detail: 'Execution timelines, tools and verification', group: 'Operations', icon: 'activity', mode: 'runs' },
  { id: 'mcp-manager', label: 'MCP manager', detail: 'Servers, tools, resources and authentication', group: 'Integrations', icon: 'network', mode: 'mcp' },
  { id: 'browser-workspace', label: 'Browser workspace', detail: 'Browser sessions, DevTools and recordings', group: 'Integrations', icon: 'globe', mode: 'browser' },
]

export default function GlobalSearch({
  open,
  conversations,
  onClose,
  onSelectMode,
  onSelectConversation,
}: GlobalSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const items = useMemo<SearchItem[]>(() => [
    ...navigationItems.map((item) => ({ id: `nav-${item.id}`, label: item.label, detail: item.detail, group: item.group, icon: item.icon, mode: item.id })),
    ...supplementalItems,
    ...conversations.slice(0, 12).map((conversation) => ({
      id: `conversation-${conversation.id}`,
      label: conversation.title,
      detail: conversation.preview,
      group: 'Sessions',
      icon: conversation.pinned ? 'archive' as IconName : 'history' as IconName,
      conversationId: conversation.id,
    })),
  ], [conversations])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return items.slice(0, 24)
    return items
      .filter((item) => `${item.label} ${item.detail} ${item.group}`.toLowerCase().includes(term))
      .slice(0, 30)
  }, [items, query])

  useEffect(() => {
    if (!open) {
      restoreFocusRef.current?.focus?.()
      restoreFocusRef.current = null
      return
    }
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setQuery('')
    setSelectedIndex(0)
    window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => {
      restoreFocusRef.current?.focus?.()
      restoreFocusRef.current = null
    }
  }, [open])

  useEffect(() => setSelectedIndex(0), [query])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const isSearchField = target instanceof HTMLInputElement
      if (event.key === 'Tab') {
        const root = dialogRef.current
        if (!root) return
        const focusable = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'))
        if (focusable.length === 0) return
        const index = focusable.indexOf(document.activeElement as HTMLElement)
        const next = event.shiftKey
          ? focusable[(index - 1 + focusable.length) % focusable.length]
          : focusable[(index + 1) % focusable.length]
        event.preventDefault()
        next?.focus()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (isSearchField && event.key === 'ArrowDown' && filtered.length) {
        event.preventDefault()
        setSelectedIndex((index) => (index + 1) % filtered.length)
      } else if (isSearchField && event.key === 'ArrowUp' && filtered.length) {
        event.preventDefault()
        setSelectedIndex((index) => (index - 1 + filtered.length) % filtered.length)
      } else if (isSearchField && event.key === 'Home' && filtered.length) {
        event.preventDefault()
        setSelectedIndex(0)
      } else if (isSearchField && event.key === 'End' && filtered.length) {
        event.preventDefault()
        setSelectedIndex(filtered.length - 1)
      } else if (isSearchField && event.key === 'Enter' && filtered.length) {
        event.preventDefault()
        const item = filtered[selectedIndex]
        if (item?.mode) onSelectMode(item.mode)
        if (item?.conversationId) onSelectConversation(item.conversationId)
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [filtered, onClose, onSelectConversation, onSelectMode, open, selectedIndex])

  if (!open) return null

  return (
    <div className="palette-backdrop" role="presentation" onMouseDown={onClose}>
      <section ref={dialogRef} className="global-search" role="dialog" aria-modal="true" aria-label="Universal search" onMouseDown={(event) => event.stopPropagation()}>
        <div className="global-search__head">
          <Icon name="search" size={17} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search anything in AgentiCOS…"
            aria-label="Search anything in AgentiCOS"
            role="combobox"
            aria-expanded="true"
            aria-controls="global-search-results"
            aria-activedescendant={filtered[selectedIndex] ? `global-search-result-${filtered[selectedIndex].id}` : undefined}
          />
          <span className="global-search__hint">Quick search</span>
          <button type="button" className="icon-button" aria-label="Close search" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="global-search__meta">{filtered.length} result{filtered.length === 1 ? '' : 's'} · navigation, settings, sessions and platform surfaces</div>
        <div id="global-search-results" className="global-search__list" role="listbox" aria-label="Search results">
          {filtered.map((item, index) => (
            <button
  type="button"
  id={`global-search-result-${item.id}`}
  role="option"
  aria-selected={index === selectedIndex}
  key={item.id}
  className={index === selectedIndex ? 'global-search__row global-search__row--active' : 'global-search__row'} onMouseEnter={() => setSelectedIndex(index)}
  onClick={() => { if (item.mode) onSelectMode(item.mode); if (item.conversationId) onSelectConversation(item.conversationId); onClose() }}
>
              <span className="global-search__icon"><Icon name={item.icon} size={14} /></span>
              <span><strong>{item.label}</strong><small>{item.detail}</small></span>
              <em>{item.group}</em>
              <Icon name="chevron-right" size={13} />
            </button>
          ))}
          {filtered.length === 0 && <div className="global-search__empty">No result for “{query}”.</div>}
        </div>
        <div className="global-search__foot"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>Enter</kbd> Open</span><span><kbd>Esc</kbd> Close</span></div>
      </section>
    </div>
  )
}
