import { useEffect, useMemo, useState } from 'react'
import ActivityRail from './components/ActivityRail'
import AgentPanel from './components/AgentPanel'
import ChatSurface from './components/ChatSurface'
import CommandPalette from './components/CommandPalette'
import StatusBar from './components/StatusBar'
import WorkspaceOverview from './components/WorkspaceOverview'
import WorkspaceSidebar from './components/WorkspaceSidebar'
import { runtime } from './services/runtime'
import type { AgentStatusSnapshot, ChatMessage, ConversationSummary } from './types/runtime'

type RailMode = 'chat' | 'files' | 'runs' | 'providers' | 'settings'

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

function App() {
  const [mode, setMode] = useState<RailMode>('chat')
  const [sessionId, setSessionId] = useState('default')
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages)
  const [conversations, setConversations] = useState(initialConversations)
  const [status, setStatus] = useState<AgentStatusSnapshot>(fallbackStatus)
  const [running, setRunning] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

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
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const visibleTitle = useMemo(() => {
    if (mode === 'chat') return 'Command Center'
    return mode.charAt(0).toUpperCase() + mode.slice(1)
  }, [mode])

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

    const response = await runtime.chat.sendMessage(sessionId, message)
    setMessages((current) => [...current, response])
    setRunning(false)
    setStatus((current) => ({ ...current, state: response.role === 'system' ? 'failed' : 'completed' }))
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

  function handleRun() {
    setMode('runs')
    setRunning(true)
    setStatus((current) => ({ ...current, state: 'planning' }))
  }

  function handleStop() {
    setRunning(false)
    setStatus((current) => ({ ...current, state: 'cancelled' }))
  }

  return (
    <div className="app-shell">
      <ActivityRail active={mode} onChange={setMode} />
      <WorkspaceSidebar
        activeConversation={sessionId}
        conversations={conversations}
        onCreateConversation={handleCreateConversation}
        onOpenSearch={() => setPaletteOpen(true)}
        onSelectConversation={handleSelectConversation}
      />

      <main className="workspace-main">
        <header className="topbar">
          <div className="topbar__title">
            <span className="eyebrow">AgentiCOS</span>
            <h1>{visibleTitle}</h1>
          </div>
          <div className="topbar__right">
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
            <ChatSurface disabled={false} messages={messages} onSend={handleSend} onStop={handleStop} onOpenPalette={() => setPaletteOpen(true)} running={running} sessionId={sessionId} />
          ) : (
            <WorkspaceOverview mode={mode} />
          )}
        </div>

        <StatusBar messageCount={messages.length} status={status} />
      </main>

      <AgentPanel onRun={handleRun} onStop={handleStop} running={running} status={status} />

      <CommandPalette
        conversations={conversations}
        onClose={() => setPaletteOpen(false)}
        onCreateConversation={handleCreateConversation}
        onSelectConversation={handleSelectConversation}
        onSelectMode={(nextMode) => { setMode(nextMode); setPaletteOpen(false) }}
        open={paletteOpen}
      />
    </div>
  )
}

export default App
