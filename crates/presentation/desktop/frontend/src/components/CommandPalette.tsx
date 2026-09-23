import { useEffect, useMemo, useRef, useState } from 'react'
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
  onToggleFocus?: () => void
  onToggleDock?: () => void
  onTogglePanels?: () => void
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
  onToggleFocus,
  onToggleDock,
  onTogglePanels,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const dialogRef = useRef<HTMLElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  const commands = useMemo<Command[]>(() => [
    { id: 'new-chat', label: 'New conversation', detail: 'Start a clean agent session', icon: 'plus', shortcut: 'N', action: onCreateConversation },
    ...(onToggleFocus ? [{ id: 'toggle-focus', label: 'Toggle focus mode', detail: 'Use the full window for the active workspace surface', icon: 'maximize' as IconName, shortcut: 'Ctrl+Shift+F', action: onToggleFocus }] : []),
    ...(onTogglePanels ? [{ id: 'toggle-panels', label: 'Toggle side panels', detail: 'Show or hide the workspace sidebar and agent inspector', icon: 'layout' as IconName, shortcut: 'Ctrl+B', action: onTogglePanels }] : []),
    ...(onToggleDock ? [{ id: 'toggle-dock', label: 'Toggle bottom dock', detail: 'Show or hide terminal, timeline, problems and output', icon: 'terminal' as IconName, shortcut: 'Ctrl+J', action: onToggleDock }] : []),
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
  ], [conversations, onCreateConversation, onSelectConversation, onSelectMode, onToggleDock, onToggleFocus, onTogglePanels])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return normalized
      ? commands.filter((command) => `${command.label} ${command.detail}`.toLowerCase().includes(normalized))
      : commands
  }, [commands, query])

  useEffect(() => {
    if (!open) {
      restoreFocusRef.current?.focus?.()
      restoreFocusRef.current = null
      return
    }
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setQuery('')
    setSelectedIndex(0)
    itemRefs.current = []
    window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => {
      restoreFocusRef.current?.focus?.()
      restoreFocusRef.current = null
    }
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const root = dialogRef.current
        if (!root) return
        const focusable = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'))
        if (focusable.length === 0) return
        const current = document.activeElement
        const index = focusable.indexOf(current as HTMLElement)
        const next = event.shiftKey
          ? focusable[(index - 1 + focusable.length) % focusable.length]
          : focusable[(index + 1) % focusable.length]
        event.preventDefault()
        next?.focus()
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

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
            role="combobox"
            aria-autocomplete="list"
            aria-controls="command-palette-results"
            aria-expanded="true"
            aria-activedescendant={filtered.length ? 'command-palette-option-' + filtered[selectedIndex]?.id : undefined}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (!filtered.length) return
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setSelectedIndex((index) => (index + 1) % filtered.length)
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setSelectedIndex((index) => (index - 1 + filtered.length) % filtered.length)
              } else if (event.key === 'Home') {
                event.preventDefault()
                setSelectedIndex(0)
              } else if (event.key === 'End') {
                event.preventDefault()
                setSelectedIndex(filtered.length - 1)
              } else if (event.key === 'Enter') {
                event.preventDefault()
                filtered[selectedIndex]?.action()
                onClose()
              }
            }}
            placeholder="Search commands, views and conversations…"
            value={query}
          />
          <button aria-label="Close command palette" className="icon-button" onClick={onClose} type="button"><Icon name="x" size={16} /></button>
        </div>

        <div className="palette-list" id="command-palette-results" role="listbox" aria-label="Commands and conversations">
          {filtered.length === 0 ? (
            <div className="palette-empty">No command matches “{query}”.</div>
          ) : filtered.map((command, index) => (
            <button
              aria-selected={index === selectedIndex}
              className={`palette-item ${index === selectedIndex ? 'palette-item--active' : ''}`}
              key={command.id}
              onClick={() => { command.action(); onClose() }}
              ref={(element) => { itemRefs.current[index] = element }}
              id={'command-palette-option-' + command.id}
              role="option"
              type="button"
              onMouseEnter={() => setSelectedIndex(index)}
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
