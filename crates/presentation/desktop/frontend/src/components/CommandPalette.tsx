import { useEffect, useMemo, useRef, useState } from 'react'
import type { ConversationSummary } from '../types/runtime'
import Icon, { type IconName } from './Icon'

interface CommandPaletteProps {
  open: boolean
  conversations: ConversationSummary[]
  onClose: () => void
  onSelectConversation: (id: string) => void
  onCreateConversation: () => void
  onSelectMode: (mode: 'chat' | 'files' | 'runs' | 'providers' | 'settings') => void
}

interface Command {
  id: string
  label: string
  detail: string
  icon: IconName
  action: () => void
}

export default function CommandPalette({
  open,
  conversations,
  onClose,
  onSelectConversation,
  onCreateConversation,
  onSelectMode,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const commands = useMemo<Command[]>(() => {
    const navigation: Command[] = [
      { id: 'new-chat', label: 'New conversation', detail: 'Start a clean agent session', icon: 'plus', action: onCreateConversation },
      { id: 'chat', label: 'Open Command Center', detail: 'Return to the primary agent workspace', icon: 'message', action: () => onSelectMode('chat') },
      { id: 'files', label: 'Open workspace explorer', detail: 'Files and project context', icon: 'folder', action: () => onSelectMode('files') },
      { id: 'runs', label: 'Open agent runs', detail: 'Execution and verification timeline', icon: 'activity', action: () => onSelectMode('runs') },
      { id: 'providers', label: 'Open providers', detail: 'Models, quotas and runtime health', icon: 'bot', action: () => onSelectMode('providers') },
      { id: 'settings', label: 'Open settings', detail: 'Runtime and workspace controls', icon: 'settings', action: () => onSelectMode('settings') },
    ]

    const conversationCommands: Command[] = conversations.slice(0, 5).map((conversation) => ({
      id: `conversation-${conversation.id}`,
      label: conversation.title,
      detail: conversation.preview,
      icon: conversation.pinned ? 'archive' : 'history',
      action: () => onSelectConversation(conversation.id),
    }))

    return [...navigation, ...conversationCommands]
  }, [conversations, onCreateConversation, onSelectConversation, onSelectMode])

  const filtered = commands.filter((command) => {
    const value = `${command.label} ${command.detail}`.toLowerCase()
    return value.includes(query.toLowerCase())
  })

  if (!open) return null

  return (
    <div className="palette-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="command-palette" aria-label="Command palette" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="palette-search">
          <Icon name="search" size={18} />
          <input ref={inputRef} aria-label="Search commands" onChange={(event) => setQuery(event.target.value)} placeholder="Search commands and conversations…" value={query} />
          <button aria-label="Close command palette" className="icon-button" onClick={onClose} type="button"><Icon name="x" size={16} /></button>
        </div>
        <div className="palette-list">
          {filtered.length === 0 ? (
            <div className="palette-empty">No commands or conversations match “{query}”.</div>
          ) : filtered.map((command) => (
            <button className="palette-item" key={command.id} onClick={() => { command.action(); onClose() }} type="button">
              <span className="palette-item__icon"><Icon name={command.icon} size={16} /></span>
              <span className="palette-item__copy"><strong>{command.label}</strong><small>{command.detail}</small></span>
              <Icon name="chevron-right" size={14} />
            </button>
          ))}
        </div>
        <div className="palette-footer"><span>Press</span><kbd>ESC</kbd><span>to close</span></div>
      </section>
    </div>
  )
}
