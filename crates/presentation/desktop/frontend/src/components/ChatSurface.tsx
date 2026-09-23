import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { ChatMessage } from '../types/runtime'
import Icon from './Icon'
import ChatEnhancementDock from './ChatEnhancementDock'
import AgentRunDrawer from '../features/chat/AgentRunDrawer'
import AgentModeStrip, { type AgentMode } from '../features/chat/AgentModeStrip'

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
const agents = ['Builder', 'Reviewer', 'Researcher', 'Planner']
const contextScopes = ['Workspace', 'Current file', 'Selection', 'Pinned memory', 'Custom']
const effortLevels = ['Fast', 'Balanced', 'Deep', 'Maximum']
const responseFormats = ['Markdown', 'Plain text', 'Structured', 'Code first']
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

function MessageBubble({ message, onAction }: { message: ChatMessage; onAction: (action: string) => void }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  return (
    <article className={`message-row ${isUser ? 'message-row--user' : ''}`}>
      {!isUser && <div className={`message-avatar ${isSystem ? 'message-avatar--system' : ''}`}><Icon name={isSystem ? 'shield' : 'bot'} size={15} /></div>}
      <div className={`message-bubble ${isUser ? 'message-bubble--user' : ''} ${isSystem ? 'message-bubble--system' : ''}`}>
        <div className="message-meta"><span>{isUser ? 'You' : isSystem ? 'System' : 'AgentiCOS'}</span><time>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>
        <p>{message.content}</p>
        {!isSystem && !isUser && <div className="message-actions"><button type="button" title="Copy response" aria-label="Copy response" onClick={() => onAction('copy:' + message.content)}><Icon name="copy" size={13} /></button><button type="button" title="Regenerate response" aria-label="Regenerate response" onClick={() => onAction('Regenerate queued in preview')}><Icon name="history" size={13} /></button><button type="button" title="Open response tools" aria-label="Open response tools" onClick={() => onAction('Response actions opened')}><Icon name="more" size={13} /></button></div>}
      </div>
    </article>
  )
}

export default function ChatSurface({ sessionId, messages, disabled = false, running, onSend, onStop, onOpenPalette }: ChatSurfaceProps) {
  const [draft, setDraft] = useState('')
  const [model, setModel] = useState(models[0])
  const [agent, setAgent] = useState(agents[0])
  const [agentMode, setAgentMode] = useState<AgentMode>('Agent')
  const [contextScope, setContextScope] = useState(contextScopes[0])
  const [effort, setEffort] = useState(effortLevels[2])
  const [maxTokens, setMaxTokens] = useState('8192')
  const [temperature, setTemperature] = useState('0.3')
  const [responseFormat, setResponseFormat] = useState(responseFormats[0])
  const [slashOpen, setSlashOpen] = useState(false)
  const [contextBudget] = useState('72%')
  const [showReasoning, setShowReasoning] = useState(true)
  const [showCitations, setShowCitations] = useState(true)
  const [promptHistory, setPromptHistory] = useState<string[]>([])
  const [toolsOpen, setToolsOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [webAccess, setWebAccess] = useState(false)
  const [codeMode, setCodeMode] = useState(true)
  const [deepMode, setDeepMode] = useState(true)
  const [rememberContext, setRememberContext] = useState(true)
  const [attachedFiles, setAttachedFiles] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [runDrawerOpen, setRunDrawerOpen] = useState(false)
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false)
  const [promptHistoryOpen, setPromptHistoryOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const canSend = useMemo(() => draft.trim().length > 0 && !disabled, [draft, disabled])
  const slashMatches = useMemo(() => { const normalized = draft.trim().toLowerCase(); if (!normalized.startsWith('/')) return slashCommands; return slashCommands.filter(([command, description]) => (command + ' ' + description).toLowerCase().includes(normalized)) }, [draft])
  const tokenEstimate = useMemo(() => Math.max(1, Math.ceil(draft.length / 4)), [draft])

  useEffect(() => {
    textareaRef.current?.focus()
    setSlashOpen(false)
    try { const savedDraft = window.localStorage.getItem('agenticos.draft.' + sessionId); setDraft(savedDraft ?? '') } catch { setDraft('') }
  }, [sessionId])

  useEffect(() => {
    try { if (draft) window.localStorage.setItem('agenticos.draft.' + sessionId, draft); else window.localStorage.removeItem('agenticos.draft.' + sessionId) } catch { /* optional draft persistence */ }
  }, [draft, sessionId])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 1900)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: running ? 'smooth' : 'auto', block: 'end' })
  }, [messages, running])

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (canSend) void submit()
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

  async function copyResponse(content: string) {
    try {
      await navigator.clipboard.writeText(content)
      setNotice('Response copied to clipboard')
    } catch {
      setNotice('Clipboard access unavailable')
    }
  }

  function restorePrompt(prompt: string) {
    setDraft(prompt)
    setPromptHistoryOpen(false)
    setSlashOpen(prompt.trimStart().startsWith('/'))
    window.requestAnimationFrame(() => textareaRef.current?.focus())
  }

  function clearComposer() {
    setDraft('')
    setAttachedFiles([])
    setSlashOpen(false)
    setPromptHistoryOpen(false)
    setNotice('Composer cleared')
    window.requestAnimationFrame(() => textareaRef.current?.focus())
  }

  async function submit() {
    const message = draft.trim()
    if (!message || disabled) return
    setDraft('')
    setSlashOpen(false)
    setPromptHistory((current) => [message, ...current.filter((item) => item !== message)].slice(0, 5))
    try {
      await onSend(message)
    } catch {
      setDraft(message)
      setNotice('Request failed. Your message was restored.')
      window.requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }

  function useStarter(prompt: string) {
    setDraft(prompt)
    setSlashOpen(false)
    window.requestAnimationFrame(() => textareaRef.current?.focus())
  }

  function useSlashCommand(command: string, description: string) {
    setDraft(command + ' ' + description)
    setSlashOpen(false)
    window.requestAnimationFrame(() => textareaRef.current?.focus())
  }

  return (
    <section className="chat-surface">
      <header className="chat-header">
        <div className="chat-header__title">
          <div className="chat-title-icon"><Icon name="spark" size={17} /></div>
          <div><strong>Agent session</strong><span>Private runtime workspace · {agent} · {agentMode}</span></div>
        </div>
        <div className="chat-header__actions">
          <div className="model-chip"><span className="status-dot status-dot--live" /><select value={model} onChange={(event) => { setModel(event.target.value); setNotice(`Model: ${event.target.value}`) }} aria-label="Select model">{models.map((item) => <option key={item}>{item}</option>)}</select></div>
          <button className={`soft-button ${advancedOpen ? 'soft-button--active' : ''}`} type="button" onClick={() => setAdvancedOpen((value) => !value)} title="Agent controls"><Icon name="settings" size={14} />Controls</button>
          <button className={`soft-button ${runDrawerOpen ? 'soft-button--active' : ''}`} type="button" title="Open run trace" onClick={() => setRunDrawerOpen((value) => !value)}><Icon name="activity" size={15} />Trace</button>
          <button className="soft-button" type="button" title="Search session history" onClick={onOpenPalette}><Icon name="history" size={15} />History</button>
          <div className="session-menu-wrap">
            <button className={`icon-button ${sessionMenuOpen ? 'icon-button--active' : ''}`} aria-label="Session actions" title="Session actions" onClick={() => setSessionMenuOpen((value) => !value)} type="button"><Icon name="more" size={17} /></button>
            {sessionMenuOpen && <div className="session-menu" role="menu">
              <button type="button" onClick={() => { setSessionMenuOpen(false); setNotice('Session fork staged in preview') }}><Icon name="branch" size={13} /><span>Fork session</span></button>
              <button type="button" onClick={() => { setSessionMenuOpen(false); setNotice('Rename session opened in preview') }}><Icon name="code" size={13} /><span>Rename session</span></button>
              <button type="button" onClick={() => { setSessionMenuOpen(false); setNotice('Transcript export prepared in preview') }}><Icon name="arrow-down" size={13} /><span>Export transcript</span></button>
              <button type="button" onClick={() => { setSessionMenuOpen(false); setNotice('Archive action staged in preview') }}><Icon name="archive" size={13} /><span>Archive session</span></button>
            </div>}
          </div>
          <button className="icon-button" aria-label="Open command palette" title="Open command palette" onClick={onOpenPalette} type="button"><Icon name="command" size={17} /></button>
        </div>
      </header>

      {advancedOpen && (
        <div className="chat-control-stack">
          <AgentModeStrip mode={agentMode} onAction={setNotice} onChange={setAgentMode} />
        <div className="chat-control-bar">
          <label><span>Agent</span><select value={agent} onChange={(event) => setAgent(event.target.value)}>{agents.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Context</span><select value={contextScope} onChange={(event) => setContextScope(event.target.value)}>{contextScopes.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Effort</span><select value={effort} onChange={(event) => setEffort(event.target.value)}>{effortLevels.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Max output</span><select value={maxTokens} onChange={(event) => setMaxTokens(event.target.value)}>{['2048','4096','8192','16384','32768'].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Temperature</span><select value={temperature} onChange={(event) => setTemperature(event.target.value)}>{['0.0','0.2','0.3','0.5','0.7','1.0'].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Format</span><select value={responseFormat} onChange={(event) => setResponseFormat(event.target.value)}>{responseFormats.map((item) => <option key={item}>{item}</option>)}</select></label>
          <button type="button" className={`control-pill ${deepMode ? 'control-pill--active' : ''}`} onClick={() => setDeepMode((value) => !value)}><Icon name="spark" size={12} /> Deep</button>
          <button type="button" className={`control-pill ${codeMode ? 'control-pill--active' : ''}`} onClick={() => setCodeMode((value) => !value)}><Icon name="code" size={12} /> Code</button>
          <button type="button" className={`control-pill ${webAccess ? 'control-pill--active' : ''}`} onClick={() => setWebAccess((value) => !value)}><Icon name="search" size={12} /> Web</button>
          <button type="button" className={`control-pill ${rememberContext ? 'control-pill--active' : ''}`} onClick={() => setRememberContext((value) => !value)}><Icon name="history" size={12} /> Memory</button>
          <button type="button" className={`control-pill ${showReasoning ? 'control-pill--active' : ''}`} onClick={() => setShowReasoning((value) => !value)}><Icon name="activity" size={12} /> Reasoning</button>
          <button type="button" className={`control-pill ${showCitations ? 'control-pill--active' : ''}`} onClick={() => setShowCitations((value) => !value)}><Icon name="archive" size={12} /> Citations</button>
        </div>
        </div>
      )}

      <div className="chat-content">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="empty-orb"><Icon name="spark" size={22} /></div>
            <span className="eyebrow">Start a run</span>
            <h1>Build with AgentiCOS.</h1>
            <p>Describe a goal, inspect a repository, plan a task or ask the agent to work through a technical problem.</p>
            <div className="starter-grid starter-grid--large">
              {[
                ['Inspect workspace', 'Architecture + gaps', 'Inspect the current workspace and summarize what is missing.'],
                ['Plan next step', 'Fail-closed planning', 'Plan the next implementation step without making changes.'],
                ['Review frontend', 'UX + quality pass', 'Review the current frontend for regressions and usability issues.'],
                ['Build workflow', 'Automations + checks', 'Design a repeatable workflow for a complex engineering task.'],
                ['Create test plan', 'Evidence first', 'Create a professional test and verification plan.'],
                ['Explain architecture', 'Runtime + UI', 'Explain the current project architecture in practical terms.'],
              ].map(([title, detail, prompt]) => <button type="button" key={title} onClick={() => useStarter(prompt)}>{title}<small>{detail}</small></button>)}
            </div>
          </div>
        ) : (
          <div className="message-stack">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onAction={(action) => {
                  if (action.startsWith('copy:')) void copyResponse(action.slice(5))
                  else setNotice(action)
                }}
              />
            ))}
            {running && <div className="message-row"><div className="message-avatar"><Icon name="bot" size={15} /></div><div className="message-bubble message-bubble--typing" aria-label="AgentiCOS is working"><span /><span /><span /></div></div>}
            <div ref={messagesEndRef} aria-hidden="true" />
          </div>
        )}
      </div>

      <footer className="composer-wrap">
        <div className="composer-shell">
          {slashOpen && <div className="slash-command-menu" role="listbox" aria-label="Slash commands">{slashMatches.map(([command, description]) => <button type="button" key={command} onClick={() => useSlashCommand(command, description)}><span className="slash-command-name">{command}</span><span>{description}</span></button>)}{slashMatches.length === 0 && <div className="slash-command-empty">No command matches the current input.</div>}</div>}
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
          <ChatEnhancementDock onAction={setNotice} onInsert={(value) => setDraft((current) => `${current}${current ? ' ' : ''}${value}`)} />
          <textarea ref={textareaRef} aria-label="Message AgentiCOS" className="composer-input" disabled={disabled} onChange={(event) => { const value = event.target.value; setDraft(value); setSlashOpen(value.trimStart().startsWith('/')) }} onKeyDown={handleKeyDown} placeholder="Ask AgentiCOS to build, inspect, research, debug or execute…" rows={3} value={draft} />
          <div className="composer-toolbar">
            <div className="composer-actions">
              <button className="composer-icon" type="button" title="Attach file" aria-label="Attach file" onClick={addAttachment}><Icon name="paperclip" size={15} /></button>
              <button className={`composer-icon ${slashOpen ? 'composer-icon--active' : ''}`} type="button" title="Slash commands" aria-label="Slash commands" onClick={() => { setSlashOpen((value) => !value); if (!draft) setDraft('/') }}><Icon name="command" size={15} /></button>
              <div className="prompt-history-wrap">
                <button className={`composer-icon ${promptHistoryOpen ? 'composer-icon--active' : ''}`} type="button" title="Recent prompts" aria-label="Recent prompts" aria-expanded={promptHistoryOpen} onClick={() => setPromptHistoryOpen((value) => !value)} disabled={promptHistory.length === 0}><Icon name="history" size={15} /></button>
                {promptHistoryOpen && promptHistory.length > 0 && (
                  <div className="prompt-history-menu" role="menu" aria-label="Recent prompts">
                    <div className="prompt-history-menu__head"><span>Recent prompts</span><button type="button" onClick={() => { setPromptHistory([]); setPromptHistoryOpen(false); setNotice('Prompt history cleared') }}>Clear</button></div>
                    {promptHistory.map((prompt) => <button key={prompt} type="button" role="menuitem" onClick={() => restorePrompt(prompt)}><Icon name="history" size={12} /><span>{prompt}</span></button>)}
                  </div>
                )}
              </div>
              <button className="composer-icon" type="button" title="Clear composer" aria-label="Clear composer" onClick={clearComposer}><Icon name="x" size={15} /></button>
              <button className={`composer-icon ${toolsOpen ? 'composer-icon--active' : ''}`} type="button" title="Composer tools" onClick={() => setToolsOpen((value) => !value)}><Icon name="tool" size={15} /></button>
              <button className="composer-icon" type="button" title="Agent controls" onClick={() => setAdvancedOpen((value) => !value)}><Icon name="settings" size={15} /></button>
              <span className="context-chip"><Icon name="folder" size={12} /> {contextScope}</span>
              <span className="context-chip"><Icon name="code" size={12} /> {tokenEstimate.toLocaleString()} est. tokens</span>
              <span className="context-chip context-chip--budget"><span>{contextBudget}</span><i /></span>
            </div>
            <span className="composer-hint">{model} · {effort} · {responseFormat} · {webAccess ? 'Web' : 'Local'} · {codeMode ? 'Code' : 'Chat'} · {promptHistory.length} recent prompts</span>
            {running ? <button className="send-button send-button--stop" onClick={onStop} type="button"><Icon name="stop" size={15} />Stop</button> : <button className="send-button" disabled={!canSend} onClick={() => void submit()} type="button"><Icon name="send" size={15} />Send</button>}
          </div>
        </div>
        {notice && <div className="composer-notice">{notice}</div>}
      </footer>
      <AgentRunDrawer open={runDrawerOpen} running={running} onAction={setNotice} onClose={() => setRunDrawerOpen(false)} />
    </section>
  )
}
