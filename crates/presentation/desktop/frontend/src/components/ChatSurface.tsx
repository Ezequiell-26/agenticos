import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { ChatMessage, ChatSendOptions, ConversationSummary } from '../types/runtime'
import Icon from './Icon'
import AgentRunDrawer from '../features/chat/AgentRunDrawer'
import { useExclusiveOverlay } from '../hooks/useExclusiveOverlay'
import AgentModeStrip, { type AgentMode } from '../features/chat/AgentModeStrip'

interface ChatSurfaceProps {
  sessionId: string
  messages: ChatMessage[]
  disabled?: boolean
  running: boolean
  onSend: (message: string, options?: ChatSendOptions) => Promise<void>
  availableModels?: string[]
  onStop: () => void
  onOpenPalette: () => void
  sessions?: ConversationSummary[]
  onSelectSession?: (id: string) => void
  onCreateSession?: () => void
  browserPanelVisible?: boolean
  onToggleBrowserPanel?: () => void
}

const defaultModels = ['GPT-OSS 120B', 'Qwen3 Coder', 'DeepSeek', 'Local model']
const agents = ['Builder', 'Reviewer', 'Researcher', 'Planner']
const contextScopes = ['Workspace', 'Current file', 'Selection', 'Pinned memory', 'Custom']
const effortLevels = ['Minimal', 'Low', 'Medium', 'High', 'Extra high', 'Maximum', 'Ultra']
const responseFormats = ['Markdown', 'Plain text', 'Structured', 'Code first'] as const
const slashCommands = [
  ['/plan', 'Create a step-by-step plan without editing.'],
  ['/review', 'Review the current workspace for issues.'],
  ['/debug', 'Diagnose the current problem and isolate the cause.'],
  ['/research', 'Gather evidence before proposing a change.'],
  ['/compact', 'Summarize the current conversation into reusable context.'],
  ['/delegate', 'Delegate a subtask to a specialist agent.'],
  ['/rollback', 'Open checkpoint restore controls.'],
  ['/memory', 'Inspect or capture persistent memory.'],
  ['/session-search', 'Search previous sessions.'],
  ['/cron', 'Manage scheduled tasks.'],
  ['/skills', 'Browse procedural skills.'],
  ['/tools', 'Inspect tools and toolsets.'],
  ['/mcp', 'Inspect MCP servers.'],
  ['/browser', 'Open browser control.'],
  ['/gateway', 'Inspect messaging gateway.'],
] as const

function MessageBubble({ message, onAction, onCopy }: { message: ChatMessage; onAction: (action: string) => void; onCopy: (content: string) => void }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (!isUser && !isSystem) {
    return (
      <article className="message-row message-row--assistant">
        <p className="assistant-text">{message.content}</p>
      </article>
    )
  }

  return (
    <article className={`message-row ${isUser ? 'message-row--user' : ''}`}>
      {!isUser && <div className={`message-avatar ${isSystem ? 'message-avatar--system' : ''}`}><Icon name={isSystem ? 'shield' : 'bot'} size={15} /></div>}
      <div className={`message-bubble ${isUser ? 'message-bubble--user' : ''} ${isSystem ? 'message-bubble--system' : ''}`}>
        <div className="message-meta"><span>{isUser ? 'You' : isSystem ? 'System' : 'AgentiCOS'}</span><time>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>
        <p>{message.content}</p>
        {!isSystem && !isUser && <div className="message-actions"><button type="button" title="Copy response" onClick={() => void onCopy(message.content)}><Icon name="copy" size={13} /></button><button type="button" title="Regenerate response" onClick={() => onAction('Regenerate queued in preview')}><Icon name="history" size={13} /></button><button type="button" title="Open response tools" onClick={() => onAction('Response actions opened')}><Icon name="more" size={13} /></button></div>}
      </div>
    </article>
  )
}

export default function ChatSurface({ sessionId, messages, disabled = false, running, onSend, onStop, onOpenPalette, sessions = [], onSelectSession, onCreateSession, browserPanelVisible = false, onToggleBrowserPanel, availableModels = [] }: ChatSurfaceProps) {
  const [draft, setDraft] = useState('')
  const modelOptions = useMemo(() => Array.from(new Set(['Auto route', ...(availableModels.length > 0 ? availableModels : defaultModels)])), [availableModels])
  const [model, setModel] = useState('Auto route')
  const [agent, setAgent] = useState(agents[0])
  const [agentMode, setAgentMode] = useState<AgentMode>('Agent')
  const [contextScope, setContextScope] = useState(contextScopes[0])
  const [effort, setEffort] = useState(effortLevels[effortLevels.length - 1])
  const [effortOpen, setEffortOpen] = useState(false)
  const [plusOpen, setPlusOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [modelQuery, setModelQuery] = useState('')
  const [reasoningOn, setReasoningOn] = useState(true)
  const [maxTokens, setMaxTokens] = useState('8192')
  const [temperature, setTemperature] = useState('0.3')
  const [responseFormat, setResponseFormat] = useState<ChatSendOptions['responseFormat']>(responseFormats[0])
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashIndex, setSlashIndex] = useState(0)
  const [showReasoning, setShowReasoning] = useState(true)
  const [showCitations, setShowCitations] = useState(true)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [webAccess, setWebAccess] = useState(false)
  const [codeMode, setCodeMode] = useState(true)
  const [deepMode, setDeepMode] = useState(true)
  const [rememberContext, setRememberContext] = useState(true)
  const [attachedFiles, setAttachedFiles] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [runDrawerOpen, setRunDrawerOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const composerMenusRef = useRef<HTMLDivElement>(null)
  useExclusiveOverlay('agent-run', runDrawerOpen, () => setRunDrawerOpen(false))
  useExclusiveOverlay('composer-plus', plusOpen, () => setPlusOpen(false))
  useExclusiveOverlay('effort-options', effortOpen, () => setEffortOpen(false))
  useExclusiveOverlay('model-options', modelOpen, () => setModelOpen(false))
  useExclusiveOverlay('slash-commands', slashOpen, () => setSlashOpen(false))

  const canSend = useMemo(() => draft.trim().length > 0 && !disabled, [draft, disabled])
  const slashMatches = useMemo(() => { const normalized = draft.trim().toLowerCase(); if (!normalized.startsWith('/')) return slashCommands; return slashCommands.filter(([command, description]) => (command + ' ' + description).toLowerCase().includes(normalized)) }, [draft])

  useEffect(() => { setSlashIndex(0) }, [slashMatches.length, slashOpen])
  const filteredModels = useMemo(() => {
    const term = modelQuery.trim().toLowerCase()
    return modelOptions.filter((item) => !term || item.toLowerCase().includes(term))
  }, [modelOptions, modelQuery])
  const effortLabel = effort === 'Ultra' ? 'Ultra→Max' : effort

  useEffect(() => {
    if (model !== 'Auto route' && !modelOptions.includes(model)) setModel('Auto route')
  }, [model, modelOptions])

  useEffect(() => {
    textareaRef.current?.focus()
    setSlashOpen(false)
    try { const savedDraft = window.localStorage.getItem('agenticos.draft.' + sessionId); setDraft(savedDraft ?? '') } catch { setDraft('') }
  }, [sessionId])

  useEffect(() => {
    try { if (draft) window.localStorage.setItem('agenticos.draft.' + sessionId, draft); else window.localStorage.removeItem('agenticos.draft.' + sessionId) } catch { /* optional draft persistence */ }
  }, [draft, sessionId])

  useEffect(() => {
    if (!plusOpen && !effortOpen && !modelOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!composerMenusRef.current?.contains(event.target as Node)) {
        setPlusOpen(false)
        setEffortOpen(false)
        setModelOpen(false)
      }
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPlusOpen(false)
        setEffortOpen(false)
        setModelOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [plusOpen, effortOpen, modelOpen])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 1900)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: running ? 'smooth' : 'auto', block: 'end' })
  }, [messages, running])

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (slashOpen && slashMatches.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSlashIndex((index) => (index + 1) % slashMatches.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSlashIndex((index) => (index - 1 + slashMatches.length) % slashMatches.length)
        return
      }
      if (event.key === 'Tab') {
        event.preventDefault()
        const [command, description] = slashMatches[slashIndex]
        useSlashCommand(command, description)
        return
      }
      if (event.key === 'Enter' && !event.shiftKey && draft.trimStart().startsWith('/')) {
        event.preventDefault()
        const [command, description] = slashMatches[slashIndex]
        useSlashCommand(command, description)
        return
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (canSend) void submit()
    }
  }

  async function copyResponse(content: string) {
    try {
      await navigator.clipboard.writeText(content)
      setNotice('Response copied to clipboard')
    } catch {
      setNotice('Clipboard access is unavailable in this surface')
    }
  }

  function addAttachment() {
    const candidates = ['workspace-context.md', 'frontend-snapshot.json', 'architecture-plan.md', 'selection.diff']
    const next = candidates.find((file) => !attachedFiles.includes(file))
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
    setSlashOpen(false)
    try {
      await onSend(message, {
        model: model === 'Auto route' ? undefined : model,
        maxTokens: Number(maxTokens),
        temperature: Number(temperature),
        responseFormat,
      })
    } catch {
      setDraft(message)
      setNotice('Request failed. Your message was restored.')
      window.requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }

  function useSlashCommand(command: string, description: string) {
    setDraft(command + ' ' + description)
    setSlashOpen(false)
    window.requestAnimationFrame(() => textareaRef.current?.focus())
  }

  return (
    <section className="chat-surface">
      {sessions.length > 0 && (
        <div className="session-tabs" role="tablist" aria-label="Open sessions">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              role="tab"
              aria-selected={session.id === sessionId}
              className={session.id === sessionId ? 'session-tab session-tab--active' : 'session-tab'}
              onClick={() => onSelectSession?.(session.id)}
            >
              <span className={session.id === sessionId ? 'session-tab__dot session-tab__dot--active' : 'session-tab__dot'} aria-hidden="true" />
              {session.title}
            </button>
          ))}
          <button type="button" className="session-tab session-tab--new" aria-label="New session" title="New session · Ctrl+N" onClick={onCreateSession}>
            <Icon name="plus" size={14} />
          </button>
          {onToggleBrowserPanel && (
            <button
              type="button"
              className={browserPanelVisible ? 'session-tab session-tab--new session-tab--toggle-active' : 'session-tab session-tab--new'}
              aria-label="Browser panel"
              aria-pressed={browserPanelVisible}
              title={browserPanelVisible ? 'Hide browser panel' : 'Open browser panel'}
              onClick={onToggleBrowserPanel}
            >
              <Icon name="globe" size={14} />
            </button>
          )}
        </div>
      )}
      {advancedOpen && (
        <div className="chat-control-stack">
          <AgentModeStrip mode={agentMode} onAction={setNotice} onChange={setAgentMode} />
        <div className="chat-control-bar">
          <label><span>Agent</span><select value={agent} onChange={(event) => setAgent(event.target.value)}>{agents.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Context</span><select value={contextScope} onChange={(event) => setContextScope(event.target.value)}>{contextScopes.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Effort</span><select value={effort} onChange={(event) => setEffort(event.target.value)}>{effortLevels.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Max output</span><select value={maxTokens} onChange={(event) => setMaxTokens(event.target.value)}>{['2048','4096','8192','16384','32768'].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Temperature</span><select value={temperature} onChange={(event) => setTemperature(event.target.value)}>{['0.0','0.2','0.3','0.5','0.7','1.0'].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Format</span><select value={responseFormat} onChange={(event) => setResponseFormat(event.target.value as ChatSendOptions['responseFormat'])}>{responseFormats.map((item) => <option key={item}>{item}</option>)}</select></label>
          <button type="button" className={`control-pill ${deepMode ? 'control-pill--active' : ''}`} onClick={() => setDeepMode((value) => !value)}><Icon name="spark" size={12} /> Deep</button>
          <button type="button" className={`control-pill ${codeMode ? 'control-pill--active' : ''}`} onClick={() => setCodeMode((value) => !value)}><Icon name="code" size={12} /> Code</button>
          <button type="button" className={`control-pill ${webAccess ? 'control-pill--active' : ''}`} onClick={() => setWebAccess((value) => !value)}><Icon name="search" size={12} /> Web</button>
          <button type="button" className={`control-pill ${rememberContext ? 'control-pill--active' : ''}`} onClick={() => setRememberContext((value) => !value)}><Icon name="history" size={12} /> Memory</button>
          <button type="button" className={`control-pill ${showReasoning ? 'control-pill--active' : ''}`} onClick={() => setShowReasoning((value) => !value)}><Icon name="activity" size={12} /> Reasoning</button>
          <button type="button" className={`control-pill ${showCitations ? 'control-pill--active' : ''}`} onClick={() => setShowCitations((value) => !value)}><Icon name="archive" size={12} /> Citations</button>
        </div>
        </div>
      )}

      <div className="chat-content" aria-busy={running}>
        {messages.length > 0 ? (
          <div className="message-stack">
            {messages.map((message) => <MessageBubble key={message.id} message={message} onAction={setNotice} onCopy={(content) => void copyResponse(content)} />)}
            {running && <div className="message-row"><div className="message-avatar"><Icon name="bot" size={15} /></div><div className="message-bubble message-bubble--typing" aria-label="AgentiCOS is working"><span /><span /><span /></div></div>}
            <div ref={messagesEndRef} aria-hidden="true" />
          </div>
        ) : (
          <div className="chat-wordmark" aria-hidden="true">
            <strong>AGENTICOS</strong>
            <span>Ask a question, paste an error or tell the agent what to build.</span>
          </div>
        )}
      </div>

      <footer className="composer-wrap">
        <div className="composer-shell composer-shell--hermes" ref={composerMenusRef}>
          {slashOpen && <div className="slash-command-menu" role="listbox" aria-label="Slash commands">{slashMatches.map(([command, description], index) => <button type="button" role="option" aria-selected={index === slashIndex} className={index === slashIndex ? 'slash-command--active' : ''} key={command} onClick={() => useSlashCommand(command, description)}><span className="slash-command-name">{command}</span><span>{description}</span><kbd>{index === slashIndex ? 'Tab' : ''}</kbd></button>)}{slashMatches.length === 0 && <div className="slash-command-empty">No command matches the current input.</div>}</div>}
          {attachedFiles.length > 0 && <div className="attachment-strip">{attachedFiles.map((file) => <span className="attachment-chip" key={file}><Icon name="paperclip" size={12} />{file}<button type="button" onClick={() => setAttachedFiles((current) => current.filter((item) => item !== file))} aria-label={`Remove ${file}`} title={`Remove ${file}`}><Icon name="x" size={11} /></button></span>)}</div>}
          {toolsOpen && (
            <div className="composer-tools">
              <button type="button" className={webAccess ? 'composer-tool--active' : ''} onClick={() => setWebAccess((value) => !value)}><Icon name="search" size={13} /> Web access</button>
              <button type="button" className={deepMode ? 'composer-tool--active' : ''} onClick={() => setDeepMode((value) => !value)}><Icon name="spark" size={13} /> Deep reasoning</button>
              <button type="button" className={codeMode ? 'composer-tool--active' : ''} onClick={() => setCodeMode((value) => !value)}><Icon name="code" size={13} /> Code mode</button>
              <button type="button" className="composer-tool--active" onClick={() => setNotice('Tool picker opened in preview')}><Icon name="tool" size={13} /> Tool picker</button>
              <button type="button" className={rememberContext ? 'composer-tool--active' : ''} onClick={() => setRememberContext((value) => !value)}><Icon name="history" size={13} /> Remember context</button>
            </div>
          )}
          <div className="composer-row">
            <div className="composer-plus-wrap">
              <button
                className={`composer-icon composer-icon--plus ${plusOpen ? 'composer-icon--active' : ''}`}
                type="button"
                title="Add context and actions"
                aria-label="Add context and actions"
                aria-haspopup="menu"
                aria-expanded={plusOpen}
                onClick={() => { setPlusOpen((value) => !value); setEffortOpen(false) }}
              ><Icon name="plus" size={15} /></button>
              {plusOpen && (
                <div className="composer-plus-menu" role="menu" aria-label="Add context and actions">
                  <div className="composer-plus-menu__label">Add context</div>
                  {['@files', '@diff', '@memory', '@rules', '@terminal', '@url'].map((token) => (
                    <button key={token} type="button" role="menuitem" onClick={() => { setDraft((current) => `${current}${current.endsWith(' ') || !current ? '' : ' '}${token} `); setPlusOpen(false) }}>
                      <Icon name="paperclip" size={13} /><span>{token}</span>
                    </button>
                  ))}
                  <div className="composer-plus-menu__label">Actions</div>
                  <button type="button" role="menuitem" onClick={() => { setPlusOpen(false); addAttachment() }}><Icon name="paperclip" size={13} /><span>Attach file</span></button>
                  <button type="button" role="menuitem" onClick={() => { setPlusOpen(false); setToolsOpen((value) => !value) }}><Icon name="tool" size={13} /><span>Composer tools</span></button>
                  <button type="button" role="menuitem" onClick={() => { setPlusOpen(false); setAdvancedOpen((value) => !value) }}><Icon name="settings" size={13} /><span>Agent controls</span></button>
                  <button type="button" role="menuitem" onClick={() => { setPlusOpen(false); setRunDrawerOpen((value) => !value) }}><Icon name="activity" size={13} /><span>Run trace</span></button>
                  <button type="button" role="menuitem" onClick={() => { setPlusOpen(false); onOpenPalette() }}><Icon name="history" size={13} /><span>Session history</span></button>
                  <button type="button" role="menuitem" onClick={() => { setPlusOpen(false); onOpenPalette() }}><Icon name="command" size={13} /><span>Command palette</span></button>
                  <div className="composer-plus-menu__label">Session</div>
                  <button type="button" role="menuitem" onClick={() => { setPlusOpen(false); setNotice('Session fork staged in preview') }}><Icon name="branch" size={13} /><span>Fork session</span></button>
                  <button type="button" role="menuitem" onClick={() => { setPlusOpen(false); setNotice('Transcript export prepared in preview') }}><Icon name="arrow-down" size={13} /><span>Export transcript</span></button>
                  <button type="button" role="menuitem" onClick={() => { setPlusOpen(false); setNotice('Archive action staged in preview') }}><Icon name="archive" size={13} /><span>Archive session</span></button>
                </div>
              )}
            </div>
            <textarea ref={textareaRef} aria-label="Message AgentiCOS" className="composer-input" disabled={disabled} onChange={(event) => { const value = event.target.value; setDraft(value); const open = value.trimStart().startsWith('/'); setSlashOpen(open); if (!open) setSlashIndex(0) }} onKeyDown={handleKeyDown} placeholder="Add more context" rows={1} value={draft} />
            <div className="composer-right">
              <span className="composer-model-wrap" title="Model routing">
                <button
                  type="button"
                  className={`composer-select composer-select--button ${modelOpen ? 'composer-select--open' : ''}`}
                  aria-haspopup="menu"
                  aria-expanded={modelOpen}
                  onClick={() => { setModelOpen((value) => !value); setPlusOpen(false); setEffortOpen(false) }}
                >
                  {model === 'Auto route' ? 'Auto •' : model} <Icon name="chevron-right" size={12} className="composer-select__chevron" />
                </button>
              </span>
              <span className="composer-select-wrap" title="Reasoning and effort">
                <button
                  type="button"
                  className={`composer-select composer-select--button ${effortOpen ? 'composer-select--open' : ''}`}
                  aria-haspopup="menu"
                  aria-expanded={effortOpen}
                  onClick={() => { setEffortOpen((value) => !value); setPlusOpen(false); setModelOpen(false) }}
                >
                  {effortLabel} <Icon name="chevron-right" size={12} className="composer-select__chevron" />
                </button>
              </span>
              <button className="composer-icon" type="button" title="Voice dictation" aria-label="Voice dictation" onClick={() => setNotice('Voice dictation activates with the runtime')}><Icon name="mic" size={15} /></button>
              {running ? <button className="send-button send-button--stop send-button--round" onClick={onStop} type="button"><Icon name="stop" size={14} /></button> : <button className="send-button send-button--round" disabled={!canSend} onClick={() => void submit()} type="button" aria-label="Send message"><Icon name="send" size={14} /></button>}
            </div>
          </div>
          {effortOpen && (
            <div className="effort-options" role="menu" aria-label="Reasoning and effort">
              <div className="effort-options__head">Options</div>
              <div className="effort-options__row">
                <span>Reasoning</span>
                <button type="button" role="switch" aria-checked={reasoningOn} aria-label="Reasoning" className={reasoningOn ? 'sw-switch sw-switch--on' : 'sw-switch'} onClick={() => setReasoningOn((value) => !value)}><span aria-hidden="true" /></button>
              </div>
              <div className="effort-options__label">Effort</div>
              {effortLevels.map((level) => (
                <button key={level} type="button" role="menuitemradio" aria-checked={effort === level} className={effort === level ? 'effort-option effort-option--active' : 'effort-option'} onClick={() => { setEffort(level); setEffortOpen(false); setNotice(`Effort: ${level}`) }}>
                  <span>{level === 'Ultra' ? 'Ultra (sends Maximum on this route)' : level}</span>
                  {effort === level && <Icon name="check" size={13} />}
                </button>
              ))}
            </div>
          )}
          {modelOpen && (
            <div className="model-options" role="menu" aria-label="Model routing">
              <label className="model-options__search">
                <Icon name="search" size={12} />
                <input
                  autoFocus
                  value={modelQuery}
                  onChange={(event) => setModelQuery(event.target.value)}
                  placeholder="Search models"
                  aria-label="Search models"
                />
              </label>
              <div className="model-options__group">freellmapi</div>
              {filteredModels.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="menuitemradio"
                  aria-checked={model === item}
                  className={model === item ? 'model-option model-option--active' : 'model-option'}
                  onClick={() => { setModel(item); setModelOpen(false); setNotice(`Model: ${item}`) }}
                >
                  <span>{item === 'Auto route' ? 'Auto' : item} {effortLabel}</span>
                  {model === item && <Icon name="check" size={13} />}
                </button>
              ))}
              {filteredModels.length === 0 && <div className="model-options__empty">No models match “{modelQuery}”.</div>}
              <div className="model-options__foot">
                <button type="button" role="menuitem" onClick={() => { setModelOpen(false); setNotice('Model catalog refresh is handled by the runtime') }}><Icon name="refresh" size={13} /><span>Update models</span></button>
                <button type="button" role="menuitem" onClick={() => { setModelOpen(false); setNotice('Custom models are added from the Providers surface') }}><Icon name="plus" size={13} /><span>Add custom model…</span></button>
                <button type="button" role="menuitem" onClick={() => { setModelOpen(false); setNotice('Model editing lives in the Providers surface') }}><Icon name="settings" size={13} /><span>Edit models…</span></button>
              </div>
            </div>
          )}
        </div>
        {notice && <div className="composer-notice" role="status" aria-live="polite">{notice}</div>}
      </footer>
      <AgentRunDrawer open={runDrawerOpen} running={running} onAction={setNotice} onClose={() => setRunDrawerOpen(false)} />
    </section>
  )
}
