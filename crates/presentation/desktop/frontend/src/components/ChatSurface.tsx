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

const models = ['Auto route', 'GPT-OSS 120B', 'Qwen3 Coder', 'DeepSeek', 'Local model']

function MessageBubble({ message, onAction }: { message: ChatMessage; onAction: (action: string) => void }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  return (
    <article className={`message-row ${isUser ? 'message-row--user' : ''}`}>
      {!isUser && <div className={`message-avatar ${isSystem ? 'message-avatar--system' : ''}`}><Icon name={isSystem ? 'shield' : 'bot'} size={15} /></div>}
      <div className={`message-bubble ${isUser ? 'message-bubble--user' : ''} ${isSystem ? 'message-bubble--system' : ''}`}>
        <div className="message-meta">
          <span>{isUser ? 'You' : isSystem ? 'System' : 'AgentiCOS'}</span>
          <time>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
        </div>
        <p>{message.content}</p>
        {!isSystem && !isUser && (
          <div className="message-actions">
            <button type="button" title="Copy response" onClick={() => onAction('Response copied')}><Icon name="copy" size={13} /></button>
            <button type="button" title="Regenerate response" onClick={() => onAction('Regenerate queued in preview')}><Icon name="history" size={13} /></button>
            <button type="button" title="Open response tools" onClick={() => onAction('Response actions opened')}><Icon name="more" size={13} /></button>
          </div>
        )}
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
  const [model, setModel] = useState(models[0])
  const [toolsOpen, setToolsOpen] = useState(false)
  const [webAccess, setWebAccess] = useState(false)
  const [deepMode, setDeepMode] = useState(true)
  const [attachedFiles, setAttachedFiles] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canSend = useMemo(() => draft.trim().length > 0 && !disabled, [draft, disabled])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [sessionId])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 1800)
    return () => window.clearTimeout(timer)
  }, [notice])

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (canSend) void submit()
    }
  }

  function attachPreviewFile() {
    const next = attachedFiles.length === 0 ? 'workspace-context.md' : attachedFiles.length === 1 ? 'frontend-snapshot.json' : ''
    if (!next) {
      setNotice('Attachment limit reached in preview')
      return
    }
    setAttachedFiles((current) => [...current, next])
    setNotice(`${next} attached`)
  }

  async function submit() {
    const message = draft.trim()
    if (!message || disabled) return
    setDraft('')
    await onSend(message)
  }

  function useStarter(prompt: string) {
    setDraft(prompt)
    window.requestAnimationFrame(() => textareaRef.current?.focus())
  }

  return (
    <section className="chat-surface">
      <header className="chat-header">
        <div className="chat-header__title">
          <div className="chat-title-icon"><Icon name="spark" size={17} /></div>
          <div><strong>Agent session</strong><span>Private runtime workspace</span></div>
        </div>
        <div className="chat-header__actions">
          <div className="model-chip"><span className="status-dot status-dot--live" /><select value={model} onChange={(event) => { setModel(event.target.value); setNotice(`Model: ${event.target.value}`) }} aria-label="Select model">{models.map((item) => <option key={item}>{item}</option>)}</select></div>
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
            <div className="starter-grid starter-grid--large">
              <button type="button" onClick={() => useStarter('Inspect the current workspace and summarize what is missing.')}>Inspect workspace<small>Architecture + gaps</small></button>
              <button type="button" onClick={() => useStarter('Plan the next implementation step without making changes.')}>Plan next step<small>Fail-closed planning</small></button>
              <button type="button" onClick={() => useStarter('Review the current frontend for regressions and usability issues.')}>Review frontend<small>UX + quality pass</small></button>
              <button type="button" onClick={() => useStarter('Design the ideal provider and model control center UI.')}>Design model plane<small>Providers + routing</small></button>
              <button type="button" onClick={() => useStarter('Create a professional test and verification plan.')}>Create test plan<small>Evidence first</small></button>
              <button type="button" onClick={() => useStarter('Explain the current project architecture in practical terms.')}>Explain architecture<small>Runtime + UI</small></button>
            </div>
          </div>
        ) : (
          <div className="message-stack">
            {messages.map((message) => <MessageBubble key={message.id} message={message} onAction={setNotice} />)}
            {running && <div className="message-row"><div className="message-avatar"><Icon name="bot" size={15} /></div><div className="message-bubble message-bubble--typing" aria-label="AgentiCOS is working"><span /><span /><span /></div></div>}
          </div>
        )}
      </div>

      <footer className="composer-wrap">
        <div className="composer-shell">
          {attachedFiles.length > 0 && <div className="attachment-strip">{attachedFiles.map((file) => <span className="attachment-chip" key={file}><Icon name="paperclip" size={12} />{file}<button type="button" onClick={() => setAttachedFiles((current) => current.filter((item) => item !== file))} aria-label={`Remove ${file}`}>×</button></span>)}</div>}
          {toolsOpen && (
            <div className="composer-tools">
              <button type="button" className={webAccess ? 'composer-tool--active' : ''} onClick={() => setWebAccess((value) => !value)}><Icon name="search" size={13} /> Web access</button>
              <button type="button" className={deepMode ? 'composer-tool--active' : ''} onClick={() => setDeepMode((value) => !value)}><Icon name="spark" size={13} /> Deep reasoning</button>
              <button type="button" onClick={() => setNotice('Tool selection opened in preview')}><Icon name="tool" size={13} /> Tool picker</button>
            </div>
          )}
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
            <div className="composer-actions">
              <button className="composer-icon" type="button" title="Attach file" onClick={attachPreviewFile}><Icon name="paperclip" size={15} /></button>
              <button className={`composer-icon ${toolsOpen ? 'composer-icon--active' : ''}`} type="button" title="Composer tools" onClick={() => setToolsOpen((value) => !value)}><Icon name="tool" size={15} /></button>
              <span className="context-chip"><Icon name="folder" size={12} /> Workspace</span>
              <span className="context-chip"><Icon name="code" size={12} /> 7.8k context</span>
            </div>
            <span className="composer-hint">{webAccess ? 'Web on' : 'Local context'} · {deepMode ? 'Deep' : 'Fast'} · Enter to send</span>
            {running ? (
              <button className="send-button send-button--stop" onClick={onStop} type="button"><Icon name="stop" size={15} />Stop</button>
            ) : (
              <button className="send-button" disabled={!canSend} onClick={() => void submit()} type="button"><Icon name="send" size={15} />Send</button>
            )}
          </div>
        </div>
        {notice && <div className="composer-notice">{notice}</div>}
      </footer>
    </section>
  )
}
