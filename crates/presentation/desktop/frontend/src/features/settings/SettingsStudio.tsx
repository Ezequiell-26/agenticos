import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import Icon, { type IconName } from '../../components/Icon'
import { UI_PREFERENCES_STORAGE_KEY, applyUiLayoutPreferences, emitUiPreferencesChanged } from '../../services/ui-preferences'

type SectionId =
  | 'overview' | 'profiles' | 'models' | 'agent' | 'tools' | 'terminal' | 'context'
  | 'compression' | 'display' | 'layout' | 'voice' | 'web' | 'browser' | 'gateway' | 'mcp' | 'automation'
  | 'runtime' | 'security' | 'shortcuts' | 'advanced'

type Theme = 'Monochrome' | 'Graphite' | 'Paper' | 'High contrast'
type Accent = 'White' | 'Silver' | 'Blue' | 'Violet' | 'Green'
type Density = 'Compact' | 'Comfortable' | 'Spacious'
type ToolProgress = 'off' | 'new' | 'all' | 'verbose'
type TerminalBackend = 'local' | 'docker' | 'ssh' | 'modal' | 'daytona' | 'singularity'

interface Profile {
  id: string
  name: string
  description: string
  model: string
  provider: string
  agent: string
  active: boolean
  gatewayEnabled: boolean
  skillsCount: number
  mcpCount: number
}

interface SettingsState {
  theme: Theme
  accent: Accent
  density: Density
  uiScale: number
  fontSize: number
  sidebarWidth: number
  inspectorWidth: number
  language: string
  workspaceName: string
  startupView: string
  defaultModel: string
  defaultProvider: string
  defaultAgent: string
  modelAlias: string
  fallbackChain: string
  customEndpoint: string
  delegationModel: string
  delegationProvider: string
  delegationEndpoint: string
  clarifyTimeout: number
  cliToolsetPreset: string
  messagingToolsetPreset: string
  showToolCalls: boolean
  persistModel: boolean
  reasoningEffort: string
  toolUseEnforcement: string
  maxTurns: number
  autonomy: number
  toolBudget: number
  maxParallelAgents: number
  autoRetry: boolean
  showPlan: boolean
  toolProgress: ToolProgress
  compactOutput: boolean
  showReasoning: boolean
  showCost: boolean
  runtimeFooter: boolean
  streaming: boolean
  resumeDisplay: string
  bellOnComplete: boolean
  toolPreviewLength: number
  toolProgressCommand: boolean
  memoryEnabled: boolean
  userProfileEnabled: boolean
  memoryCharLimit: number
  userCharLimit: number
  sessionRecall: boolean
  contextBudget: number
  maxContextFiles: number
  autoCompact: boolean
  compactionThreshold: number
  compressionEnabled: boolean
  compressionThreshold: number
  compressionTargetRatio: number
  protectLastN: number
  summaryProvider: string
  summaryModel: string
  summaryBaseUrl: string
  terminalBackend: TerminalBackend
  terminalCwd: string
  terminalTimeout: number
  terminalPersistent: boolean
  terminalCpu: number
  terminalMemory: number
  terminalDisk: number
  dockerImage: string
  sshHost: string
  sshUser: string
  sshPort: number
  sandboxMountCwd: boolean
  envPassthrough: string
  ttsProvider: string
  ttsVoice: string
  ttsModel: string
  sttProvider: string
  sttLocalModel: string
  visionProvider: string
  visionModel: string
  visionTimeout: number
  webBackend: string
  webExtractBackend: string
  webKeylessFallback: boolean
  webKeylessRescue: boolean
  browserCloudProvider: string
  browserInactivityTimeout: number
  browserCommandTimeout: number
  browserRecordSessions: boolean
  browserCdpUrl: string
  browserDialogPolicy: string
  browserDialogTimeout: number
  browserPersistence: boolean
  imageProvider: string
  apiServerEnabled: boolean
  apiServerHost: string
  apiServerPort: number
  apiServerMaxRuns: number
  gatewayStreaming: boolean
  gatewayEditInterval: number
  telegramEnabled: boolean
  discordEnabled: boolean
  slackEnabled: boolean
  whatsappEnabled: boolean
  signalEnabled: boolean
  homeAssistantEnabled: boolean
  redactPii: boolean
  telemetry: boolean
  crashReports: boolean
  secretsRedaction: boolean
  networkGuard: boolean
  shellConfirmation: boolean
  gitForceGuard: boolean
  safeMode: boolean
  approvalMode: string
  checkpointsEnabled: boolean
  maxSnapshots: number
  mcpAutoDiscover: boolean
  mcpTimeout: number
  mcpServers: string[]
  cronEnabled: boolean
  wakeEnabled: boolean
  backgroundAgents: boolean
  schedulePolicy: string
  scheduleConcurrency: number
  completionNotifications: boolean
  humanDelayMode: string
  humanDelayMinMs: number
  humanDelayMaxMs: number
  clearOnExit: boolean
  debugMode: boolean
  experimentalFeatures: boolean
  runtimeNofileSoftLimit: number
  codeExecutionMode: string
  codeExecutionTimeout: number
  codeExecutionMaxToolCalls: number
  mcpResultSizeChars: number
  genericResultSizeChars: number
  stallGuards: boolean
  turnLivenessTimeout: number
  turnLivenessPoll: number
  timezone: string
  soulFile: string
  contextFilePriority: string
  leftSidebarVisible: boolean
  agentInspectorVisible: boolean
  bottomDockVisible: boolean
  activityRailCompact: boolean
  statusBarVisible: boolean
  showTooltips: boolean
  commandShortcutsVisible: boolean
  hoverPreview: boolean
  notificationPosition: string
  keymapProfile: string
  shortcutPalette: string
  shortcutNewChat: string
  disabledToolsets: string[]
  multiplexProfiles: boolean
  profileRouting: string
}

interface SettingsSurfaceProps {
  notify: (message: string) => void
}

const defaults: SettingsState = {
  theme: 'Monochrome',
  accent: 'White',
  density: 'Comfortable',
  uiScale: 100,
  fontSize: 13,
  sidebarWidth: 270,
  inspectorWidth: 320,
  language: 'English',
  workspaceName: 'Personal workspace',
  startupView: 'Command Center',
  defaultModel: 'Auto route',
  defaultProvider: 'Automatic',
  defaultAgent: 'Builder',
  modelAlias: 'fast → qwen3-coder',
  fallbackChain: 'Auto → OpenRouter → Nous → local',
  customEndpoint: '',
  delegationModel: 'Inherit parent',
  delegationProvider: 'Inherit parent',
  delegationEndpoint: '',
  clarifyTimeout: 120,
  cliToolsetPreset: 'hermes-cli',
  messagingToolsetPreset: 'hermes-telegram',
  showToolCalls: true,
  persistModel: true,
  reasoningEffort: 'medium',
  toolUseEnforcement: 'auto',
  maxTurns: 90,
  autonomy: 58,
  toolBudget: 72,
  maxParallelAgents: 4,
  autoRetry: true,
  showPlan: true,
  toolProgress: 'all',
  compactOutput: false,
  showReasoning: true,
  showCost: false,
  streaming: true,
  runtimeFooter: false,
  resumeDisplay: 'full',
  bellOnComplete: false,
  toolPreviewLength: 160,
  toolProgressCommand: true,
  memoryEnabled: true,
  userProfileEnabled: true,
  memoryCharLimit: 2200,
  userCharLimit: 1375,
  sessionRecall: true,
  contextBudget: 72,
  maxContextFiles: 24,
  autoCompact: true,
  compactionThreshold: 78,
  compressionEnabled: true,
  compressionThreshold: 50,
  compressionTargetRatio: 20,
  protectLastN: 20,
  summaryProvider: 'auto',
  summaryModel: 'Auto summary model',
  summaryBaseUrl: '',
  terminalBackend: 'local',
  terminalCwd: '.',
  terminalTimeout: 180,
  terminalPersistent: true,
  terminalCpu: 1,
  terminalMemory: 5120,
  terminalDisk: 51200,
  dockerImage: 'python-nodejs:20',
  sshHost: '',
  sshUser: '',
  sshPort: 22,
  sandboxMountCwd: false,
  envPassthrough: '',
  ttsProvider: 'edge',
  ttsVoice: 'en-US-AriaNeural',
  ttsModel: 'default',
  sttProvider: 'local',
  sttLocalModel: 'base',
  visionProvider: 'auto',
  visionModel: 'Auto vision model',
  visionTimeout: 30,
  webBackend: 'auto',
  webExtractBackend: 'auto',
  webKeylessFallback: true,
  webKeylessRescue: true,
  browserCloudProvider: 'none',
  browserInactivityTimeout: 120,
  browserCommandTimeout: 30,
  browserRecordSessions: false,
  browserCdpUrl: '',
  browserDialogPolicy: 'must_respond',
  browserDialogTimeout: 300,
  browserPersistence: false,
  imageProvider: 'auto',
  apiServerEnabled: false,
  apiServerHost: '127.0.0.1',
  apiServerPort: 8642,
  apiServerMaxRuns: 10,
  gatewayStreaming: true,
  gatewayEditInterval: 0.3,
  telegramEnabled: false,
  discordEnabled: false,
  slackEnabled: false,
  whatsappEnabled: false,
  signalEnabled: false,
  homeAssistantEnabled: false,
  redactPii: true,
  telemetry: false,
  crashReports: false,
  secretsRedaction: true,
  networkGuard: true,
  shellConfirmation: true,
  gitForceGuard: true,
  safeMode: true,
  approvalMode: 'smart',
  checkpointsEnabled: true,
  maxSnapshots: 50,
  mcpAutoDiscover: true,
  mcpTimeout: 120,
  mcpServers: ['filesystem', 'github', 'browser'],
  cronEnabled: true,
  wakeEnabled: false,
  backgroundAgents: true,
  schedulePolicy: 'bounded',
  scheduleConcurrency: 4,
  completionNotifications: true,
  humanDelayMode: 'off',
  humanDelayMinMs: 800,
  humanDelayMaxMs: 2500,
  clearOnExit: false,
  debugMode: false,
  experimentalFeatures: false,
  runtimeNofileSoftLimit: 4096,
  codeExecutionMode: 'project',
  codeExecutionTimeout: 300,
  codeExecutionMaxToolCalls: 50,
  mcpResultSizeChars: 50000,
  genericResultSizeChars: 100000,
  stallGuards: true,
  turnLivenessTimeout: 600,
  turnLivenessPoll: 15,
  timezone: '',
  soulFile: 'SOUL.md',
  contextFilePriority: '.hermes.md → AGENTS.md → CLAUDE.md → .cursorrules',
  leftSidebarVisible: true,
  agentInspectorVisible: true,
  bottomDockVisible: false,
  activityRailCompact: true,
  statusBarVisible: true,
  showTooltips: true,
  commandShortcutsVisible: true,
  hoverPreview: true,
  notificationPosition: 'top-right',
  keymapProfile: 'Default',
  shortcutPalette: '⌘K',
  shortcutNewChat: '⌘N',
  disabledToolsets: [],
  multiplexProfiles: false,
  profileRouting: 'sticky active profile',
}

const sections: Array<{ id: SectionId; label: string; detail: string; icon: IconName; group: string }> = [
  { id: 'overview', label: 'Overview', detail: 'Profile, precedence and quick state', icon: 'home', group: 'Core' },
  { id: 'profiles', label: 'Profiles', detail: 'Independent agent configurations', icon: 'users', group: 'Core' },
  { id: 'models', label: 'Models & Providers', detail: 'Default model, provider and aliases', icon: 'network', group: 'AI' },
  { id: 'agent', label: 'Agent', detail: 'Reasoning, turns and delegation', icon: 'bot', group: 'AI' },
  { id: 'tools', label: 'Tools & Toolsets', detail: 'Tool visibility and platform sets', icon: 'tool', group: 'AI' },
  { id: 'terminal', label: 'Terminal & Sandbox', detail: 'Execution backend and resources', icon: 'terminal', group: 'Execution' },
  { id: 'context', label: 'Context & Memory', detail: 'Memory, recall and working context', icon: 'database', group: 'Context' },
  { id: 'compression', label: 'Compression & Cache', detail: 'Compaction and context preservation', icon: 'archive', group: 'Context' },
  { id: 'display', label: 'Display & Theme', detail: 'Skin, density, motion and output', icon: 'spark', group: 'Interface' },
  { id: 'layout', label: 'Workspace Layout', detail: 'Panels, dock, rail, widths and chrome', icon: 'layout', group: 'Interface' },
  { id: 'voice', label: 'Voice & Media', detail: 'TTS, STT, vision and media', icon: 'mic', group: 'Interface' },
  { id: 'web', label: 'Web Search', detail: 'Search/extract backends and keyless fallback', icon: 'search', group: 'Interface' },
  { id: 'browser', label: 'Browser Automation', detail: 'Sessions, CDP, dialogs and persistence', icon: 'globe', group: 'Interface' },
  { id: 'gateway', label: 'Gateway & Channels', detail: 'API server, streaming and messaging', icon: 'globe', group: 'Integrations' },
  { id: 'mcp', label: 'MCP', detail: 'Servers, discovery and timeouts', icon: 'network', group: 'Integrations' },
  { id: 'automation', label: 'Automation', detail: 'Cron, wake word and background runs', icon: 'calendar', group: 'Operations' },
  { id: 'security', label: 'Security & Privacy', detail: 'Approvals, redaction and recovery', icon: 'lock', group: 'Operations' },
  { id: 'security', label: 'Security & Privacy', detail: 'Approvals, redaction and recovery', icon: 'lock', group: 'Operations' },
  { id: 'runtime', label: 'Runtime & Liveness', detail: 'Limits, spillover, code execution and anti-stall', icon: 'activity', group: 'Advanced' },
  { id: 'shortcuts', label: 'Shortcuts', detail: 'Keymap and custom workspace commands', icon: 'command', group: 'Advanced' },
  { id: 'advanced', label: 'Advanced / Raw Config', detail: 'Portable snapshot and expert controls', icon: 'sliders', group: 'Advanced' },
]

const models = ['Auto route', 'GPT-OSS 120B', 'Qwen3 Coder', 'DeepSeek', 'Claude', 'Gemini', 'Codex', 'Local model', 'Custom endpoint']
const providers = ['Automatic', 'OpenRouter', 'Nous', 'Anthropic', 'OpenAI', 'Copilot', 'Z.ai', 'Kimi', 'MiniMax', 'Custom']
const agents = ['Builder', 'Reviewer', 'Researcher', 'Planner', 'Debugger', 'Custom']
const toolsetPresets = ['all', 'coding', 'research', 'minimal', 'messaging', 'hermes-cli', 'hermes-telegram', 'custom']
const channels = ['telegram', 'discord', 'slack', 'whatsapp', 'signal', 'homeassistant']
const previewModes: ToolProgress[] = ['off', 'new', 'all', 'verbose']

function readSaved(): { settings: SettingsState; profiles: Profile[]; activeProfileId: string } | null {
  try {
    const raw = window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<{ settings: SettingsState; profiles: Profile[]; activeProfileId: string }>
    if (!parsed.settings) return null
    return { settings: { ...defaults, ...parsed.settings }, profiles: parsed.profiles ?? defaultProfiles, activeProfileId: parsed.activeProfileId ?? 'default' }
  } catch {
    return null
  }
}

const defaultProfiles: Profile[] = [
  { id: 'default', name: 'Default', description: 'General purpose assistant', model: 'Auto route', provider: 'Automatic', agent: 'Builder', active: true, gatewayEnabled: true, skillsCount: 12, mcpCount: 3 },
  { id: 'coder', name: 'Coder', description: 'Deep code work and terminal tasks', model: 'Qwen3 Coder', provider: 'OpenRouter', agent: 'Builder', active: false, gatewayEnabled: false, skillsCount: 8, mcpCount: 2 },
  { id: 'research', name: 'Research', description: 'Web research, recall and evidence', model: 'Gemini', provider: 'Automatic', agent: 'Researcher', active: false, gatewayEnabled: false, skillsCount: 11, mcpCount: 4 },
]

export default function SettingsStudio({ notify }: SettingsSurfaceProps) {
  const saved = useMemo(readSaved, [])
  const [section, setSection] = useState<SectionId>('overview')
  const [settings, setSettings] = useState<SettingsState>(saved?.settings ?? defaults)
  const [profiles, setProfiles] = useState<Profile[]>(saved?.profiles ?? defaultProfiles)
  const [activeProfileId, setActiveProfileId] = useState(saved?.activeProfileId ?? 'default')
  const [query, setQuery] = useState('')
  const [dirty, setDirty] = useState(false)
  const [advancedJson, setAdvancedJson] = useState('')
  const [newProfile, setNewProfile] = useState('')
  const [newMcpServer, setNewMcpServer] = useState('')

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0]
  const enabledCount = useMemo(() => Object.entries(settings).filter(([key, value]) => typeof value === 'boolean' && value && key !== 'debugMode').length, [settings])

  useEffect(() => {
    document.documentElement.dataset.agenticosTheme = settings.theme.toLowerCase().replace(/\s+/g, '-')
    document.documentElement.dataset.agenticosAccent = settings.accent.toLowerCase()
    document.documentElement.dataset.agenticosDensity = settings.density.toLowerCase()
    document.documentElement.style.setProperty('--agenticos-ui-scale', String(settings.uiScale / 100))
    document.documentElement.style.setProperty('--agenticos-font-size', settings.fontSize + 'px')
    applyUiLayoutPreferences(settings)
  }, [settings])

  useEffect(() => {
    setAdvancedJson(JSON.stringify(toPortableConfig(settings, profiles, activeProfileId), null, 2))
  }, [settings, profiles, activeProfileId])

  useEffect(() => {
    if (!query.trim()) return
    const normalized = query.toLowerCase()
    const match = sections.find((item) => (item.label + ' ' + item.detail).toLowerCase().includes(normalized))
    if (match) setSection(match.id)
  }, [query])

  function update<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
    setDirty(true)
  }

  function updateProfile(id: string, patch: Partial<Profile>) {
    setProfiles((current) => current.map((profile) => profile.id === id ? { ...profile, ...patch } : profile))
    setDirty(true)
  }

  function selectProfile(id: string) {
    setActiveProfileId(id)
    setProfiles((current) => current.map((profile) => ({ ...profile, active: profile.id === id })))
    const next = profiles.find((profile) => profile.id === id)
    if (next) {
      update('defaultModel', next.model)
      update('defaultProvider', next.provider)
      update('defaultAgent', next.agent)
    }
  }

  function cloneActiveProfile() {
    const source = activeProfile
    if (!source) return
    const base = source.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'profile'
    let id = base + '-copy'
    let suffix = 2
    while (profiles.some((profile) => profile.id === id)) id = base + '-copy-' + suffix++
    setProfiles((current) => [...current, { ...source, id, name: source.name + ' Copy', active: false }])
    setDirty(true)
    notify('Profile cloned locally')
  }

  function toggleDisabledToolset(name: string) {
    setSettings((current) => ({
      ...current,
      disabledToolsets: current.disabledToolsets.includes(name)
        ? current.disabledToolsets.filter((item) => item !== name)
        : [...current.disabledToolsets, name],
    }))
    setDirty(true)
  }

  function updateActiveProfile(patch: Partial<Profile>) {
    if (!activeProfile) return
    updateProfile(activeProfile.id, patch)
  }

  function createProfile() {
    const name = newProfile.trim()
    if (!name) return
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'profile'
    if (profiles.some((profile) => profile.id === id)) {
      notify('A profile with that name already exists')
      return
    }
    const profile: Profile = { id, name, description: 'New isolated agent profile', model: settings.defaultModel, provider: settings.defaultProvider, agent: settings.defaultAgent, active: false, gatewayEnabled: false, skillsCount: 0, mcpCount: 0 }
    setProfiles((current) => [...current, profile])
    setNewProfile('')
    setDirty(true)
    notify('Profile created locally')
  }

  function removeProfile(id: string) {
    if (profiles.length <= 1 || id === 'default') {
      notify('The default profile cannot be removed')
      return
    }
    if (!window.confirm('Delete this local preview profile?')) return
    const remaining = profiles.filter((profile) => profile.id !== id)
    setProfiles(remaining)
    if (activeProfileId === id) setActiveProfileId(remaining[0].id)
    setDirty(true)
  }

  function save() {
    try {
      window.localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify({ settings, profiles, activeProfileId }))
      applyUiLayoutPreferences(settings)
      emitUiPreferencesChanged()
      setDirty(false)
      notify('Configuration saved locally')
    } catch {
      notify('Local storage is unavailable in this desktop context')
    }
  }

  function reset() {
    if (!window.confirm('Restore AgentiCOS UI configuration to defaults?')) return
    setSettings(defaults)
    setProfiles(defaultProfiles)
    setActiveProfileId('default')
    setDirty(false)
    try { window.localStorage.removeItem(UI_PREFERENCES_STORAGE_KEY) } catch { /* optional */ }
    notify('Configuration restored to defaults')
  }

  function exportConfig() {
    const blob = new Blob([JSON.stringify(toPortableConfig(settings, profiles, activeProfileId), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'agenticos-config.json'
    link.click()
    URL.revokeObjectURL(url)
    notify('Portable configuration exported')
  }

  function importConfig(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<{ settings: SettingsState; profiles: Profile[]; activeProfileId: string }>
        if (!parsed.settings || typeof parsed.settings !== 'object') throw new Error('Invalid configuration')
        setSettings({ ...defaults, ...parsed.settings })
        setProfiles(parsed.profiles?.length ? parsed.profiles : defaultProfiles)
        setActiveProfileId(parsed.activeProfileId ?? 'default')
        setDirty(true)
        notify('Configuration imported into preview')
      } catch {
        notify('Invalid configuration snapshot')
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  function applyRawConfig() {
    try {
      const parsed = JSON.parse(advancedJson) as Partial<{ settings: SettingsState; profiles: Profile[]; activeProfileId: string }>
      if (!parsed.settings || typeof parsed.settings !== 'object') throw new Error('Missing settings object')
      setSettings({ ...defaults, ...parsed.settings })
      setProfiles(parsed.profiles?.length ? parsed.profiles : defaultProfiles)
      setActiveProfileId(parsed.activeProfileId ?? 'default')
      setDirty(true)
      notify('Raw configuration applied to preview')
    } catch {
      notify('Raw configuration must be valid JSON')
    }
  }

  const visibleSections = sections.filter((item) => {
    const value = (item.label + ' ' + item.detail + ' ' + item.group).toLowerCase()
    return !query.trim() || value.includes(query.trim().toLowerCase())
  })

  return (
    <section className="settings-surface settings-surface--hermes">
      <header className="settings-hero settings-hero--hermes">
        <div className="settings-hero__copy">
          <div className="settings-kicker"><span className="status-dot status-dot--live" /> Control Center</div>
          <h1>Settings</h1>
          <p>Deep configuration for models, agent behavior, toolsets, sandboxes, memory, compression, display, voice, gateway, MCP, automation and security.</p>
          <div className="settings-profile-strip">
            <button type="button" className="settings-profile-switcher" onClick={() => setSection('profiles')}>
              <span className="workspace-avatar">{activeProfile?.name.slice(0, 1).toUpperCase() ?? 'A'}</span>
              <span><strong>{activeProfile?.name ?? 'Default'}</strong><small>{activeProfile?.description ?? 'General purpose assistant'}</small></span>
              <Icon name="chevron-right" size={14} />
            </button>
            <span className={dirty ? 'settings-state settings-state--dirty' : 'settings-state'}>{dirty ? 'Unsaved changes' : 'Saved'}</span>
          </div>
        </div>
        <div className="settings-hero__actions">
          <label className="settings-import-button">
            <Icon name="upload" size={14} /> Import
            <input type="file" accept="application/json,.json" onChange={importConfig} />
          </label>
          <button className="studio-button" type="button" onClick={exportConfig}><Icon name="download" size={14} /> Export</button>
          <button className="studio-button" type="button" onClick={reset}><Icon name="refresh" size={14} /> Reset</button>
          <button className={dirty ? 'studio-button studio-button--active' : 'studio-button'} type="button" onClick={save}><Icon name="check" size={14} /> {dirty ? 'Save changes' : 'Saved'}</button>
        </div>
      </header>

      <div className="settings-topbar">
        <div className="settings-search"><Icon name="search" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search every setting, section or capability…" /><kbd>⌘K</kbd></div>
        <div className="settings-topbar__meta"><span>{sections.length} configuration domains</span><span>{enabledCount} enabled controls</span><span>Profile: {activeProfile?.name ?? 'Default'}</span></div>
      </div>

      <div className="settings-workbench settings-workbench--hermes">
        <aside className="settings-nav settings-nav--hermes" aria-label="Settings sections">
          {visibleSections.map((item) => (
            <button type="button" className={section === item.id ? 'settings-nav__item settings-nav__item--active' : 'settings-nav__item'} onClick={() => setSection(item.id)} key={item.id}>
              <span className="settings-nav__icon"><Icon name={item.icon} size={14} /></span>
              <span><strong>{item.label}</strong><small>{item.detail}</small></span>
              {section === item.id && <span className="settings-nav__indicator" />}
            </button>
          ))}
        </aside>

        <main className="settings-panel settings-panel--hermes">
          {section === 'overview' && (
            <SettingsPage title="Overview" description="See how the configuration is organized before changing individual domains.">
              <div className="settings-status-grid">
                <StatusCard label="Active profile" value={activeProfile?.name ?? 'Default'} detail={activeProfile?.description ?? 'General purpose'} icon="users" />
                <StatusCard label="Default model" value={settings.defaultModel} detail={settings.defaultProvider} icon="network" />
                <StatusCard label="Agent mode" value={settings.defaultAgent} detail={settings.reasoningEffort + ' reasoning'} icon="bot" />
                <StatusCard label="Terminal" value={settings.terminalBackend} detail={settings.terminalTimeout + 's timeout'} icon="terminal" />
              </div>
              <InfoBanner icon="layers" title="Configuration precedence" text="CLI/session overrides are conceptually highest, followed by profile/runtime configuration, then environment secrets, then built-in defaults. AgentiCOS keeps this presentation separate from the Rust runtime until the service contract is connected." />
              <div className="settings-card-grid">
                {[
                  ['Models', 'Provider, model, fallback and aliases', 'models'],
                  ['Agent', 'Reasoning, tool enforcement, budgets and delegation', 'agent'],
                  ['Execution', 'Terminal backend, resources and sandbox options', 'terminal'],
                  ['Context', 'Memory, recall and compaction controls', 'context'],
                  ['Display', 'Skin, progress, density and UI personalization', 'display'],
                  ['Integrations', 'Gateway, channels and MCP servers', 'gateway'],
                ].map(([title, detail, id]) => (
                  <button type="button" className="settings-domain-card" key={id} onClick={() => setSection(id as SectionId)}>
                    <span className="settings-domain-card__index">{String(sections.findIndex((item) => item.id === id) + 1).padStart(2, '0')}</span>
                    <span><strong>{title}</strong><small>{detail}</small></span><Icon name="chevron-right" size={14} />
                  </button>
                ))}
              </div>
            </SettingsPage>
          )}

          {section === 'profiles' && (
            <SettingsPage title="Profiles" description="Each profile is an independent configuration boundary. This UI models Hermes-style profile isolation while remaining local/preview.">
              <div className="profile-create-row">
                <input value={newProfile} onChange={(event) => setNewProfile(event.target.value)} className="settings-input" placeholder="Create profile: coder, research, personal…" />
                <button className="studio-button" type="button" onClick={cloneActiveProfile}><Icon name="copy" size={14} /> Clone active</button>
                <button className="studio-button studio-button--active" type="button" onClick={createProfile}><Icon name="plus" size={14} /> Create profile</button>
              </div>
              <div className="profile-grid">
                {profiles.map((profile) => (
                  <article key={profile.id} className={profile.id === activeProfileId ? 'profile-card profile-card--active' : 'profile-card'}>
                    <button type="button" className="profile-card__main" onClick={() => selectProfile(profile.id)}>
                      <div className="profile-card__top"><span className="profile-avatar">{profile.name.slice(0, 1).toUpperCase()}</span><span className="profile-card__status">{profile.id === activeProfileId ? 'ACTIVE' : 'READY'}</span></div>
                      <strong>{profile.name}</strong><small>{profile.description}</small>
                      <div className="profile-card__meta"><span>{profile.model}</span><span>{profile.provider}</span><span>{profile.agent}</span></div>
                    </button>
                    {profile.id !== 'default' && <button type="button" className="icon-button" title="Delete local profile" aria-label={'Delete ' + profile.name} onClick={() => removeProfile(profile.id)}><Icon name="x" size={13} /></button>}
                  </article>
                ))}
              </div>
              <SettingSection title="Active profile controls">
                <TextField label="Profile description" value={activeProfile?.description ?? ''} onChange={(v) => updateActiveProfile({ description: v })} />
                <SelectField label="Profile model" value={activeProfile?.model ?? settings.defaultModel} onChange={(v) => updateActiveProfile({ model: v })} options={models} />
                <SelectField label="Profile provider" value={activeProfile?.provider ?? settings.defaultProvider} onChange={(v) => updateActiveProfile({ provider: v })} options={providers} />
                <SelectField label="Profile agent" value={activeProfile?.agent ?? settings.defaultAgent} onChange={(v) => updateActiveProfile({ agent: v })} options={agents} />
                <ToggleRow label="Profile gateway" detail="Keep this profile eligible for gateway delivery when the runtime supports it." enabled={Boolean(activeProfile?.gatewayEnabled)} onChange={() => updateActiveProfile({ gatewayEnabled: !activeProfile?.gatewayEnabled })} />
                <InfoBanner icon="spark" title="Profile assets" text={(activeProfile?.skillsCount ?? 0) + ' skills · ' + (activeProfile?.mcpCount ?? 0) + ' MCP servers · independent model and gateway state.'} />
              </SettingSection>
              <InfoBanner icon="users" title="Isolated state model" text="Profile-specific config, memory, sessions, skills, cron jobs, SOUL and gateway state are represented as separate domains. Runtime persistence remains owned by the backend." />
            </SettingsPage>
          )}

          {section === 'models' && (
            <SettingsPage title="Models & Providers" description="Configure primary model routing, provider selection and fallback behavior.">
              <SettingSection title="Primary route">
                <SelectField label="Default model" value={settings.defaultModel} onChange={(v) => update('defaultModel', v)} options={models} />
                <SelectField label="Default provider" value={settings.defaultProvider} onChange={(v) => update('defaultProvider', v)} options={providers} />
                <ToggleRow label="Persist model switches" detail="Keep model/provider choices as profile defaults." enabled={settings.persistModel} onChange={() => update('persistModel', !settings.persistModel)} />
              </SettingSection>
              <SettingSection title="Aliases & fallback">
                <TextField label="Model alias" value={settings.modelAlias} onChange={(v) => update('modelAlias', v)} />
                <TextField label="Fallback chain" value={settings.fallbackChain} onChange={(v) => update('fallbackChain', v)} />
                <TextField label="Custom endpoint" value={settings.customEndpoint} onChange={(v) => update('customEndpoint', v)} placeholder="https://host/v1" />
                <InfoBanner icon="network" title="Credential boundary" text="API keys, OAuth tokens and passwords are never rendered as editable secret text in this surface." />
              </SettingSection>
              <SettingSection title="Auxiliary models">
                <SelectField label="Vision provider" value={settings.visionProvider} onChange={(v) => update('visionProvider', v)} options={['auto', 'openrouter', 'nous', 'codex', 'main', 'custom']} />
                <SelectField label="Vision model" value={settings.visionModel} onChange={(v) => update('visionModel', v)} options={['Auto vision model', 'Gemini Flash', 'GPT-4o', 'Local vision model', 'Custom']} />
                <SelectField label="Compression summary provider" value={settings.summaryProvider} onChange={(v) => update('summaryProvider', v)} options={['auto', 'openrouter', 'nous', 'codex', 'main', 'custom']} />
                <SelectField label="Compression summary model" value={settings.summaryModel} onChange={(v) => update('summaryModel', v)} options={['Auto summary model', 'Gemini Flash', 'Qwen', 'DeepSeek', 'Local model']} />
              </SettingSection>
            </SettingsPage>
          )}

          {section === 'agent' && (
            <SettingsPage title="Agent" description="Expose the operational controls that shape Hermes-style agent behavior.">
              <SettingSection title="Reasoning & execution">
                <SelectField label="Reasoning effort" value={settings.reasoningEffort} onChange={(v) => update('reasoningEffort', v)} options={['none', 'minimal', 'low', 'medium', 'high', 'xhigh']} />
                <SelectField label="Tool-use enforcement" value={settings.toolUseEnforcement} onChange={(v) => update('toolUseEnforcement', v)} options={['auto', 'true', 'false', 'model-substrings']} />
                <NumberField label="Max turns" value={settings.maxTurns} onChange={(v) => update('maxTurns', v)} suffix="turns" min={1} max={500} />
                <NumberField label="Max parallel agents" value={settings.maxParallelAgents} onChange={(v) => update('maxParallelAgents', v)} suffix="agents" min={1} max={32} />
                <ToggleRow label="Bounded automatic retry" detail="Retry only recoverable failures and keep the attempt budget visible." enabled={settings.autoRetry} onChange={() => update('autoRetry', !settings.autoRetry)} />
                <ToggleRow label="Show plan stage" detail="Expose planning before execution in the workspace." enabled={settings.showPlan} onChange={() => update('showPlan', !settings.showPlan)} />
              </SettingSection>
              <SettingSection title="Delegation">
                <SelectField label="Delegation model" value={settings.delegationModel} onChange={(v) => update('delegationModel', v)} options={['Inherit parent', 'Fast model', 'Qwen3 Coder', 'Gemini Flash', 'Custom']} />
                <SelectField label="Delegation provider" value={settings.delegationProvider} onChange={(v) => update('delegationProvider', v)} options={['Inherit parent', 'OpenRouter', 'Nous', 'Custom']} />
                <TextField label="Delegation endpoint" value={settings.delegationEndpoint} onChange={(v) => update('delegationEndpoint', v)} placeholder="https://host/v1" />
                <NumberField label="Clarification timeout" value={settings.clarifyTimeout} onChange={(v) => update('clarifyTimeout', v)} suffix="seconds" min={5} max={1800} />
                <RangeField label="Autonomy" value={settings.autonomy} onChange={(v) => update('autonomy', v)} description="Presentation-only autonomy indicator." />
                <RangeField label="Tool budget" value={settings.toolBudget} onChange={(v) => update('toolBudget', v)} description="Presentation-only tool activity budget." />
              </SettingSection>
            </SettingsPage>
          )}

          {section === 'tools' && (
            <SettingsPage title="Tools & Toolsets" description="Build custom tool access per platform instead of treating every tool as globally enabled.">
              <SettingSection title="Tool behavior">
                <ToggleRow label="Show tool calls" detail="Display tool lifecycle activity in chat and run views." enabled={settings.showToolCalls} onChange={() => update('showToolCalls', !settings.showToolCalls)} />
                <ToggleRow label="Auto-approve read-only tools" detail="Keep safe reads frictionless while preserving write confirmation." enabled={settings.safeMode} onChange={() => update('safeMode', !settings.safeMode)} />
                <SelectField label="CLI toolset preset" value={settings.cliToolsetPreset} onChange={(v) => update('cliToolsetPreset', v)} options={toolsetPresets} />
                <SelectField label="Messaging toolset preset" value={settings.messagingToolsetPreset} onChange={(v) => update('messagingToolsetPreset', v)} options={toolsetPresets} />
              </SettingSection>
              <SettingSection title="Per-platform toolsets">
                <div className="settings-chip-grid">
                  {channels.map((channel) => <button type="button" className="settings-chip settings-chip--active" key={channel} onClick={() => notify(channel + ' toolset opened in preview')}><Icon name="tool" size={12} /> {channel}<span>custom</span></button>)}
                </div>
              </SettingSection>
              <SettingSection title="Global disabled toolsets">
                <div className="settings-chip-grid">
                  {['web', 'terminal', 'file', 'browser', 'vision', 'image_gen', 'tts', 'memory', 'session_search', 'cronjob', 'delegation', 'code_execution', 'homeassistant', 'mcp', 'rl'].map((toolset) => {
                    const disabled = settings.disabledToolsets.includes(toolset)
                    return <button type="button" key={toolset} className={disabled ? 'settings-chip settings-chip--active' : 'settings-chip'} onClick={() => toggleDisabledToolset(toolset)}><Icon name={disabled ? 'lock' : 'tool'} size={12} /> {toolset}<span>{disabled ? 'disabled' : 'enabled'}</span></button>
                  })}
                </div>
                <small className="settings-inline-note">A globally disabled toolset stays suppressed even when a platform preset enables it.</small>
              </SettingSection>
              <SettingSection title="Tool inventory">
                <div className="settings-tool-grid">
                  {['web', 'terminal', 'file', 'browser', 'vision', 'image', 'tts', 'skills', 'todo', 'cronjob', 'mcp', 'delegate'].map((tool) => <div className="settings-tool-card" key={tool}><span className="settings-tool-card__icon"><Icon name={tool === 'terminal' ? 'terminal' : tool === 'file' ? 'file' : tool === 'browser' ? 'globe' : tool === 'mcp' ? 'network' : 'tool'} size={13} /></span><strong>{tool}</strong><small>Available in catalog</small></div>)}
                </div>
              </SettingSection>
            </SettingsPage>
          )}

          {section === 'terminal' && (
            <SettingsPage title="Terminal & Sandbox" description="Select where commands run and tune the runtime envelope without hiding the security tradeoff.">
              <SettingSection title="Backend">
                <SelectField label="Terminal backend" value={settings.terminalBackend} onChange={(v) => update('terminalBackend', v as TerminalBackend)} options={['local', 'docker', 'ssh', 'modal', 'daytona', 'singularity']} />
                <TextField label="Working directory" value={settings.terminalCwd} onChange={(v) => update('terminalCwd', v)} />
                <NumberField label="Command timeout" value={settings.terminalTimeout} onChange={(v) => update('terminalTimeout', v)} suffix="seconds" min={1} max={3600} />
                <ToggleRow label="Persistent terminal state" detail="Preserve shell state where the backend supports it." enabled={settings.terminalPersistent} onChange={() => update('terminalPersistent', !settings.terminalPersistent)} />
              </SettingSection>
              <SettingSection title="Resources">
                <NumberField label="CPU limit" value={settings.terminalCpu} onChange={(v) => update('terminalCpu', v)} suffix="cores" min={0} max={64} />
                <NumberField label="Memory limit" value={settings.terminalMemory} onChange={(v) => update('terminalMemory', v)} suffix="MB" min={0} max={262144} />
                <NumberField label="Disk limit" value={settings.terminalDisk} onChange={(v) => update('terminalDisk', v)} suffix="MB" min={0} max={1048576} />
              </SettingSection>
              <SettingSection title={settings.terminalBackend === 'docker' ? 'Docker' : settings.terminalBackend === 'ssh' ? 'SSH' : 'Backend-specific'}>
                {settings.terminalBackend === 'docker' ? <>
                  <TextField label="Docker image" value={settings.dockerImage} onChange={(v) => update('dockerImage', v)} />
                  <ToggleRow label="Mount current directory" detail="Explicitly opt into sharing the launch directory with the sandbox." enabled={settings.sandboxMountCwd} onChange={() => update('sandboxMountCwd', !settings.sandboxMountCwd)} />
                </> : settings.terminalBackend === 'ssh' ? <>
                  <TextField label="SSH host" value={settings.sshHost} onChange={(v) => update('sshHost', v)} />
                  <TextField label="SSH user" value={settings.sshUser} onChange={(v) => update('sshUser', v)} />
                  <NumberField label="SSH port" value={settings.sshPort} onChange={(v) => update('sshPort', v)} suffix="port" min={1} max={65535} />
                </> : <InfoBanner icon="terminal" title="Backend-specific options" text="Additional options appear when a matching backend is selected. Credentials remain runtime-owned." />}
                <TextField label="Environment passthrough" value={settings.envPassthrough} onChange={(v) => update('envPassthrough', v)} />
              </SettingSection>
            </SettingsPage>
          )}

          {section === 'context' && (
            <SettingsPage title="Context & Memory" description="Control persistent memory, user profile, session recall and context capacity.">
              <SettingSection title="Memory">
                <ToggleRow label="Persistent memory" detail="Maintain cross-session memory records." enabled={settings.memoryEnabled} onChange={() => update('memoryEnabled', !settings.memoryEnabled)} />
                <ToggleRow label="User profile memory" detail="Keep a dedicated user profile alongside general memories." enabled={settings.userProfileEnabled} onChange={() => update('userProfileEnabled', !settings.userProfileEnabled)} />
                <NumberField label="Memory character limit" value={settings.memoryCharLimit} onChange={(v) => update('memoryCharLimit', v)} suffix="chars" min={100} max={20000} />
                <NumberField label="User profile character limit" value={settings.userCharLimit} onChange={(v) => update('userCharLimit', v)} suffix="chars" min={100} max={20000} />
                <ToggleRow label="Session recall" detail="Allow previous session search to feed relevant context." enabled={settings.sessionRecall} onChange={() => update('sessionRecall', !settings.sessionRecall)} />
              </SettingSection>
              <SettingSection title="Context budget">
                <RangeField label="Context budget" value={settings.contextBudget} onChange={(v) => update('contextBudget', v)} description="Visual budget used by the desktop composer." />
                <NumberField label="Maximum context files" value={settings.maxContextFiles} onChange={(v) => update('maxContextFiles', v)} suffix="files" min={1} max={500} />
                <RangeField label="Auto-compaction trigger" value={settings.compactionThreshold} onChange={(v) => update('compactionThreshold', v)} description="Percentage of context capacity at which compaction is staged." />
                <ToggleRow label="Automatic compaction" detail="Compact long conversations before the context limit is reached." enabled={settings.autoCompact} onChange={() => update('autoCompact', !settings.autoCompact)} />
              </SettingSection>
            </SettingsPage>
          )}

          {section === 'compression' && (
            <SettingsPage title="Compression & Cache" description="Expose the knobs that preserve useful recent context while compressing older turns.">
              <SettingSection title="Compression">
                <ToggleRow label="Compression enabled" detail="Automatically summarize long conversations." enabled={settings.compressionEnabled} onChange={() => update('compressionEnabled', !settings.compressionEnabled)} />
                <RangeField label="Compression threshold" value={settings.compressionThreshold} onChange={(v) => update('compressionThreshold', v)} description="Percent of context capacity that triggers compression." />
                <RangeField label="Target ratio" value={settings.compressionTargetRatio} onChange={(v) => update('compressionTargetRatio', v)} description="Target percentage of the threshold retained for recent context." />
                <NumberField label="Protect last N messages" value={settings.protectLastN} onChange={(v) => update('protectLastN', v)} suffix="messages" min={0} max={200} />
              </SettingSection>
              <SettingSection title="Summary model">
                <SelectField label="Summary provider" value={settings.summaryProvider} onChange={(v) => update('summaryProvider', v)} options={['auto', 'openrouter', 'nous', 'codex', 'main', 'custom']} />
                <SelectField label="Summary model" value={settings.summaryModel} onChange={(v) => update('summaryModel', v)} options={['Auto summary model', 'Gemini Flash', 'Qwen', 'DeepSeek', 'Local model']} />
                <TextField label="Summary base URL" value={settings.summaryBaseUrl} onChange={(v) => update('summaryBaseUrl', v)} />
              </SettingSection>
              <InfoBanner icon="archive" title="Fail-safe principle" text="A failed transform should fall back to original content rather than silently corrupting model context." />
            </SettingsPage>
          )}

          {section === 'display' && (
            <SettingsPage title="Display & Theme" description="Personalize the desktop shell, output detail and tool-progress visibility.">
              <SettingSection title="Visual identity">
                <SelectField label="Theme" value={settings.theme} onChange={(v) => update('theme', v as Theme)} options={['Monochrome', 'Graphite', 'Paper', 'High contrast']} />
                <SelectField label="Accent" value={settings.accent} onChange={(v) => update('accent', v as Accent)} options={['White', 'Silver', 'Blue', 'Violet', 'Green']} />
                <SelectField label="Density" value={settings.density} onChange={(v) => update('density', v as Density)} options={['Compact', 'Comfortable', 'Spacious']} />
                <RangeField label="UI scale" value={settings.uiScale} min={80} max={140} onChange={(v) => update('uiScale', v)} description="Applies to the document root." />
                <RangeField label="Font size" value={settings.fontSize} min={11} max={18} onChange={(v) => update('fontSize', v)} description="Base interface font size." />
              </SettingSection>
              <SettingSection title="Output">
                <SelectField label="Tool progress" value={settings.toolProgress} onChange={(v) => update('toolProgress', v as ToolProgress)} options={previewModes} />
                <ToggleRow label="Tool progress command" detail="Expose the /verbose-style control for gateway surfaces." enabled={settings.toolProgressCommand} onChange={() => update('toolProgressCommand', !settings.toolProgressCommand)} />
                <ToggleRow label="Show reasoning" detail="Show reasoning UI when the runtime exposes it." enabled={settings.showReasoning} onChange={() => update('showReasoning', !settings.showReasoning)} />
                <ToggleRow label="Show cost" detail="Expose estimated cost telemetry when available." enabled={settings.showCost} onChange={() => update('showCost', !settings.showCost)} />
                <ToggleRow label="Streaming" detail="Render streaming output where supported." enabled={settings.streaming} onChange={() => update('streaming', !settings.streaming)} />
                <SelectField label="Resume display" value={settings.resumeDisplay} onChange={(v) => update('resumeDisplay', v)} options={['full', 'minimal']} />
                <ToggleRow label="Bell on complete" detail="Optional local completion signal for long-running tasks." enabled={settings.bellOnComplete} onChange={() => update('bellOnComplete', !settings.bellOnComplete)} />
                <NumberField label="Tool preview length" value={settings.toolPreviewLength} onChange={(v) => update('toolPreviewLength', v)} suffix="chars" min={0} max={2000} />
              </SettingSection>
            </SettingsPage>
          )}

          {section === 'layout' && (
            <SettingsPage title="Workspace Layout" description="Configure how much of the desktop chrome is visible and how wide each workspace region should be.">
              <SettingSection title="Panels">
                <ToggleRow label="Left sidebar" detail="Keep workspace and conversation navigation visible." enabled={settings.leftSidebarVisible} onChange={() => update('leftSidebarVisible', !settings.leftSidebarVisible)} />
                <ToggleRow label="Agent inspector" detail="Keep the right-side agent/context/safety inspector visible." enabled={settings.agentInspectorVisible} onChange={() => update('agentInspectorVisible', !settings.agentInspectorVisible)} />
                <ToggleRow label="Bottom dock" detail="Open the terminal/problems/timeline/output dock by default." enabled={settings.bottomDockVisible} onChange={() => update('bottomDockVisible', !settings.bottomDockVisible)} />
                <ToggleRow label="Status bar" detail="Show provider, branch, messages and guardrail state at the bottom." enabled={settings.statusBarVisible} onChange={() => update('statusBarVisible', !settings.statusBarVisible)} />
              </SettingSection>
              <SettingSection title="Navigation chrome">
                <ToggleRow label="Compact activity rail" detail="Use the compact icon rail designed for dense desktop workflows." enabled={settings.activityRailCompact} onChange={() => update('activityRailCompact', !settings.activityRailCompact)} />
                <ToggleRow label="Tooltips" detail="Show labels on navigation hover when the rail is collapsed." enabled={settings.showTooltips} onChange={() => update('showTooltips', !settings.showTooltips)} />
                <ToggleRow label="Hover previews" detail="Allow lightweight preview affordances on interactive surfaces." enabled={settings.hoverPreview} onChange={() => update('hoverPreview', !settings.hoverPreview)} />
                <SelectField label="Notification position" value={settings.notificationPosition} onChange={(v) => update('notificationPosition', v)} options={['top-right', 'top-left', 'bottom-right', 'bottom-left']} />
              </SettingSection>
              <SettingSection title="Workspace geometry">
                <RangeField label="Sidebar width" value={settings.sidebarWidth} min={220} max={380} onChange={(v) => update('sidebarWidth', v)} description="Desktop sidebar width in pixels." />
                <RangeField label="Inspector width" value={settings.inspectorWidth} min={280} max={440} onChange={(v) => update('inspectorWidth', v)} description="Right agent inspector width in pixels." />
              </SettingSection>
              <InfoBanner icon="layout" title="Responsive behavior" text="The shell still collapses panels through keyboard shortcuts and responsive breakpoints. Layout preferences provide the persistent starting geometry." />
            </SettingsPage>
          )}

          {section === 'voice' && (
            <SettingsPage title="Voice & Media" description="Configure speech, TTS, vision, image and web backends behind explicit provider boundaries.">
              <SettingSection title="Text to speech">
                <SelectField label="TTS provider" value={settings.ttsProvider} onChange={(v) => update('ttsProvider', v)} options={['edge', 'elevenlabs', 'openai', 'neutts']} />
                <TextField label="Voice" value={settings.ttsVoice} onChange={(v) => update('ttsVoice', v)} />
                <TextField label="TTS model" value={settings.ttsModel} onChange={(v) => update('ttsModel', v)} />
              </SettingSection>
              <SettingSection title="Speech to text">
                <SelectField label="STT provider" value={settings.sttProvider} onChange={(v) => update('sttProvider', v)} options={['local', 'groq', 'openai']} />
                <SelectField label="Local STT model" value={settings.sttLocalModel} onChange={(v) => update('sttLocalModel', v)} options={['tiny', 'base', 'small', 'medium', 'large-v3']} />
              </SettingSection>
              <SettingSection title="Vision & web">
                <SelectField label="Vision provider" value={settings.visionProvider} onChange={(v) => update('visionProvider', v)} options={['auto', 'openrouter', 'nous', 'codex', 'main', 'custom']} />
                <TextField label="Vision model" value={settings.visionModel} onChange={(v) => update('visionModel', v)} />
                <NumberField label="Vision timeout" value={settings.visionTimeout} onChange={(v) => update('visionTimeout', v)} suffix="seconds" min={1} max={3600} />
                <SelectField label="Web backend" value={settings.webBackend} onChange={(v) => update('webBackend', v)} options={['auto', 'firecrawl', 'parallel', 'tavily', 'exa']} />
                <SelectField label="Browser cloud provider" value={settings.browserCloudProvider} onChange={(v) => update('browserCloudProvider', v)} options={['none', 'Nous', 'Browserbase', 'Custom']} />
                <SelectField label="Image provider" value={settings.imageProvider} onChange={(v) => update('imageProvider', v)} options={['auto', 'Nous', 'OpenAI', 'Fal', 'Local']} />
              </SettingSection>
            </SettingsPage>
          )}

          {section === 'browser' && (
            <SettingsPage title="Browser Automation" description="Tune persistent browser sessions, CDP attachment and native dialog policy.">
              <SettingSection title="Session lifecycle">
                <NumberField label="Inactivity timeout" value={settings.browserInactivityTimeout} onChange={(v) => update('browserInactivityTimeout', v)} suffix="seconds" min={5} max={86400} />
                <NumberField label="Command timeout" value={settings.browserCommandTimeout} onChange={(v) => update('browserCommandTimeout', v)} suffix="seconds" min={1} max={3600} />
                <ToggleRow label="Record sessions" detail="Keep browser session recordings available for verification and debugging." enabled={settings.browserRecordSessions} onChange={() => update('browserRecordSessions', !settings.browserRecordSessions)} />
                <ToggleRow label="Managed persistence" detail="Keep browser cookies and login state across restarts when the backend supports it." enabled={settings.browserPersistence} onChange={() => update('browserPersistence', !settings.browserPersistence)} />
              </SettingSection>
              <SettingSection title="CDP & dialogs">
                <TextField label="CDP URL" value={settings.browserCdpUrl} onChange={(v) => update('browserCdpUrl', v)} placeholder="http://127.0.0.1:9222" />
                <SelectField label="Dialog policy" value={settings.browserDialogPolicy} onChange={(v) => update('browserDialogPolicy', v)} options={['must_respond', 'auto_dismiss', 'auto_accept']} />
                <NumberField label="Dialog timeout" value={settings.browserDialogTimeout} onChange={(v) => update('browserDialogTimeout', v)} suffix="seconds" min={1} max={3600} />
              </SettingSection>
              <InfoBanner icon="globe" title="Browser safety" text="Dialog policy only affects browser UI behavior. Host permissions and credentials remain controlled by the runtime boundary." />
            </SettingsPage>
          )}

          {section === 'gateway' && (
            <SettingsPage title="Gateway & Channels" description="Model the messaging gateway, API server and per-platform output behavior.">
              <SettingSection title="API server">
                <ToggleRow label="API server enabled" detail="Presentation-local server setting; runtime wiring remains outside this UI." enabled={settings.apiServerEnabled} onChange={() => update('apiServerEnabled', !settings.apiServerEnabled)} />
                <TextField label="Host" value={settings.apiServerHost} onChange={(v) => update('apiServerHost', v)} />
                <NumberField label="Port" value={settings.apiServerPort} onChange={(v) => update('apiServerPort', v)} suffix="port" min={1} max={65535} />
                <NumberField label="Max concurrent runs" value={settings.apiServerMaxRuns} onChange={(v) => update('apiServerMaxRuns', v)} suffix="runs" min={0} max={100} />
              </SettingSection>
              <SettingSection title="Gateway streaming">
                <ToggleRow label="Progressive streaming" detail="Edit outgoing messages as model output grows." enabled={settings.gatewayStreaming} onChange={() => update('gatewayStreaming', !settings.gatewayStreaming)} />
                <RangeField label="Edit interval" value={Math.round(settings.gatewayEditInterval * 10)} onChange={(v) => update('gatewayEditInterval', Math.max(.1, v / 10))} description={settings.gatewayEditInterval.toFixed(1) + ' seconds between edits.'} />
              </SettingSection>
              <SettingSection title="Messaging platforms">
                {channels.map((channel) => {
                  const key = channel === 'telegram' ? 'telegramEnabled' : channel === 'discord' ? 'discordEnabled' : channel === 'slack' ? 'slackEnabled' : channel === 'whatsapp' ? 'whatsappEnabled' : channel === 'signal' ? 'signalEnabled' : 'homeAssistantEnabled'
                  return <ToggleRow key={channel} label={channel} detail="Platform connector remains runtime-owned." enabled={settings[key as keyof SettingsState] as boolean} onChange={() => update(key as keyof SettingsState, !(settings[key as keyof SettingsState] as boolean) as never)} />
                })}
              </SettingSection>
            </SettingsPage>
          )}

          {section === 'mcp' && (
            <SettingsPage title="MCP" description="Manage server discovery and the local presentation registry for Model Context Protocol connections.">
              <SettingSection title="MCP runtime behavior">
                <ToggleRow label="Automatic discovery" detail="Discover server capabilities when a connection is initialized." enabled={settings.mcpAutoDiscover} onChange={() => update('mcpAutoDiscover', !settings.mcpAutoDiscover)} />
                <NumberField label="Server timeout" value={settings.mcpTimeout} onChange={(v) => update('mcpTimeout', v)} suffix="seconds" min={1} max={3600} />
              </SettingSection>
              <SettingSection title="Server registry">
                <div className="mcp-add-row"><input className="settings-input" value={newMcpServer} onChange={(event) => setNewMcpServer(event.target.value)} placeholder="server name or URL" /><button className="studio-button studio-button--active" type="button" onClick={() => { const value = newMcpServer.trim(); if (!value) return; setSettings((current) => ({ ...current, mcpServers: [...current.mcpServers, value] })); setNewMcpServer(''); setDirty(true) }}><Icon name="plus" size={13} /> Add</button></div>
                <div className="mcp-server-list">
                  {settings.mcpServers.map((server) => <div className="mcp-server-row" key={server}><span className="settings-tool-card__icon"><Icon name="network" size={13} /></span><div><strong>{server}</strong><small>Ready in preview</small></div><button className="icon-button" type="button" aria-label={'Remove ' + server} title="Remove server" onClick={() => update('mcpServers', settings.mcpServers.filter((item) => item !== server))}><Icon name="x" size={13} /></button></div>)}
                </div>
              </SettingSection>
              <InfoBanner icon="network" title="Credential isolation" text="OAuth headers, tokens and provider secrets are represented only as secure runtime metadata in the future service boundary." />
            </SettingsPage>
          )}

          {section === 'automation' && (
            <SettingsPage title="Automation" description="Configure recurring tasks, wake behavior and background-agent preferences.">
              <SettingSection title="Schedules">
                <ToggleRow label="Cron jobs" detail="Enable the presentation control for recurring scheduled runs." enabled={settings.cronEnabled} onChange={() => update('cronEnabled', !settings.cronEnabled)} />
                <ToggleRow label="Wake word / presence" detail="Expose hands-free activation controls." enabled={settings.wakeEnabled} onChange={() => update('wakeEnabled', !settings.wakeEnabled)} />
                <ToggleRow label="Background agents" detail="Allow long-running runs to remain visible after leaving the current view." enabled={settings.backgroundAgents} onChange={() => update('backgroundAgents', !settings.backgroundAgents)} />
              </SettingSection>
              <SettingSection title="Automation defaults">
                <SelectField label="Default schedule policy" value={settings.schedulePolicy} onChange={(v) => update('schedulePolicy', v)} options={['bounded', 'manual approval', 'always confirm', 'autonomous safe']} />
                <NumberField label="Max scheduled concurrency" value={settings.scheduleConcurrency} onChange={(v) => update('scheduleConcurrency', v)} suffix="runs" min={1} max={32} />
                <ToggleRow label="Notify on completion" detail="Send a notification when a background run finishes." enabled={settings.completionNotifications} onChange={() => update('completionNotifications', !settings.completionNotifications)} />
              </SettingSection>
            </SettingsPage>
          )}

          {section === 'runtime' && (
            <SettingsPage title="Runtime & Liveness" description="Expose Hermes-style runtime safeguards for long sessions, large results and code execution.">
              <SettingSection title="Runtime limits">
                <NumberField label="NOFILE soft limit" value={settings.runtimeNofileSoftLimit} onChange={(v) => update('runtimeNofileSoftLimit', v)} suffix="descriptors" min={0} max={1048576} />
                <NumberField label="Generic spillover threshold" value={settings.genericResultSizeChars} onChange={(v) => update('genericResultSizeChars', v)} suffix="chars" min={1000} max={10000000} />
                <NumberField label="MCP spillover threshold" value={settings.mcpResultSizeChars} onChange={(v) => update('mcpResultSizeChars', v)} suffix="chars" min={1000} max={10000000} />
              </SettingSection>
              <SettingSection title="Code execution">
                <SelectField label="Execution mode" value={settings.codeExecutionMode} onChange={(v) => update('codeExecutionMode', v)} options={['project', 'strict']} />
                <NumberField label="Execution timeout" value={settings.codeExecutionTimeout} onChange={(v) => update('codeExecutionTimeout', v)} suffix="seconds" min={1} max={3600} />
                <NumberField label="Max tool calls" value={settings.codeExecutionMaxToolCalls} onChange={(v) => update('codeExecutionMaxToolCalls', v)} suffix="calls" min={0} max={10000} />
              </SettingSection>
              <SettingSection title="Anti-stall">
                <ToggleRow label="Stall guards" detail="Break repeated identical tool calls and trigger bounded continuation recovery." enabled={settings.stallGuards} onChange={() => update('stallGuards', !settings.stallGuards)} />
                <NumberField label="Turn liveness timeout" value={settings.turnLivenessTimeout} onChange={(v) => update('turnLivenessTimeout', v)} suffix="seconds" min={0} max={86400} />
                <NumberField label="Liveness poll interval" value={settings.turnLivenessPoll} onChange={(v) => update('turnLivenessPoll', v)} suffix="seconds" min={1} max={3600} />
              </SettingSection>
              <SettingSection title="Messaging pacing">
                <SelectField label="Human delay" value={settings.humanDelayMode} onChange={(v) => update('humanDelayMode', v)} options={['off', 'natural', 'custom']} />
                <NumberField label="Minimum delay" value={settings.humanDelayMinMs} onChange={(v) => update('humanDelayMinMs', v)} suffix="ms" min={0} max={60000} />
                <NumberField label="Maximum delay" value={settings.humanDelayMaxMs} onChange={(v) => update('humanDelayMaxMs', v)} suffix="ms" min={0} max={60000} />
              </SettingSection>
              <InfoBanner icon="shield" title="Fail-safe runtime controls" text="These settings describe runtime policy but do not grant permissions from the React UI. Backend enforcement remains authoritative." />
            </SettingsPage>
          )}

          {section === 'security' && (
            <SettingsPage title="Security & Privacy" description="Make the safety boundary explicit. Presentation controls never grant runtime privileges.">
              <SettingSection title="Safety">
                <ToggleRow label="Fail-closed mode" detail="Block privileged UI actions when an authorization state is missing." enabled={settings.safeMode} onChange={() => update('safeMode', !settings.safeMode)} />
                <SelectField label="Approval mode" value={settings.approvalMode} onChange={(v) => update('approvalMode', v)} options={['off', 'smart', 'always', 'manual']} />
                <ToggleRow label="Network guard" detail="Keep outbound network capabilities behind explicit policy." enabled={settings.networkGuard} onChange={() => update('networkGuard', !settings.networkGuard)} />
                <ToggleRow label="Shell confirmation" detail="Require confirmation before presenting high-risk shell execution as permitted." enabled={settings.shellConfirmation} onChange={() => update('shellConfirmation', !settings.shellConfirmation)} />
                <ToggleRow label="Git force guard" detail="Surface force push/reset workflows as blocked until reviewed." enabled={settings.gitForceGuard} onChange={() => update('gitForceGuard', !settings.gitForceGuard)} />
                <ToggleRow label="Automatic checkpoints" detail="Keep a snapshot before destructive file operations." enabled={settings.checkpointsEnabled} onChange={() => update('checkpointsEnabled', !settings.checkpointsEnabled)} />
                <NumberField label="Maximum snapshots" value={settings.maxSnapshots} onChange={(v) => update('maxSnapshots', v)} suffix="snapshots" min={1} max={500} />
              </SettingSection>
              <SettingSection title="Privacy">
                <ToggleRow label="PII redaction" detail="Prepare context redaction for supported gateway platforms." enabled={settings.redactPii} onChange={() => update('redactPii', !settings.redactPii)} />
                <ToggleRow label="Secrets redaction" detail="Mask credential-shaped values in configuration previews." enabled={settings.secretsRedaction} onChange={() => update('secretsRedaction', !settings.secretsRedaction)} />
                <ToggleRow label="Telemetry" detail="Allow telemetry state to be represented in this local UI." enabled={settings.telemetry} onChange={() => update('telemetry', !settings.telemetry)} />
                <ToggleRow label="Crash reports" detail="Allow crash-report preference to be represented in this local UI." enabled={settings.crashReports} onChange={() => update('crashReports', !settings.crashReports)} />
                <ToggleRow label="Clear local state on exit" detail="Remove presentation-only preferences on application exit." enabled={settings.clearOnExit} onChange={() => update('clearOnExit', !settings.clearOnExit)} />
              </SettingSection>
              <InfoBanner icon="lock" title="Protected workspace" text="API keys, OAuth credentials, passwords and tokens are intentionally absent from this React state model." />
            </SettingsPage>
          )}

          {section === 'shortcuts' && (
            <SettingsPage title="Shortcuts" description="Choose a keymap and personalize the most important workspace commands.">
              <SettingSection title="Keymap">
                <SelectField label="Keymap profile" value={settings.keymapProfile} onChange={(v) => update('keymapProfile', v)} options={['Default', 'VS Code', 'Vim', 'Emacs', 'Custom']} />
                <TextField label="Command palette" value={settings.shortcutPalette} onChange={(v) => update('shortcutPalette', v)} />
                <TextField label="New conversation" value={settings.shortcutNewChat} onChange={(v) => update('shortcutNewChat', v)} />
                <ToggleRow label="Show shortcut hints" detail="Show keyboard affordances beside actionable commands and buttons." enabled={settings.commandShortcutsVisible} onChange={() => update('commandShortcutsVisible', !settings.commandShortcutsVisible)} />
              </SettingSection>
              <SettingSection title="Profile routing">
                <ToggleRow label="Multiplex profiles" detail="Expose multiple named profiles as routable gateway contexts when the runtime supports them." enabled={settings.multiplexProfiles} onChange={() => update('multiplexProfiles', !settings.multiplexProfiles)} />
                <SelectField label="Profile routing mode" value={settings.profileRouting} onChange={(v) => update('profileRouting', v)} options={['sticky active profile', 'route by channel', 'route by command', 'route by workspace']} />
              </SettingSection>
              <InfoBanner icon="command" title="Desktop shortcuts" text="⌘/Ctrl+K opens the palette, ⌘/Ctrl+B toggles the sidebar, ⌘/Ctrl+J toggles the dock and ⌘/Ctrl+Shift+B toggles the inspector. Runtime keymaps remain separate from this presentation layer." />
            </SettingsPage>
          )}

          {section === 'advanced' && (
            <SettingsPage title="Advanced / Raw Config" description="Expert mode for portable configuration snapshots, environment placeholders and diagnostics.">
              <SettingSection title="Portable configuration">
                <div className="raw-config-toolbar"><button className="studio-button" type="button" onClick={() => setAdvancedJson(JSON.stringify(toPortableConfig(settings, profiles, activeProfileId), null, 2))}><Icon name="refresh" size={13} /> Refresh snapshot</button><button className="studio-button studio-button--active" type="button" onClick={applyRawConfig}><Icon name="check" size={13} /> Apply JSON</button></div>
                <textarea className="raw-config-editor" value={advancedJson} onChange={(event) => setAdvancedJson(event.target.value)} spellCheck={false} aria-label="Portable raw configuration JSON" />
              </SettingSection>
              <SettingSection title="Environment placeholders">
                <div className="env-placeholder-box"><code>${'OPENROUTER_API_KEY'}</code><code>${'CUSTOM_VISION_URL'}</code><code>${'DELEGATION_KEY'}</code><code>${'TERMINAL_CWD'}</code></div>
                <InfoBanner icon="lock" title="Secrets stay outside config UI state" text="Use environment or runtime-managed secret storage for API keys, bot tokens, OAuth and passwords. The UI only exposes non-secret configuration shape." />
              </SettingSection>
              <SettingSection title="Diagnostics">
                <ToggleRow label="Debug mode" detail="Expose additional UI diagnostics and structured state metadata." enabled={settings.debugMode} onChange={() => update('debugMode', !settings.debugMode)} />
                <ToggleRow label="Experimental features" detail="Show experimental frontend surfaces before backend contracts are connected." enabled={settings.experimentalFeatures} onChange={() => update('experimentalFeatures', !settings.experimentalFeatures)} />
                <ToggleRow label="Gateway runtime footer" detail="Show model/context/CWD metadata when the runtime exposes final gateway output." enabled={settings.runtimeFooter} onChange={() => update('runtimeFooter', !settings.runtimeFooter)} />
                <TextField label="Primary identity file" value={settings.soulFile} onChange={(v) => update('soulFile', v)} />
                <TextField label="Context file precedence" value={settings.contextFilePriority} onChange={(v) => update('contextFilePriority', v)} />
                <div className="advanced-grid"><div><span>Config schema</span><strong>Hermes-inspired v2</strong></div><div><span>Persistence</span><strong>Local preview</strong></div><div><span>Secret store</span><strong>Runtime-owned</strong></div><div><span>Runtime bridge</span><strong>Typed service boundary</strong></div></div>
              </SettingSection>
            </SettingsPage>
          )}
        </main>
      </div>
    </section>
  )
}

function toPortableConfig(settings: SettingsState, profiles: Profile[], activeProfileId: string) {
  return {
    version: 2,
    active_profile: activeProfileId,
    profile: profiles.find((profile) => profile.id === activeProfileId)?.name ?? 'Default',
    model: {
      provider: settings.defaultProvider,
      default: settings.defaultModel,
      alias: settings.modelAlias,
      fallback_chain: settings.fallbackChain,
      custom_endpoint: settings.customEndpoint,
      persist_switch: settings.persistModel,
    },
    agent: {
      reasoning_effort: settings.reasoningEffort,
      tool_use_enforcement: settings.toolUseEnforcement,
      max_turns: settings.maxTurns,
      autonomy: settings.autonomy,
      tool_budget: settings.toolBudget,
      max_parallel_agents: settings.maxParallelAgents,
      soul_file: settings.soulFile,
      context_file_priority: settings.contextFilePriority,
    },
    delegation: {
      model: settings.delegationModel,
      provider: settings.delegationProvider,
      base_url: settings.delegationEndpoint,
    },
    clarify: {
      timeout: settings.clarifyTimeout,
    },
    tools: {
      progress: settings.toolProgress,
      show_calls: settings.showToolCalls,
      cli_preset: settings.cliToolsetPreset,
      messaging_preset: settings.messagingToolsetPreset,
      presets: toolsetPresets,
    },
    terminal: {
      backend: settings.terminalBackend,
      cwd: settings.terminalCwd,
      timeout: settings.terminalTimeout,
      persistent: settings.terminalPersistent,
      cpu: settings.terminalCpu,
      memory: settings.terminalMemory,
      disk: settings.terminalDisk,
      docker_image: settings.dockerImage,
      ssh_host: settings.sshHost || null,
      ssh_user: settings.sshUser || null,
      ssh_port: settings.sshPort,
    },
    memory: {
      memory_enabled: settings.memoryEnabled,
      user_profile_enabled: settings.userProfileEnabled,
      memory_char_limit: settings.memoryCharLimit,
      user_char_limit: settings.userCharLimit,
      session_recall: settings.sessionRecall,
    },
    compression: {
      enabled: settings.compressionEnabled,
      threshold: settings.compressionThreshold / 100,
      target_ratio: settings.compressionTargetRatio / 100,
      protect_last_n: settings.protectLastN,
      summary_provider: settings.summaryProvider,
      summary_model: settings.summaryModel,
      summary_base_url: settings.summaryBaseUrl,
    },
    display: {
      tool_progress: settings.toolProgress,
      tool_progress_command: settings.toolProgressCommand,
      show_reasoning: settings.showReasoning,
      streaming: settings.streaming,
      show_cost: settings.showCost,
      compact: settings.compactOutput,
      resume_display: settings.resumeDisplay,
      bell_on_complete: settings.bellOnComplete,
      tool_preview_length: settings.toolPreviewLength,
      runtime_footer: settings.runtimeFooter,
      skin: settings.theme,
    },
    voice: {
      tts: { provider: settings.ttsProvider, voice: settings.ttsVoice, model: settings.ttsModel },
      stt: { provider: settings.sttProvider, local_model: settings.sttLocalModel },
      vision: { provider: settings.visionProvider, model: settings.visionModel, timeout: settings.visionTimeout },
    },
    web: {
      backend: settings.webBackend,
      extract_backend: settings.webExtractBackend,
      keyless_fallback: settings.webKeylessFallback,
      keyless_rescue: settings.webKeylessRescue,
      browser_cloud_provider: settings.browserCloudProvider,
      image_provider: settings.imageProvider,
    },
    browser: {
      inactivity_timeout: settings.browserInactivityTimeout,
      command_timeout: settings.browserCommandTimeout,
      record_sessions: settings.browserRecordSessions,
      cdp_url: settings.browserCdpUrl,
      dialog_policy: settings.browserDialogPolicy,
      dialog_timeout: settings.browserDialogTimeout,
      managed_persistence: settings.browserPersistence,
    },
    gateway: {
      multiplex_profiles: settings.multiplexProfiles,
      profile_routing: settings.profileRouting,
      api_server: {
        enabled: settings.apiServerEnabled,
        host: settings.apiServerHost,
        port: settings.apiServerPort,
        max_concurrent_runs: settings.apiServerMaxRuns,
      },
      streaming: {
        enabled: settings.gatewayStreaming,
        edit_interval: settings.gatewayEditInterval,
      },
      channels: {
        telegram: settings.telegramEnabled,
        discord: settings.discordEnabled,
        slack: settings.slackEnabled,
        whatsapp: settings.whatsappEnabled,
        signal: settings.signalEnabled,
        homeassistant: settings.homeAssistantEnabled,
      },
    },
    mcp: {
      auto_discover: settings.mcpAutoDiscover,
      timeout: settings.mcpTimeout,
      servers: settings.mcpServers,
    },
    toolsets: {
      disabled: settings.disabledToolsets,
      cli_preset: settings.cliToolsetPreset,
      messaging_preset: settings.messagingToolsetPreset,
    },
    runtime: {
      nofile_soft_limit: settings.runtimeNofileSoftLimit,
      code_execution: {
        mode: settings.codeExecutionMode,
        timeout: settings.codeExecutionTimeout,
        max_tool_calls: settings.codeExecutionMaxToolCalls,
      },
      tool_budget: {
        generic_result_size_chars: settings.genericResultSizeChars,
        mcp_result_size_chars: settings.mcpResultSizeChars,
      },
      stall_guards: settings.stallGuards,
      turn_liveness: {
        timeout_s: settings.turnLivenessTimeout,
        poll_s: settings.turnLivenessPoll,
      },
    },
    automation: {
      cron_enabled: settings.cronEnabled,
      wake_enabled: settings.wakeEnabled,
      background_agents: settings.backgroundAgents,
      schedule_policy: settings.schedulePolicy,
      schedule_concurrency: settings.scheduleConcurrency,
      completion_notifications: settings.completionNotifications,
      human_delay: {
        mode: settings.humanDelayMode,
        min_ms: settings.humanDelayMinMs,
        max_ms: settings.humanDelayMaxMs,
      },
    },
    security: {
      safe_mode: settings.safeMode,
      approval_mode: settings.approvalMode,
      redact_pii: settings.redactPii,
      network_guard: settings.networkGuard,
      shell_confirmation: settings.shellConfirmation,
      git_force_guard: settings.gitForceGuard,
      checkpoints_enabled: settings.checkpointsEnabled,
      max_snapshots: settings.maxSnapshots,
      clear_on_exit: settings.clearOnExit,
    },
    ui: {
      theme: settings.theme,
      accent: settings.accent,
      density: settings.density,
      ui_scale: settings.uiScale,
      font_size: settings.fontSize,
      language: settings.language,
      workspace_name: settings.workspaceName,
      startup_view: settings.startupView,
      layout: {
        sidebar_visible: settings.leftSidebarVisible,
        inspector_visible: settings.agentInspectorVisible,
        dock_visible: settings.bottomDockVisible,
        statusbar_visible: settings.statusBarVisible,
        rail_compact: settings.activityRailCompact,
        sidebar_width: settings.sidebarWidth,
        inspector_width: settings.inspectorWidth,
        tooltips: settings.showTooltips,
        hover_preview: settings.hoverPreview,
        notification_position: settings.notificationPosition,
      },
      shortcuts: {
        keymap: settings.keymapProfile,
        palette: settings.shortcutPalette,
        new_chat: settings.shortcutNewChat,
        hints: settings.commandShortcutsVisible,
      },
    },
    profiles,
    note: 'Presentation-local configuration snapshot. Secrets are intentionally excluded.',
  }
}

function SettingsPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="settings-page"><header className="settings-page__header"><div><span className="eyebrow">Configuration domain</span><h2>{title}</h2><p>{description}</p></div><span className="settings-page__mark"><Icon name="settings" size={17} /></span></header>{children}</div>
}

function SettingSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="settings-section-card"><div className="settings-section-card__heading"><div><span>{title}</span><small>Editable preference</small></div><Icon name="sliders" size={14} /></div>{children}</section>
}

function ToggleRow({ label, detail, enabled, onChange }: { label: string; detail: string; enabled: boolean; onChange: () => void }) {
  return <div className="settings-control-row"><div><strong>{label}</strong><span>{detail}</span></div><button className={enabled ? 'switch switch--on' : 'switch'} role="switch" aria-checked={enabled} onClick={onChange} type="button"><span /></button></div>
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="settings-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="settings-field"><span>{label}</span><input className="settings-input" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>
}

function NumberField({ label, value, onChange, suffix, min, max }: { label: string; value: number; onChange: (value: number) => void; suffix: string; min: number; max: number }) {
  return <label className="settings-field"><span>{label}</span><div className="settings-number"><input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value))))} /><small>{suffix}</small></div></label>
}

function RangeField({ label, value, onChange, description, min = 0, max = 100 }: { label: string; value: number; onChange: (value: number) => void; description: string; min?: number; max?: number }) {
  const bounded = Math.max(min, Math.min(max, value))
  return <div className="settings-range"><div><strong>{label}</strong><span>{description}</span></div><div className="settings-range__control"><input type="range" min={min} max={max} value={bounded} onChange={(event) => onChange(Number(event.target.value))} /><output>{bounded}</output></div></div>
}

function StatusCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: IconName }) {
  return <div className="settings-status-card"><span className="settings-status-card__icon"><Icon name={icon} size={15} /></span><span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span></div>
}

function InfoBanner({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return <div className="settings-info-banner"><span><Icon name={icon} size={15} /></span><div><strong>{title}</strong><small>{text}</small></div></div>
}
