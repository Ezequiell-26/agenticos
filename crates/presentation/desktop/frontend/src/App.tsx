import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ChatSurface from './components/ChatSurface'
import CommandPalette from './components/CommandPalette'
import CustomizePopover from './components/CustomizePopover'
import GlobalSearch from './components/GlobalSearch'
import KeyboardShortcuts from './components/KeyboardShortcuts'
import Icon from './components/Icon'
import NotificationDrawer from './components/NotificationDrawer'
import QuickActionsMenu from './components/QuickActionsMenu'
import StatusBar from './components/StatusBar'
import LayoutsCard from './components/LayoutsCard'
import SettingsWorkspace from './features/settings/SettingsWorkspace'
import WorkspaceContextMenu, { type ContextMenuState } from './components/WorkspaceContextMenu'
import WorkspaceOverview from './components/WorkspaceOverview'
import WorkspaceSidebar from './components/WorkspaceSidebar'
import WorkspaceDock from './components/WorkspaceDock'
import BrowserPanel from './components/BrowserPanel'
import { navigationItems, primaryRailIds, type RailMode } from './navigation'
import { runtime } from './services/runtime'
import { applyUiLayoutPreferences, readUiLayoutPreferences, readUiPreferences, subscribeUiPreferences, updateUiPreferences, type ExperienceLevel } from './services/ui-preferences'
import { useExclusiveOverlay } from './hooks/useExclusiveOverlay'
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
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const initialUiPreferences = useMemo(() => readUiLayoutPreferences(), [])
  const [leftPanelOpen, setLeftPanelOpen] = useState(initialUiPreferences.leftSidebarVisible)
  const [dockOpen, setDockOpen] = useState(initialUiPreferences.bottomDockVisible)
  const [browserPanelVisible, setBrowserPanelVisible] = useState(initialUiPreferences.browserPanelVisible)
  const [experience, setExperience] = useState<ExperienceLevel>(() => readUiPreferences().experience)
  const [focusMode, setFocusMode] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationUnread, setNotificationUnread] = useState(2)
  const [runtimeSyncing, setRuntimeSyncing] = useState(true)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [toast, setToast] = useState('')
  const [layoutsOpen, setLayoutsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const runtimeSyncSequence = useRef(0)
  useExclusiveOverlay('palette', paletteOpen, () => setPaletteOpen(false))
  useExclusiveOverlay('global-search', globalSearchOpen, () => setGlobalSearchOpen(false))
  useExclusiveOverlay('notifications', notificationsOpen, () => setNotificationsOpen(false))
  useExclusiveOverlay('shortcuts', shortcutsOpen, () => setShortcutsOpen(false))
  useExclusiveOverlay('layouts', layoutsOpen, () => setLayoutsOpen(false))
  useExclusiveOverlay('settings-modal', settingsOpen, () => setSettingsOpen(false))

  useEffect(() => {
    if (mode === 'settings') {
      setSettingsOpen(true)
      setMode('chat')
    }
  }, [mode])

  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      event.preventDefault()
      setContextMenu({ x: event.clientX, y: event.clientY })
    }
    window.addEventListener('contextmenu', onContextMenu)
    return () => window.removeEventListener('contextmenu', onContextMenu)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    persistUiState(modeStorageKey, mode)
  }, [mode])

  useEffect(() => {
    const preferences = readUiLayoutPreferences()
    applyUiLayoutPreferences(preferences)
    return subscribeUiPreferences(() => {
      const next = readUiPreferences()
      applyUiLayoutPreferences(next)
      setLeftPanelOpen(next.leftSidebarVisible)
      setDockOpen(next.bottomDockVisible)
      setBrowserPanelVisible(next.browserPanelVisible)
      setExperience(next.experience)
    })
  }, [])

  useEffect(() => {
    persistUiState(sessionStorageKey, sessionId)
  }, [sessionId])

  const refreshRuntime = useCallback(async (targetSessionId: string) => {
    const requestSequence = ++runtimeSyncSequence.current
    setRuntimeSyncing(true)
    setRuntimeError(null)
    const [statusResult, historyResult] = await Promise.allSettled([
      runtime.status.get(),
      runtime.conversations.history(targetSessionId),
    ])
    if (requestSequence !== runtimeSyncSequence.current) return
    if (statusResult.status === 'fulfilled') setStatus(statusResult.value)
    if (historyResult.status === 'fulfilled' && historyResult.value.length > 0) setMessages(historyResult.value)
    const failures = [statusResult, historyResult].filter((result) => result.status === 'rejected')
    if (failures.length > 0) {
      const firstFailure = failures[0]
      const reason = firstFailure.status === 'rejected' ? firstFailure.reason : null
      setRuntimeError(reason instanceof Error ? reason.message : 'Runtime synchronization failed.')
    }
    setRuntimeSyncing(false)
  }, [])

  useEffect(() => {
    void refreshRuntime(sessionId)
  }, [refreshRuntime, sessionId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'Enter') {
        event.preventDefault()
        setFocusMode((open) => !open)
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setGlobalSearchOpen((open) => !open)
        return
      }
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        handleCreateConversation()
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
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        setLayoutsOpen((open) => !open)
        return
      }
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && /^[1-9]$/.test(event.key)) {
        const primaryItems = navigationItems.filter((item) => primaryRailIds.has(item.id))
        const target = primaryItems[Number(event.key) - 1]
        if (target) {
          event.preventDefault()
          setMode(target.id)
          setPaletteOpen(false)
          setGlobalSearchOpen(false)
        }
        return
      }
      if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement | null
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return
        event.preventDefault()
        setShortcutsOpen((open) => !open)
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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

  function handleStop() {
    setRunning(false)
    setStatus((current) => ({ ...current, state: 'cancelled' }))
  }

  return (
    <div className={'app-shell ' + (!leftPanelOpen ? 'app-shell--sidebar-collapsed ' : '') + (focusMode ? 'app-shell--focus ' : '') + (layoutsOpen ? 'app-shell--layout-editing' : '')} data-runtime={status.provider === 'Runtime offline' ? 'offline' : 'connected'}>
      <WorkspaceSidebar
        activeConversation={sessionId}
        conversations={conversations}
        onCreateConversation={handleCreateConversation}
        onOpenSearch={() => setPaletteOpen(true)}
        onSelectConversation={handleSelectConversation}
        onConversationAction={handleConversationAction}
        onNavigate={setMode}
        onOpenNotifications={() => setNotificationsOpen((open) => !open)}
        notificationUnread={notificationUnread}
        footerExtra={<CustomizePopover experience={experience} onExperienceChange={setExperience} onSelectMode={(nextMode) => setMode(nextMode)} iconOnly />}
        runtimeConnected={status.provider !== 'Runtime offline'}
      />

      <a className="skip-link" href="#workspace-content">Skip to workspace</a>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {running ? 'Agent run in progress.' : `Runtime ${status.provider === 'Runtime offline' ? 'offline' : 'connected'}; agent state ${status.state}.`}
      </div>
      <main id="workspace-content" className="workspace-main" aria-label="AgentiCOS workspace">
        {runtimeError && (
          <section className="runtime-recovery-banner" role="alert" aria-live="assertive">
            <span className="runtime-recovery-banner__icon"><Icon name="cloud" size={14} /></span>
            <div>
              <strong>{runtimeSyncing ? 'Synchronizing runtime…' : 'Runtime synchronization failed'}</strong>
              <small>{runtimeError}</small>
            </div>
            <button className="studio-button studio-button--active" type="button" onClick={() => { void refreshRuntime(sessionId) }} disabled={runtimeSyncing}>
              <Icon name="refresh" size={13} /> {runtimeSyncing ? 'Retrying…' : 'Retry'}
            </button>
            <button className="icon-button" type="button" aria-label="Dismiss runtime recovery message" onClick={() => setRuntimeError(null)}><Icon name="x" size={13} /></button>
          </section>
        )}

        <div className="workspace-main__content">
          {mode === 'chat' ? (
            <div className={'workspace-split' + (browserPanelVisible ? ' workspace-split--browser' : '')}>
              <ChatSurface disabled={running} messages={messages} onSend={handleSend} onStop={handleStop} onOpenPalette={() => setPaletteOpen(true)} running={running} sessionId={sessionId} sessions={conversations} onSelectSession={handleSelectConversation} onCreateSession={handleCreateConversation} browserPanelVisible={browserPanelVisible} onToggleBrowserPanel={() => updateUiPreferences({ browserPanelVisible: !browserPanelVisible })} />
              {browserPanelVisible && <BrowserPanel onAction={setToast} />}
            </div>
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

        <NotificationDrawer
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          onOpenCenter={() => setMode('notifications')}
          onNavigate={(nextMode) => setMode(nextMode)}
          onUnreadChange={setNotificationUnread}
        />
        <StatusBar
          messageCount={messages.length}
          status={status}
          leading={<QuickActionsMenu onCreateConversation={handleCreateConversation} onSelectMode={(nextMode) => setMode(nextMode)} compact />}
        />
      </main>

      <GlobalSearch
        conversations={conversations}
        onClose={() => setGlobalSearchOpen(false)}
        onSelectConversation={handleSelectConversation}
        onSelectMode={(nextMode) => setMode(nextMode)}
        open={globalSearchOpen}
      />

      <CommandPalette
        conversations={conversations}
        onClose={() => setPaletteOpen(false)}
        onCreateConversation={handleCreateConversation}
        onSelectConversation={handleSelectConversation}
        onSelectMode={(nextMode) => { setMode(nextMode); setPaletteOpen(false) }}
        onOpenShortcuts={() => { setPaletteOpen(false); setShortcutsOpen(true) }}
        open={paletteOpen}
      />
      <KeyboardShortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {contextMenu && (
        <WorkspaceContextMenu
          anchor={contextMenu}
          onClose={() => setContextMenu(null)}
          onCreateConversation={handleCreateConversation}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenLayouts={() => setLayoutsOpen(true)}
          onAction={setToast}
        />
      )}
      {layoutsOpen && (
        <LayoutsCard
          experience={experience}
          onExperienceChange={setExperience}
          onClose={() => setLayoutsOpen(false)}
          onAction={setToast}
        />
      )}
      {settingsOpen && (
        <div className="settings-modal-backdrop" role="presentation" onMouseDown={() => setSettingsOpen(false)}>
          <div className="settings-modal" role="dialog" aria-modal="true" aria-label="Settings" onMouseDown={(event) => event.stopPropagation()}>
            <SettingsWorkspace notify={setToast} onClose={() => setSettingsOpen(false)} onNavigate={(nextMode) => { setSettingsOpen(false); setMode(nextMode) }} />
          </div>
        </div>
      )}
      {toast && <div className="studio-toast" role="status"><Icon name="check" size={14} /><span>{toast}</span></div>}
    </div>
  )
}

export default App
