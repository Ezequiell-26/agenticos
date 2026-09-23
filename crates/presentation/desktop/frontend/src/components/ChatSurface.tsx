import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { ChatMessage } from '../types/runtime'
import Icon from './Icon'

interface ChatSurfaceProps {
  sessionId: string
  messages: ChatMessage[]
  disabled?: boolean
  running: boolean
  onSend: (message: string) => Promise<void>
  onStop: () => void
  onOpenPalette: () => void
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  return (
    <article className={`message-row ${isUser ? 'message-row--user' : ''}`}>
      {!isUser && (
        <div className={`message-avatar ${isSystem ? 'message-avatar--system' : ''}`}>
          <Icon name={isSystem ? 'shield' : 'bot'} size={15} />
        </div>
      )}
      <div className={`message-bubble ${isUser ? 'message-bubble--user' : ''} ${isSystem ? 'message-bubble--system' : ''}`}>
        <div className="message-meta">
          <span>{isUser ? 'You' : isSystem ? 'System' : 'AgentiCOS'}</span>
          <time>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
        </div>
        <p>{message.content}</p>
      </div>
    </article>
  )
}

export default function ChatSurface({
  sessionId,
  messages,
  disabled = false,
  running,
  onSend,
  onStop,
  onOpenPalette,
}: ChatSurfaceProps) {
  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canSend = useMemo(() => draft.trim().length > 0 && !disabled, [draft, disabled])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [sessionId])

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (canSend) void submit()
    }
  }

  async function submit() {
    const message = draft.trim()
    if (!message || disabled) return
    setDraft('')
    await onSend(message)
  }

  return (
    <section className="chat-surface">
      <header className="chat-header">
        <div className="chat-header__title">
          <div className="chat-title-icon"><Icon name="spark" size={17} /></div>
          <div><strong>Agent session</strong><span>Private runtime workspace</span></div>
        </div>
        <div className="chat-header__actions">
          <button className="soft-button" type="button" title="Search session history" onClick={onOpenPalette}><Icon name="history" size={15} />History</button>
          <button className="icon-button" aria-label="Open command palette" title="Open command palette" onClick={onOpenPalette} type="button"><Icon name="command" size={17} /></button>
        </div>
      </header>

      <div className="chat-content">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="empty-orb"><Icon name="spark" size={22} /></div>
            <span className="eyebrow">Start a run</span>
            <h1>Build with AgentiCOS.</h1>
            <p>Describe a goal, inspect a repository, plan a task or ask the agent to work through a technical problem.</p>
            <div className="starter-grid">
              <button type="button" onClick={() => setDraft('Inspect the current workspace and summarize what is missing.')}>Inspect workspace</button>
              <button type="button" onClick={() => setDraft('Plan the next implementation step without making changes.')}>Plan next step</button>
              <button type="button" onClick={() => setDraft('Check the provider/runtime connection and report status.')}>Check runtime</button>
            </div>
          </div>
        ) : (
          <div className="message-stack">
            {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
            {running && (
              <div className="message-row">
                <div className="message-avatar"><Icon name="bot" size={15} /></div>
                <div className="message-bubble message-bubble--typing" aria-label="AgentiCOS is working"><span /><span /><span /></div>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="composer-wrap">
        <div className="composer-shell">
          <textarea
            ref={textareaRef}
            aria-label="Message AgentiCOS"
            className="composer-input"
            disabled={disabled}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AgentiCOS to build, inspect or execute…"
            rows={3}
            value={draft}
          />
          <div className="composer-toolbar">
            <span className="composer-hint">Enter to send · Shift+Enter for newline</span>
            {running ? (
              <button className="send-button send-button--stop" onClick={onStop} type="button"><Icon name="stop" size={15} />Stop</button>
            ) : (
              <button className="send-button" disabled={!canSend} onClick={() => void submit()} type="button"><Icon name="send" size={15} />Send</button>
            )}
          </div>
        </div>
      </footer>
    </section>
  )
}
