import { useEffect, useMemo, useRef, useState } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { ConversationSummary } from '../types/runtime'
import type { RailMode } from '../navigation'
import { navigationItems } from '../navigation'
import { navigationSectionLabel } from '../navigation-taxonomy'
import Icon, { type IconName } from './Icon'

interface CommandPaletteProps {
  open: boolean
  conversations: ConversationSummary[]
  onClose: () => void
  onSelectConversation: (id: string) => void
  onCreateConversation: () => void
  onSelectMode: (mode: RailMode) => void
  onOpenShortcuts?: () => void
}

interface Command {
  id: string
  label: string
  detail: string
  icon: IconName
  shortcut?: string
  action: () => void
}

export default function CommandPalette({
  open,
  conversations,
  onClose,
  onSelectConversation,
  onCreateConversation,
  onSelectMode,
  onOpenShortcuts,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const dialogRef = useRef<HTMLElement>(null)

  const commands = useMemo<Command[]>(() => [
    { id: 'new-chat', label: 'New conversation', detail: 'Start a clean agent session', icon: 'plus', shortcut: 'N', action: onCreateConversation },
    ...(onOpenShortcuts ? [{ id: 'shortcuts', label: 'Keyboard shortcuts', detail: 'Open the global workspace shortcut center', icon: 'command' as IconName, shortcut: '?', action: onOpenShortcuts }] : []),
    ...navigationItems.map((item) => ({
      id: item.id,
      label: item.label,
      detail: navigationSectionLabel(item.id) + ' · ' + item.detail,
      icon: item.icon,
      action: () => onSelectMode(item.id),
    })),
    ...conversations.slice(0, 8).map((conversation) => ({
      id: `conversation-${conversation.id}`,
      label: conversation.title,
      detail: conversation.preview,
      icon: conversation.pinned ? 'archive' as IconName : 'history' as IconName,
      action: () => onSelectConversation(conversation.id),
    })),
  ], [conversations, onCreateConversation, onOpenShortcuts, onSelectConversation, onSelectMode])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return normalized
      ? commands.filter((command) => `${command.label} ${command.detail}`.toLowerCase().includes(normalized))
      : commands
  }, [commands, query])

  useFocusTrap(open, dialogRef, inputRef)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelectedIndex(0)
    itemRefs.current = []
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (filtered.length === 0) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((index) => (index + 1) % filtered.length)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((index) => (index - 1 + filtered.length) % filtered.length)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        filtered[selectedIndex]?.action()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [filtered, onClose, open, selectedIndex])

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!open) return null

  return (
    <div className="palette-backdrop" role="presentation" onMouseDown={onClose}>
      <section ref={dialogRef} className="command-palette" aria-label="Command palette" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="palette-search">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            aria-label="Search commands"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search commands, views and conversations…"
            value={query}
          />
          <button aria-label="Close command palette" className="icon-button" onClick={onClose} type="button"><Icon name="x" size={16} /></button>
        </div>

        <div className="palette-list" role="listbox" aria-label="Commands and conversations">
          {filtered.length === 0 ? (
            <div className="palette-empty">No command matches “{query}”.</div>
          ) : filtered.map((command, index) => (
            <button
              aria-selected={index === selectedIndex}
              className={`palette-item ${index === selectedIndex ? 'palette-item--active' : ''}`}
              key={command.id}
              onClick={() => { command.action(); onClose() }}
              ref={(element) => { itemRefs.current[index] = element }}
              role="option"
              type="button"
            >
              <span className="palette-item__icon"><Icon name={command.icon} size={16} /></span>
              <span className="palette-item__copy"><strong>{command.label}</strong><small>{command.detail}</small></span>
              {command.shortcut ? <kbd>{command.shortcut}</kbd> : <Icon name="chevron-right" size={14} />}
            </button>
          ))}
        </div>

        <div className="palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Open</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </section>
    </div>
  )
}
