import { useEffect, useMemo, useState } from 'react'
import ActivityRail, { type RailMode } from './components/ActivityRail'
import AgentPanel from './components/AgentPanel'
import ChatSurface from './components/ChatSurface'
import CommandPalette from './components/CommandPalette'
import Icon from './components/Icon'
import QuickActionsMenu from './components/QuickActionsMenu'
import StatusBar from './components/StatusBar'
import WorkspaceOverview from './components/WorkspaceOverview'
import WorkspaceSidebar from './components/WorkspaceSidebar'
import WorkspaceDock from './components/WorkspaceDock'
import { navigationItems } from './navigation'
import { runtime } from './services/runtime'
import { applyUiLayoutPreferences, readUiLayoutPreferences, subscribeUiPreferences } from './services/ui-preferences'
import type { AgentStatusSnapshot, ChatMessage, ConversationSummary } from './types/runtime'

const now = Date.now()

const initialConversations: ConversationSummary[] = [
  { id: 'default', title: 'Welcome to AgentiCOS', preview: 'Start your first agent run.', timestamp: now, pinned: true },
  { id: 'architecture', title: 'Architecture review', preview: 'Sequential implementation controls.', timestamp: now - 1000 * 60 * 28 },
]

const starterMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: 'AgentiCOS is ready. Describe a goal, ask for an inspection, or start a controlled implementation run.',
    timestamp: now,
  },
]

const fallbackStatus: AgentStatusSnapshot = {
  agentName: 'AgentiCOS',
  state: 'idle',
  provider: 'Runtime offline',
  model: 'Waiting for backend',
}

const modeStorageKey = 'agenticos.ui.mode'
const sessionStorageKey = 'agenticos.ui.session'
function readStoredMode(): RailMode {
  try {
    const value = window.localStorage.getItem(modeStorageKey)
    return value && navigationItems.some((item) => item.id === value as RailMode) ? value as RailMode : 'chat'
  } catch {
    return 'chat'
  }
}

function readStoredSession(): string {
  try {
    return window.localStorage.getItem(sessionStorageKey) || 'default'
  } catch {
    return 'default'
  }
}

function persistUiState(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage is optional; runtime state remains authoritative.
  }
}

function App() {
  const [mode, setMode] = useState<RailMode>(() => readStoredMode())
  const [sessionId, setSessionId] = useState(() => readStoredSession())
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages)
  const [conversations, setConversations] = useState(initialConversations)
  const [status, setStatus] = useState<AgentStatusSnapshot>(fallbackStatus)
  const [running, setRunning] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const initialUiPreferences = useMemo(() => readUiLayoutPreferences(), [])
  const [leftPanelOpen, setLeftPanelOpen] = useState(initialUiPreferences.leftSidebarVisible)
  const [agentPanelOpen, setAgentPanelOpen] = useState(initialUiPreferences.agentInspectorVisible)
  const [dockOpen, setDockOpen] = useState(initialUiPreferences.bottomDockVisible)
  const [focusMode, setFocusMode] = useState(false)

  useEffect(() => {
    persistUiState(modeStorageKey, mode)
  }, [mode])

  useEffect(() => {
    const preferences = readUiLayoutPreferences()
    applyUiLayoutPreferences(preferences)
    return subscribeUiPreferences(() => {
      const next = readUiLayoutPreferences()
      applyUiLayoutPreferences(next)
      setLeftPanelOpen(next.leftSidebarVisible)
      setAgentPanelOpen(next.agentInspectorVisible)
      setDockOpen(next.bottomDockVisible)
    })
  }, [])

  useEffect(() => {
    persistUiState(sessionStorageKey, sessionId)
  }, [sessionId])

  useEffect(() => {
    let active = true
    void Promise.all([runtime.status.get(), runtime.conversations.history(sessionId)]).then(([nextStatus, history]) => {
      if (!active) return
      setStatus(nextStatus)
      if (history.length > 0) setMessages(history)
    })
    return () => {
      active = false
    }
  }, [sessionId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
        return
      }
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        setLeftPanelOpen((open) => !open)
        return
      }
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'j') {
        event.preventDefault()
        setDockOpen((open) => !open)
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        setAgentPanelOpen((open) => !open)
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setFocusMode((open) => !open)
        return
      }
      if (event.key === 'Escape' && focusMode) {
        event.preventDefault()
        setFocusMode(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const visibleTitle = useMemo(() => navigationItems.find((item) => item.id === mode)?.label ?? 'Command Center', [mode])

  async function handleSend(message: string) {
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    }

    setMessages((current) => [...current, userMessage])
    setConversations((current) => current.map((conversation) => (
      conversation.id === sessionId
        ? { ...conversation, preview: message, timestamp: Date.now(), title: conversation.title === 'New conversation' ? message.slice(0, 32) : conversation.title }
        : conversation
    )))
    setRunning(true)
    setStatus((current) => ({ ...current, state: 'executing' }))

    try {
      const response = await runtime.chat.sendMessage(sessionId, message)
      setMessages((current) => [...current, response])
      setStatus((current) => ({ ...current, state: response.role === 'system' ? 'failed' : 'completed' }))
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'The runtime could not complete the request.'
      setMessages((current) => [
        ...current,
        {
          id: `system-error-${Date.now()}`,
          role: 'system',
          content: `Request failed: ${detail}`,
          timestamp: Date.now(),
        },
      ])
      setStatus((current) => ({ ...current, state: 'failed' }))
      throw error
    } finally {
      setRunning(false)
    }
  }

  function handleCreateConversation() {
    const nextId = `session-${Date.now()}`
    setConversations((current) => [
      { id: nextId, title: 'New conversation', preview: 'No messages yet.', timestamp: Date.now() },
      ...current,
    ])
    setSessionId(nextId)
    setMessages([])
    setMode('chat')
    setPaletteOpen(false)
  }

  function handleSelectConversation(id: string) {
    setSessionId(id)
    setMode('chat')
    setMessages([])
    setPaletteOpen(false)
  }

  function handleConversationAction(id: string, action: 'pin' | 'rename' | 'archive', value?: string) {
    if (action === 'pin') { setConversations((current) => current.map((conversation) => conversation.id === id ? { ...conversation, pinned: !conversation.pinned } : conversation)); return }
    if (action === 'rename' && value) { setConversations((current) => current.map((conversation) => conversation.id === id ? { ...conversation, title: value } : conversation)); return }
    if (action === 'archive') {
      setConversations((current) => current.filter((conversation) => conversation.id !== id))
      if (sessionId === id) { setSessionId('default'); setMode('chat'); setMessages(starterMessages) }
    }
  }

  function handleRun() {
    setMode('runs')
    setRunning(false)
  }

  function handleStop() {
    setRunning(false)
    setStatus((current) => ({ ...current, state: 'cancelled' }))
  }

  return (
    <div className={'app-shell ' + (!leftPanelOpen ? 'app-shell--sidebar-collapsed ' : '') + (!agentPanelOpen ? 'app-shell--agent-collapsed ' : '') + (focusMode ? 'app-shell--focus' : '')} data-runtime={status.provider === 'Runtime offline' ? 'offline' : 'connected'}>
      <ActivityRail active={mode} onChange={setMode} />
      <WorkspaceSidebar
        activeConversation={sessionId}
        conversations={conversations}
        onCreateConversation={handleCreateConversation}
        onOpenSearch={() => setPaletteOpen(true)}
        onSelectConversation={handleSelectConversation}
        onConversationAction={handleConversationAction}
        runtimeConnected={status.provider !== 'Runtime offline'}
      />

      <main className="workspace-main">
        <header className="topbar">
          <div className="topbar__title">
            <span className="eyebrow">AgentiCOS</span>
            <span className="topbar__group">{navigationItems.find((item) => item.id === mode)?.group ?? 'build'}</span>
            <h1>{visibleTitle}</h1>
          </div>
          <div className="topbar__right">
            <QuickActionsMenu onCreateConversation={handleCreateConversation} onSelectMode={(nextMode) => setMode(nextMode)} />
            <button className={dockOpen ? 'soft-button soft-button--active' : 'soft-button'} type="button" title="Bottom dock · Ctrl+J" onClick={() => setDockOpen((open) => !open)}><Icon name="terminal" size={14} />Dock</button>
            <button className={leftPanelOpen && agentPanelOpen ? 'soft-button' : 'soft-button soft-button--active'} type="button" title="Toggle side panels" onClick={() => { const next = !(leftPanelOpen && agentPanelOpen); setLeftPanelOpen(next); setAgentPanelOpen(next) }}><Icon name="layout" size={14} />Panels</button>
            <button className={focusMode ? 'soft-button soft-button--active' : 'soft-button'} type="button" title="Focus mode · Ctrl+Shift+F" aria-pressed={focusMode} onClick={() => setFocusMode((open) => !open)}><Icon name="maximize" size={14} />Focus</button>
            <button className="notification-button" type="button" title="Notifications" aria-label="Notifications" onClick={() => setMode('notifications')}>
              <Icon name="history" size={15} /><span className="notification-badge">2</span>
            </button>
            <span className="runtime-chip">
              <span className={`status-dot ${status.provider === 'Runtime offline' ? 'status-dot--offline' : 'status-dot--live'}`} />
              {status.state}
            </span>
            <button className="icon-button" aria-label="Command palette" title="Command palette" onClick={() => setPaletteOpen(true)} type="button">
              <Icon name="command" size={17} />
            </button>
          </div>
        </header>

        <div className="workspace-main__content">
          {mode === 'chat' ? (
            <ChatSurface disabled={running} messages={messages} onSend={handleSend} onStop={handleStop} onOpenPalette={() => setPaletteOpen(true)} running={running} sessionId={sessionId} />
          ) : (
            <WorkspaceOverview mode={mode} onNavigate={setMode} />
          )}
        </div>

        <WorkspaceDock
          messageCount={messages.length}
          mode={mode}
          onClose={() => setDockOpen(false)}
          open={dockOpen}
          running={running}
          status={status}
        />

        <StatusBar messageCount={messages.length} status={status} />
      </main>

      {agentPanelOpen && <AgentPanel onRun={handleRun} onStop={handleStop} running={running} status={status} />}

      <CommandPalette
        conversations={conversations}
        onClose={() => setPaletteOpen(false)}
        onCreateConversation={handleCreateConversation}
        onSelectConversation={handleSelectConversation}
        onSelectMode={(nextMode) => { setMode(nextMode); setPaletteOpen(false) }}
        onToggleDock={() => setDockOpen((open) => !open)}
        onToggleFocus={() => setFocusMode((open) => !open)}
        onTogglePanels={() => {
          const next = !(leftPanelOpen && agentPanelOpen)
          setLeftPanelOpen(next)
          setAgentPanelOpen(next)
        }}
        open={paletteOpen}
      />
    </div>
  )
}

export default App
