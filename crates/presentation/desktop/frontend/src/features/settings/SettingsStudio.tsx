import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import Icon, { type IconName } from '../../components/Icon'
import HermesParityControls from './HermesParityControls'
import { UI_PREFERENCES_STORAGE_KEY, applyUiPreferences, emitUiPreferencesChanged } from '../../services/ui-preferences'

type SectionId =
  | 'overview' | 'profiles' | 'models' | 'agent' | 'tools' | 'terminal' | 'context'
  | 'compression' | 'display' | 'layout' | 'voice' | 'web' | 'browser' | 'gateway' | 'mcp' | 'automation'
  | 'runtime' | 'security' | 'shortcuts' | 'hermes' | 'advanced'

type Theme = 'Monochrome' | 'Graphite' | 'Paper' | 'High contrast'
type Accent = 'White' | 'Silver' | 'Blue' | 'Violet' | 'Green'
type Density = 'Compact' | 'Comfortable' | 'Spacious'
type ToolProgress = 'off' | 'new' | 'all' | 'verbose'
type TerminalBackend = 'local' | 'docker' | 'ssh' | 'modal' | 'daytona' | 'vercel_sandbox' | 'singularity'

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

export interface SettingsState {
  theme: Theme
  accent: Accent
  density: Density
  uiScale: number
  fontSize: number
  experience: 'Simple' | 'Pro'
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
  focusView: boolean
  interimAssistantMessages: boolean
  suppressWarningNotifications: boolean
  showCommentary: boolean
  vimMode: boolean
  timestamps: boolean
  timestampFormat: string
  turnSummary: boolean
  spinnerTokenFlow: boolean
  bellOnPrompt: boolean
  fileMutationVerifier: boolean
  creditsNotices: boolean
  cliMultilineShortcuts: boolean
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
  terminalTempDir: string
  terminalFontFamily: string
  terminalHomeMode: string
  terminalTimeout: number
  terminalPersistent: boolean
  terminalSyncBackMaxBytes: number
  terminalCpu: number
  terminalMemory: number
  terminalDisk: number
  dockerImage: string
  vercelSandboxImage: string
  modalImage: string
  daytonaImage: string
  singularityImage: string
  dockerForwardEnv: string[]
  dockerVolumes: string[]
  dockerRunAsHostUser: boolean
  dockerExtraArgs: string
  dockerPersistAcrossProcesses: boolean
  dockerOrphanReaper: boolean
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
  parallelTier: string
  exaTier: string
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
  loopWarningsEnabled: boolean
  loopHardStopEnabled: boolean
  nonInteractiveHardStopEnabled: boolean
  exactFailureWarnAfter: number
  sameToolFailureWarnAfter: number
  idempotentWarnAfter: number
  exactFailureHardStopAfter: number
  sameToolFailureHardStopAfter: number
  idempotentHardStopAfter: number
  maxWebSearchesPerTurn: number
  maxSubagentsPerTurn: number
  executionGuidance: string
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
  contextEngine: string
  memoryProvider: string
  credentialPoolStrategy: string
  auxiliaryReasoningEffort: string
  fallbackModelProvider: string
  fallbackModel: string
  fallbackModelBaseUrl: string
  auxWebExtractProvider: string
  auxWebExtractModel: string
  auxWebExtractBaseUrl: string
  auxWebExtractTimeout: number
  auxApprovalProvider: string
  auxApprovalModel: string
  auxApprovalBaseUrl: string
  auxApprovalTimeout: number
  auxSessionSearchProvider: string
  auxSessionSearchModel: string
  auxSessionSearchBaseUrl: string
  auxSessionSearchTimeout: number
  auxSkillsHubProvider: string
  auxSkillsHubModel: string
  auxSkillsHubBaseUrl: string
  auxSkillsHubTimeout: number
  auxMcpProvider: string
  auxMcpModel: string
  auxMcpBaseUrl: string
  auxMcpTimeout: number
  auxFlushProvider: string
  auxFlushModel: string
  auxFlushBaseUrl: string
  auxFlushTimeout: number
  visionDownloadTimeout: number
  ttsBaseUrl: string
  ttsVoiceId: string
  ttsModelId: string
  ttsRefAudio: string
  ttsRefText: string
  ttsDevice: string
  voiceRecordKey: string
  voiceMaxRecordingSeconds: number
  voiceAutoTts: boolean
  voiceSilenceThreshold: number
  voiceSilenceDuration: number
  cliSkin: string
  personalityPreset: string
  toolProgressOverrides: string
  webCrawlBackend: string
  parallelSearchMode: string
  firecrawlApiUrl: string
  streamReadTimeout: number
  streamStaleTimeout: number
  apiTimeout: number
  gatewayBufferThreshold: number
  gatewayCursor: string
  groupSessionsPerUser: boolean
  unauthorizedDmBehavior: string
  unauthorizedDmOverrides: string
  quickCommands: string
  memoryWriteApproval: boolean
  memoryNudgeInterval: number
  memoryFlushMinTurns: number
  fileReadMaxChars: number
  contextFileMaxChars: number
  envSubstitutionEnabled: boolean
  envSubstitutionTemplate: string
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
  experience: 'Simple',
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
  runtimeFooter: false,
  focusView: false,
  interimAssistantMessages: true,
  suppressWarningNotifications: false,
  showCommentary: true,
  vimMode: false,
  timestamps: false,
  timestampFormat: '%H:%M',
  turnSummary: true,
  spinnerTokenFlow: true,
  bellOnPrompt: false,
  fileMutationVerifier: true,
  creditsNotices: true,
  cliMultilineShortcuts: true,
  streaming: true,
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
  terminalTempDir: '',
  terminalFontFamily: '',
  terminalHomeMode: 'auto',
  terminalTimeout: 180,
  terminalPersistent: true,
  terminalSyncBackMaxBytes: 2147483648,
  terminalCpu: 1,
  terminalMemory: 5120,
  terminalDisk: 51200,
  dockerImage: 'python-nodejs:20',
  vercelSandboxImage: 'python-nodejs:20',
  modalImage: 'nikolaik/python-nodejs:python3.11-nodejs20',
  daytonaImage: 'nikolaik/python-nodejs:python3.11-nodejs20',
  singularityImage: 'docker://nikolaik/python-nodejs:python3.11-nodejs20',
  dockerForwardEnv: [],
  dockerVolumes: ['/workspace/projects:/workspace/projects'],
  dockerRunAsHostUser: false,
  dockerExtraArgs: '',
  dockerPersistAcrossProcesses: false,
  dockerOrphanReaper: true,
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
  parallelTier: 'auto',
  exaTier: 'auto',
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
  loopWarningsEnabled: true,
  loopHardStopEnabled: false,
  nonInteractiveHardStopEnabled: true,
  exactFailureWarnAfter: 2,
  sameToolFailureWarnAfter: 3,
  idempotentWarnAfter: 2,
  exactFailureHardStopAfter: 5,
  sameToolFailureHardStopAfter: 8,
  idempotentHardStopAfter: 5,
  maxWebSearchesPerTurn: 50,
  maxSubagentsPerTurn: 50,
  executionGuidance: 'auto',
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
  contextEngine: 'compressor',
  memoryProvider: 'builtin',
  credentialPoolStrategy: 'fill_first',
  auxiliaryReasoningEffort: 'provider-default',
  fallbackModelProvider: 'auto',
  fallbackModel: '',
  fallbackModelBaseUrl: '',
  auxWebExtractProvider: 'auto',
  auxWebExtractModel: '',
  auxWebExtractBaseUrl: '',
  auxWebExtractTimeout: 360,
  auxApprovalProvider: 'auto',
  auxApprovalModel: '',
  auxApprovalBaseUrl: '',
  auxApprovalTimeout: 30,
  auxSessionSearchProvider: 'auto',
  auxSessionSearchModel: '',
  auxSessionSearchBaseUrl: '',
  auxSessionSearchTimeout: 30,
  auxSkillsHubProvider: 'auto',
  auxSkillsHubModel: '',
  auxSkillsHubBaseUrl: '',
  auxSkillsHubTimeout: 30,
  auxMcpProvider: 'auto',
  auxMcpModel: '',
  auxMcpBaseUrl: '',
  auxMcpTimeout: 30,
  auxFlushProvider: 'auto',
  auxFlushModel: '',
  auxFlushBaseUrl: '',
  auxFlushTimeout: 30,
  visionDownloadTimeout: 30,
  ttsBaseUrl: '',
  ttsVoiceId: '',
  ttsModelId: '',
  ttsRefAudio: '',
  ttsRefText: '',
  ttsDevice: 'cpu',
  voiceRecordKey: 'ctrl+b',
  voiceMaxRecordingSeconds: 120,
  voiceAutoTts: false,
  voiceSilenceThreshold: 200,
  voiceSilenceDuration: 3,
  cliSkin: 'default',
  personalityPreset: 'default',
  toolProgressOverrides: '{}',
  webCrawlBackend: 'auto',
  parallelSearchMode: 'agentic',
  firecrawlApiUrl: '',
  streamReadTimeout: 120,
  streamStaleTimeout: 180,
  apiTimeout: 1800,
  gatewayBufferThreshold: 40,
  gatewayCursor: ' ▉',
  groupSessionsPerUser: true,
  unauthorizedDmBehavior: 'pair',
  unauthorizedDmOverrides: '{}',
  quickCommands: 'status = agenticos status\ndisk = df -h /\ngpu = nvidia-smi',
  memoryWriteApproval: false,
  memoryNudgeInterval: 10,
  memoryFlushMinTurns: 6,
  fileReadMaxChars: 100000,
  contextFileMaxChars: 20000,
  envSubstitutionEnabled: true,
  envSubstitutionTemplate: '${OPENAI_API_KEY} / ${CUSTOM_ENDPOINT}',
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
  { id: 'runtime', label: 'Runtime & Liveness', detail: 'Limits, spillover, code execution and anti-stall', icon: 'activity', group: 'Advanced' },
  { id: 'shortcuts', label: 'Shortcuts', detail: 'Keymap and custom workspace commands', icon: 'command', group: 'Advanced' },
  { id: 'hermes', label: 'Hermes Parity', detail: 'Advanced runtime compatibility controls', icon: 'layers', group: 'Advanced' },
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
    applyUiPreferences(settings)
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
      applyUiPreferences(settings)
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
      const parsed = JSON.parse(advancedJson) as Record<string, unknown>
      const profilesValue = Array.isArray(parsed.profiles) ? parsed.profiles as Profile[] : defaultProfiles
      const activeProfileId = typeof parsed.active_profile === 'string'
        ? parsed.active_profile
        : typeof parsed.activeProfileId === 'string'
          ? parsed.activeProfileId
          : 'default'

      if (isRecord(parsed.settings)) {
        setSettings({ ...defaults, ...(parsed.settings as Partial<SettingsState>) })
      } else {
        setSettings((current) => ({ ...current, ...fromPortableConfig(parsed, current) }))
      }

      setProfiles(profilesValue.length ? profilesValue : defaultProfiles)
      setActiveProfileId(activeProfileId)
      setDirty(true)
      notify('Configuration snapshot applied to preview')
    } catch {
      notify('Configuration must be valid JSON with a supported snapshot shape')
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
                <SelectField label="Terminal backend" value={settings.terminalBackend} onChange={(v) => update('terminalBackend', v as TerminalBackend)} options={['local', 'docker', 'ssh', 'modal', 'daytona', 'vercel_sandbox', 'singularity']} />
                <TextField label="Working directory" value={settings.terminalCwd} onChange={(v) => update('terminalCwd', v)} />
                <TextField label="Session temp directory" value={settings.terminalTempDir} onChange={(v) => update('terminalTempDir', v)} placeholder="managed default" />
                <TextField label="Terminal font family" value={settings.terminalFontFamily} onChange={(v) => update('terminalFontFamily', v)} placeholder="JetBrains Mono, monospace" />
                <SelectField label="Subprocess HOME mode" value={settings.terminalHomeMode} onChange={(v) => update('terminalHomeMode', v)} options={['auto', 'real', 'profile']} />
                <NumberField label="Command timeout" value={settings.terminalTimeout} onChange={(v) => update('terminalTimeout', v)} suffix="seconds" min={1} max={3600} />
                <ToggleRow label="Persistent terminal state" detail="Preserve shell state where the backend supports it." enabled={settings.terminalPersistent} onChange={() => update('terminalPersistent', !settings.terminalPersistent)} />
              </SettingSection>
              <SettingSection title="Resources">
                <NumberField label="CPU limit" value={settings.terminalCpu} onChange={(v) => update('terminalCpu', v)} suffix="cores" min={0} max={64} />
                <NumberField label="Memory limit" value={settings.terminalMemory} onChange={(v) => update('terminalMemory', v)} suffix="MB" min={0} max={262144} />
                <NumberField label="Disk limit" value={settings.terminalDisk} onChange={(v) => update('terminalDisk', v)} suffix="MB" min={0} max={1048576} />
                <NumberField label="Remote sync-back cap" value={settings.terminalSyncBackMaxBytes} onChange={(v) => update('terminalSyncBackMaxBytes', v)} suffix="bytes" min={0} max={1099511627776} />
              </SettingSection>
              <SettingSection title={settings.terminalBackend === 'docker' ? 'Docker' : settings.terminalBackend === 'ssh' ? 'SSH' : 'Backend-specific'}>
                {settings.terminalBackend === 'docker' ? <>
                  <TextField label="Docker image" value={settings.dockerImage} onChange={(v) => update('dockerImage', v)} />
                  <TextField label="Docker forwarded env" value={settings.dockerForwardEnv.join(', ')} onChange={(v) => update('dockerForwardEnv', v.split(',').map((item) => item.trim()).filter(Boolean))} placeholder="GITHUB_TOKEN, NPM_TOKEN" />
                  <ToggleRow label="Mount current directory" detail="Explicitly opt into sharing the launch directory with the sandbox." enabled={settings.sandboxMountCwd} onChange={() => update('sandboxMountCwd', !settings.sandboxMountCwd)} />
                </> : ['modal', 'daytona', 'vercel_sandbox', 'singularity'].includes(settings.terminalBackend) ? <>
                  <TextField label="Backend image" value={
                    settings.terminalBackend === 'modal' ? settings.modalImage :
                    settings.terminalBackend === 'daytona' ? settings.daytonaImage :
                    settings.terminalBackend === 'singularity' ? settings.singularityImage : settings.vercelSandboxImage
                  } onChange={(v) => {
                    const key = settings.terminalBackend === 'modal' ? 'modalImage' : settings.terminalBackend === 'daytona' ? 'daytonaImage' : settings.terminalBackend === 'singularity' ? 'singularityImage' : 'vercelSandboxImage'
                    update(key, v as never)
                  }} />
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
                <ToggleRow label="Focus view" detail="Reduce output noise for a focused command-oriented view." enabled={settings.focusView} onChange={() => update('focusView', !settings.focusView)} />
                <ToggleRow label="Interim assistant messages" detail="Allow gateway surfaces to show natural mid-turn assistant updates." enabled={settings.interimAssistantMessages} onChange={() => update('interimAssistantMessages', !settings.interimAssistantMessages)} />
                <ToggleRow label="Suppress warning notifications" detail="Hide automatic warning/diagnostic notices from the presentation layer." enabled={settings.suppressWarningNotifications} onChange={() => update('suppressWarningNotifications', !settings.suppressWarningNotifications)} />
                <ToggleRow label="Show commentary" detail="Expose commentary-channel progress when the runtime provides it." enabled={settings.showCommentary} onChange={() => update('showCommentary', !settings.showCommentary)} />
                <ToggleRow label="Vim mode" detail="Use vi-style input behavior where supported by the runtime surface." enabled={settings.vimMode} onChange={() => update('vimMode', !settings.vimMode)} />
                <ToggleRow label="Timestamps" detail="Display timestamp metadata in transcript surfaces." enabled={settings.timestamps} onChange={() => update('timestamps', !settings.timestamps)} />
                <TextField label="Timestamp format" value={settings.timestampFormat} onChange={(v) => update('timestampFormat', v)} />
                <ToggleRow label="Turn summary" detail="Show a compact accounting summary after completed turns." enabled={settings.turnSummary} onChange={() => update('turnSummary', !settings.turnSummary)} />
                <ToggleRow label="Spinner token flow" detail="Show cumulative output token flow while a turn is active." enabled={settings.spinnerTokenFlow} onChange={() => update('spinnerTokenFlow', !settings.spinnerTokenFlow)} />
                <ToggleRow label="Bell on prompt" detail="Signal when a blocking approval/clarification prompt opens." enabled={settings.bellOnPrompt} onChange={() => update('bellOnPrompt', !settings.bellOnPrompt)} />
                <ToggleRow label="File mutation verifier" detail="Surface advisory state when write/patch operations fail to land." enabled={settings.fileMutationVerifier} onChange={() => update('fileMutationVerifier', !settings.fileMutationVerifier)} />
                <ToggleRow label="Credits notices" detail="Show provider credit/quota notices in supported surfaces." enabled={settings.creditsNotices} onChange={() => update('creditsNotices', !settings.creditsNotices)} />
                <ToggleRow label="CLI multiline shortcuts" detail="Keep Ctrl+J and related multiline composer shortcuts available." enabled={settings.cliMultilineShortcuts} onChange={() => update('cliMultilineShortcuts', !settings.cliMultilineShortcuts)} />
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

          {section === 'web' && (
            <SettingsPage title="Web Search" description="Configure search and extraction routing, free-tier fallback and provider tiers.">
              <SettingSection title="Search & extraction">
                <SelectField label="Search backend" value={settings.webBackend} onChange={(v) => update('webBackend', v)} options={['auto', 'firecrawl', 'searxng', 'parallel', 'tavily', 'perplexity', 'keenable', 'exa']} />
                <SelectField label="Extract backend" value={settings.webExtractBackend} onChange={(v) => update('webExtractBackend', v)} options={['auto', 'firecrawl', 'searxng', 'parallel', 'tavily', 'perplexity', 'keenable', 'exa']} />
                <ToggleRow label="Keyless fallback" detail="Use supported anonymous/free backends when no keyed provider is configured." enabled={settings.webKeylessFallback} onChange={() => update('webKeylessFallback', !settings.webKeylessFallback)} />
                <ToggleRow label="Keyless rescue" detail="Retry a failed call once through the keyless provider ring." enabled={settings.webKeylessRescue} onChange={() => update('webKeylessRescue', !settings.webKeylessRescue)} />
              </SettingSection>
              <SettingSection title="Provider tiers">
                <SelectField label="Parallel tier" value={settings.parallelTier} onChange={(v) => update('parallelTier', v)} options={['auto', 'free', 'paid']} />
                <SelectField label="Exa tier" value={settings.exaTier} onChange={(v) => update('exaTier', v)} options={['auto', 'free', 'paid']} />
                <SelectField label="Browser cloud provider" value={settings.browserCloudProvider} onChange={(v) => update('browserCloudProvider', v)} options={['none', 'Browserbase', 'Browser Use', 'Camofox', 'Custom']} />
              </SettingSection>
              <SettingSection title="Search policy">
                <TextField label="Timezone" value={settings.timezone} onChange={(v) => update('timezone', v)} placeholder="UTC or IANA timezone" />
                <InfoBanner icon="search" title="Provider-neutral web plane" text="Search and extraction remain separate so a free search backend can be combined with a paid or self-hosted extractor." />
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
                <SelectField label="Execution guidance" value={settings.executionGuidance} onChange={(v) => update('executionGuidance', v)} options={['auto', 'true', 'false', 'model-substrings']} />
                <NumberField label="Execution timeout" value={settings.codeExecutionTimeout} onChange={(v) => update('codeExecutionTimeout', v)} suffix="seconds" min={1} max={3600} />
                <NumberField label="Max tool calls" value={settings.codeExecutionMaxToolCalls} onChange={(v) => update('codeExecutionMaxToolCalls', v)} suffix="calls" min={0} max={10000} />
              </SettingSection>
              <SettingSection title="Tool-loop guardrails">
                <ToggleRow label="Warnings enabled" detail="Inject warnings into tool results when repeated-failure patterns are detected." enabled={settings.loopWarningsEnabled} onChange={() => update('loopWarningsEnabled', !settings.loopWarningsEnabled)} />
                <ToggleRow label="Hard stops" detail="Enable hard-stop thresholds in supervised runtime contexts." enabled={settings.loopHardStopEnabled} onChange={() => update('loopHardStopEnabled', !settings.loopHardStopEnabled)} />
                <ToggleRow label="Non-interactive hard stops" detail="Enable stricter loop stops for unattended gateway/cron execution." enabled={settings.nonInteractiveHardStopEnabled} onChange={() => update('nonInteractiveHardStopEnabled', !settings.nonInteractiveHardStopEnabled)} />
                <NumberField label="Exact failure warning" value={settings.exactFailureWarnAfter} onChange={(v) => update('exactFailureWarnAfter', v)} suffix="repeats" min={1} max={100} />
                <NumberField label="Same-tool warning" value={settings.sameToolFailureWarnAfter} onChange={(v) => update('sameToolFailureWarnAfter', v)} suffix="repeats" min={1} max={100} />
                <NumberField label="No-progress warning" value={settings.idempotentWarnAfter} onChange={(v) => update('idempotentWarnAfter', v)} suffix="repeats" min={1} max={100} />
                <NumberField label="Exact failure hard stop" value={settings.exactFailureHardStopAfter} onChange={(v) => update('exactFailureHardStopAfter', v)} suffix="repeats" min={1} max={100} />
                <NumberField label="Same-tool hard stop" value={settings.sameToolFailureHardStopAfter} onChange={(v) => update('sameToolFailureHardStopAfter', v)} suffix="repeats" min={1} max={100} />
                <NumberField label="No-progress hard stop" value={settings.idempotentHardStopAfter} onChange={(v) => update('idempotentHardStopAfter', v)} suffix="repeats" min={1} max={100} />
                <NumberField label="Max web searches / turn" value={settings.maxWebSearchesPerTurn} onChange={(v) => update('maxWebSearchesPerTurn', v)} suffix="calls" min={0} max={10000} />
                <NumberField label="Max subagents / turn" value={settings.maxSubagentsPerTurn} onChange={(v) => update('maxSubagentsPerTurn', v)} suffix="agents" min={0} max={10000} />
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

          {section === 'hermes' && <HermesParityControls settings={settings} update={update} />}

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

type PortableRecord = Record<string, unknown>

function isRecord(value: unknown): value is PortableRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: PortableRecord | undefined, key: string, fallback: string) {
  return record && typeof record[key] === 'string' ? record[key] as string : fallback
}

function readNumber(record: PortableRecord | undefined, key: string, fallback: number) {
  return record && typeof record[key] === 'number' && Number.isFinite(record[key]) ? record[key] as number : fallback
}

function readBoolean(record: PortableRecord | undefined, key: string, fallback: boolean) {
  return record && typeof record[key] === 'boolean' ? record[key] as boolean : fallback
}

function readArray(record: PortableRecord | undefined, key: string, fallback: string[]) {
  return record && Array.isArray(record[key]) && record[key].every((item) => typeof item === 'string')
    ? record[key] as string[]
    : fallback
}

function fromPortableConfig(payload: PortableRecord, current: SettingsState): Partial<SettingsState> {
  const model = isRecord(payload.model) ? payload.model : undefined
  const agent = isRecord(payload.agent) ? payload.agent : undefined
  const delegation = isRecord(payload.delegation) ? payload.delegation : undefined
  const clarify = isRecord(payload.clarify) ? payload.clarify : undefined
  const tools = isRecord(payload.tools) ? payload.tools : undefined
  const terminal = isRecord(payload.terminal) ? payload.terminal : undefined
  const memory = isRecord(payload.memory) ? payload.memory : undefined
  const compression = isRecord(payload.compression) ? payload.compression : undefined
  const display = isRecord(payload.display) ? payload.display : undefined
  const voice = isRecord(payload.voice) ? payload.voice : undefined
  const web = isRecord(payload.web) ? payload.web : undefined
  const browser = isRecord(payload.browser) ? payload.browser : undefined
  const gateway = isRecord(payload.gateway) ? payload.gateway : undefined
  const apiServer = gateway && isRecord(gateway.api_server) ? gateway.api_server : undefined
  const gatewayStreaming = gateway && isRecord(gateway.streaming) ? gateway.streaming : undefined
  const channels = gateway && isRecord(gateway.channels) ? gateway.channels : undefined
  const mcp = isRecord(payload.mcp) ? payload.mcp : undefined
  const toolsets = isRecord(payload.toolsets) ? payload.toolsets : undefined
  const runtime = isRecord(payload.runtime) ? payload.runtime : undefined
  const codeExecution = runtime && isRecord(runtime.code_execution) ? runtime.code_execution : undefined
  const loopGuardrails = runtime && isRecord(runtime.tool_loop_guardrails) ? runtime.tool_loop_guardrails : undefined
  const warnAfter = loopGuardrails && isRecord(loopGuardrails.warn_after) ? loopGuardrails.warn_after : undefined
  const hardStopAfter = loopGuardrails && isRecord(loopGuardrails.hard_stop_after) ? loopGuardrails.hard_stop_after : undefined
  const loopCaps = loopGuardrails && isRecord(loopGuardrails.loop_caps) ? loopGuardrails.loop_caps : undefined
  const toolBudget = runtime && isRecord(runtime.tool_budget) ? runtime.tool_budget : undefined
  const liveness = runtime && isRecord(runtime.turn_liveness) ? runtime.turn_liveness : undefined
  const automation = isRecord(payload.automation) ? payload.automation : undefined
  const humanDelay = automation && isRecord(automation.human_delay) ? automation.human_delay : undefined
  const security = isRecord(payload.security) ? payload.security : undefined
  const hermes = isRecord(payload.hermes_parity) ? payload.hermes_parity : undefined
  const hermesContext = hermes && isRecord(hermes.context) ? hermes.context : undefined
  const credentialPool = hermes && isRecord(hermes.credential_pool) ? hermes.credential_pool : undefined
  const fallbackModel = hermes && isRecord(hermes.fallback_model) ? hermes.fallback_model : undefined
  const auxiliary = hermes && isRecord(hermes.auxiliary) ? hermes.auxiliary : undefined
  const aux = (key: string) => auxiliary && isRecord(auxiliary[key]) ? auxiliary[key] : undefined
  const hermesTts = hermes && isRecord(hermes.tts) ? hermes.tts : undefined
  const hermesVoice = hermes && isRecord(hermes.voice) ? hermes.voice : undefined
  const hermesDisplay = hermes && isRecord(hermes.display) ? hermes.display : undefined
  const hermesWeb = hermes && isRecord(hermes.web) ? hermes.web : undefined
  const hermesStreaming = hermes && isRecord(hermes.streaming) ? hermes.streaming : undefined
  const hermesGateway = hermes && isRecord(hermes.gateway) ? hermes.gateway : undefined
  const hermesUi = hermes && isRecord(hermes.ui) ? hermes.ui : undefined

  const next: Partial<SettingsState> = {}
  if (model) {
    next.defaultProvider = readString(model, 'provider', current.defaultProvider)
    next.defaultModel = readString(model, 'default', current.defaultModel)
    next.modelAlias = readString(model, 'alias', current.modelAlias)
    next.fallbackChain = readString(model, 'fallback_chain', current.fallbackChain)
    next.customEndpoint = readString(model, 'custom_endpoint', current.customEndpoint)
    next.persistModel = readBoolean(model, 'persist_switch', current.persistModel)
  }
  if (agent) {
    next.reasoningEffort = readString(agent, 'reasoning_effort', current.reasoningEffort)
    next.toolUseEnforcement = readString(agent, 'tool_use_enforcement', current.toolUseEnforcement)
    next.maxTurns = readNumber(agent, 'max_turns', current.maxTurns)
    next.autonomy = readNumber(agent, 'autonomy', current.autonomy)
    next.toolBudget = readNumber(agent, 'tool_budget', current.toolBudget)
    next.maxParallelAgents = readNumber(agent, 'max_parallel_agents', current.maxParallelAgents)
    next.soulFile = readString(agent, 'soul_file', current.soulFile)
    next.contextFilePriority = readString(agent, 'context_file_priority', current.contextFilePriority)
  }
  if (delegation) {
    next.delegationModel = readString(delegation, 'model', current.delegationModel)
    next.delegationProvider = readString(delegation, 'provider', current.delegationProvider)
    next.delegationEndpoint = readString(delegation, 'base_url', current.delegationEndpoint)
  }
  if (clarify) next.clarifyTimeout = readNumber(clarify, 'timeout', current.clarifyTimeout)
  if (tools) {
    next.toolProgress = readString(tools, 'progress', current.toolProgress) as ToolProgress
    next.showToolCalls = readBoolean(tools, 'show_calls', current.showToolCalls)
    next.cliToolsetPreset = readString(tools, 'cli_preset', current.cliToolsetPreset)
    next.messagingToolsetPreset = readString(tools, 'messaging_preset', current.messagingToolsetPreset)
  }
  if (terminal) {
    next.terminalBackend = readString(terminal, 'backend', current.terminalBackend) as TerminalBackend
    next.terminalCwd = readString(terminal, 'cwd', current.terminalCwd)
    next.terminalTempDir = readString(terminal, 'temp_dir', current.terminalTempDir)
    next.terminalFontFamily = readString(terminal, 'font_family', current.terminalFontFamily)
    next.terminalHomeMode = readString(terminal, 'home_mode', current.terminalHomeMode)
    next.terminalTimeout = readNumber(terminal, 'timeout', current.terminalTimeout)
    next.terminalPersistent = readBoolean(terminal, 'persistent', current.terminalPersistent)
    next.terminalSyncBackMaxBytes = readNumber(terminal, 'sync_back_max_bytes', current.terminalSyncBackMaxBytes)
    next.terminalCpu = readNumber(terminal, 'cpu', current.terminalCpu)
    next.terminalMemory = readNumber(terminal, 'memory', current.terminalMemory)
    next.terminalDisk = readNumber(terminal, 'disk', current.terminalDisk)
    next.dockerImage = readString(terminal, 'docker_image', current.dockerImage)
    next.vercelSandboxImage = readString(terminal, 'vercel_sandbox_image', current.vercelSandboxImage)
    next.modalImage = readString(terminal, 'modal_image', current.modalImage)
    next.daytonaImage = readString(terminal, 'daytona_image', current.daytonaImage)
    next.singularityImage = readString(terminal, 'singularity_image', current.singularityImage)
    next.dockerForwardEnv = readArray(terminal, 'docker_forward_env', current.dockerForwardEnv)
    next.dockerVolumes = readArray(terminal, 'docker_volumes', current.dockerVolumes)
    next.dockerRunAsHostUser = readBoolean(terminal, 'docker_run_as_host_user', current.dockerRunAsHostUser)
    next.dockerExtraArgs = readString(terminal, 'docker_extra_args', current.dockerExtraArgs)
    next.dockerPersistAcrossProcesses = readBoolean(terminal, 'docker_persist_across_processes', current.dockerPersistAcrossProcesses)
    next.dockerOrphanReaper = readBoolean(terminal, 'docker_orphan_reaper', current.dockerOrphanReaper)
    next.sshHost = readString(terminal, 'ssh_host', current.sshHost)
    next.sshUser = readString(terminal, 'ssh_user', current.sshUser)
    next.sshPort = readNumber(terminal, 'ssh_port', current.sshPort)
  }
  if (memory) {
    next.memoryEnabled = readBoolean(memory, 'memory_enabled', current.memoryEnabled)
    next.userProfileEnabled = readBoolean(memory, 'user_profile_enabled', current.userProfileEnabled)
    next.memoryCharLimit = readNumber(memory, 'memory_char_limit', current.memoryCharLimit)
    next.userCharLimit = readNumber(memory, 'user_char_limit', current.userCharLimit)
    next.sessionRecall = readBoolean(memory, 'session_recall', current.sessionRecall)
    next.memoryWriteApproval = readBoolean(memory, 'write_approval', current.memoryWriteApproval)
    next.memoryNudgeInterval = readNumber(memory, 'nudge_interval', current.memoryNudgeInterval)
    next.memoryFlushMinTurns = readNumber(memory, 'flush_min_turns', current.memoryFlushMinTurns)
  }
  if (compression) {
    next.compressionEnabled = readBoolean(compression, 'enabled', current.compressionEnabled)
    next.compressionThreshold = Math.round(readNumber(compression, 'threshold', current.compressionThreshold / 100) * 100)
    next.compressionTargetRatio = Math.round(readNumber(compression, 'target_ratio', current.compressionTargetRatio / 100) * 100)
    next.protectLastN = readNumber(compression, 'protect_last_n', current.protectLastN)
    next.summaryProvider = readString(compression, 'summary_provider', current.summaryProvider)
    next.summaryModel = readString(compression, 'summary_model', current.summaryModel)
    next.summaryBaseUrl = readString(compression, 'summary_base_url', current.summaryBaseUrl)
  }
  if (display) {
    next.toolProgress = readString(display, 'tool_progress', current.toolProgress) as ToolProgress
    next.toolProgressCommand = readBoolean(display, 'tool_progress_command', current.toolProgressCommand)
    next.showReasoning = readBoolean(display, 'show_reasoning', current.showReasoning)
    next.streaming = readBoolean(display, 'streaming', current.streaming)
    next.showCost = readBoolean(display, 'show_cost', current.showCost)
    next.compactOutput = readBoolean(display, 'compact', current.compactOutput)
    next.resumeDisplay = readString(display, 'resume_display', current.resumeDisplay)
    next.bellOnComplete = readBoolean(display, 'bell_on_complete', current.bellOnComplete)
    next.toolPreviewLength = readNumber(display, 'tool_preview_length', current.toolPreviewLength)
    next.runtimeFooter = readBoolean(display, 'runtime_footer', current.runtimeFooter)
    next.focusView = readBoolean(display, 'focus_view', current.focusView)
    next.interimAssistantMessages = readBoolean(display, 'interim_assistant_messages', current.interimAssistantMessages)
    next.suppressWarningNotifications = readBoolean(display, 'suppress_warning_notifications', current.suppressWarningNotifications)
    next.showCommentary = readBoolean(display, 'show_commentary', current.showCommentary)
    next.vimMode = readBoolean(display, 'vim_mode', current.vimMode)
    next.timestamps = readBoolean(display, 'timestamps', current.timestamps)
    next.timestampFormat = readString(display, 'timestamp_format', current.timestampFormat)
    next.turnSummary = readBoolean(display, 'turn_summary', current.turnSummary)
    next.spinnerTokenFlow = readBoolean(display, 'spinner_token_flow', current.spinnerTokenFlow)
    next.bellOnPrompt = readBoolean(display, 'bell_on_prompt', current.bellOnPrompt)
    next.fileMutationVerifier = readBoolean(display, 'file_mutation_verifier', current.fileMutationVerifier)
    next.creditsNotices = readBoolean(display, 'credits_notices', current.creditsNotices)
    next.cliMultilineShortcuts = readBoolean(display, 'cli_multiline_shortcuts', current.cliMultilineShortcuts)
    next.theme = readString(display, 'skin', current.theme) as Theme
  }
  if (voice) {
    const tts = isRecord(voice.tts) ? voice.tts : undefined
    const stt = isRecord(voice.stt) ? voice.stt : undefined
    const vision = isRecord(voice.vision) ? voice.vision : undefined
    if (tts) {
      next.ttsProvider = readString(tts, 'provider', current.ttsProvider)
      next.ttsVoice = readString(tts, 'voice', current.ttsVoice)
      next.ttsModel = readString(tts, 'model', current.ttsModel)
    }
    if (stt) {
      next.sttProvider = readString(stt, 'provider', current.sttProvider)
      next.sttLocalModel = readString(stt, 'local_model', current.sttLocalModel)
    }
    if (vision) {
      next.visionProvider = readString(vision, 'provider', current.visionProvider)
      next.visionModel = readString(vision, 'model', current.visionModel)
      next.visionTimeout = readNumber(vision, 'timeout', current.visionTimeout)
    }
  }
  if (web) {
    next.webBackend = readString(web, 'backend', current.webBackend)
    next.webExtractBackend = readString(web, 'extract_backend', current.webExtractBackend)
    next.webKeylessFallback = readBoolean(web, 'keyless_fallback', current.webKeylessFallback)
    next.webKeylessRescue = readBoolean(web, 'keyless_rescue', current.webKeylessRescue)
    const tiers = isRecord(web.provider_tier) ? web.provider_tier : undefined
    next.parallelTier = readString(tiers, 'parallel', current.parallelTier)
    next.exaTier = readString(tiers, 'exa', current.exaTier)
    next.browserCloudProvider = readString(web, 'browser_cloud_provider', current.browserCloudProvider)
    next.imageProvider = readString(web, 'image_provider', current.imageProvider)
  }
  if (browser) {
    next.browserInactivityTimeout = readNumber(browser, 'inactivity_timeout', current.browserInactivityTimeout)
    next.browserCommandTimeout = readNumber(browser, 'command_timeout', current.browserCommandTimeout)
    next.browserRecordSessions = readBoolean(browser, 'record_sessions', current.browserRecordSessions)
    next.browserCdpUrl = readString(browser, 'cdp_url', current.browserCdpUrl)
    next.browserDialogPolicy = readString(browser, 'dialog_policy', current.browserDialogPolicy)
    next.browserDialogTimeout = readNumber(browser, 'dialog_timeout', current.browserDialogTimeout)
    next.browserPersistence = readBoolean(browser, 'managed_persistence', current.browserPersistence)
  }
  if (apiServer) {
    next.apiServerEnabled = readBoolean(apiServer, 'enabled', current.apiServerEnabled)
    next.apiServerHost = readString(apiServer, 'host', current.apiServerHost)
    next.apiServerPort = readNumber(apiServer, 'port', current.apiServerPort)
    next.apiServerMaxRuns = readNumber(apiServer, 'max_concurrent_runs', current.apiServerMaxRuns)
  }
  if (gatewayStreaming) {
    next.gatewayStreaming = readBoolean(gatewayStreaming, 'enabled', current.gatewayStreaming)
    next.gatewayEditInterval = readNumber(gatewayStreaming, 'edit_interval', current.gatewayEditInterval)
  }
  if (channels) {
    next.telegramEnabled = readBoolean(channels, 'telegram', current.telegramEnabled)
    next.discordEnabled = readBoolean(channels, 'discord', current.discordEnabled)
    next.slackEnabled = readBoolean(channels, 'slack', current.slackEnabled)
    next.whatsappEnabled = readBoolean(channels, 'whatsapp', current.whatsappEnabled)
    next.signalEnabled = readBoolean(channels, 'signal', current.signalEnabled)
    next.homeAssistantEnabled = readBoolean(channels, 'homeassistant', current.homeAssistantEnabled)
  }
  if (gateway) {
    next.multiplexProfiles = readBoolean(gateway, 'multiplex_profiles', current.multiplexProfiles)
    next.profileRouting = readString(gateway, 'profile_routing', current.profileRouting)
  }
  if (mcp) {
    next.mcpAutoDiscover = readBoolean(mcp, 'auto_discover', current.mcpAutoDiscover)
    next.mcpTimeout = readNumber(mcp, 'timeout', current.mcpTimeout)
    next.mcpServers = readArray(mcp, 'servers', current.mcpServers)
  }
  if (toolsets) {
    next.disabledToolsets = readArray(toolsets, 'disabled', current.disabledToolsets)
    next.cliToolsetPreset = readString(toolsets, 'cli_preset', current.cliToolsetPreset)
    next.messagingToolsetPreset = readString(toolsets, 'messaging_preset', current.messagingToolsetPreset)
  }
  if (codeExecution) {
    next.codeExecutionMode = readString(codeExecution, 'mode', current.codeExecutionMode)
    next.codeExecutionTimeout = readNumber(codeExecution, 'timeout', current.codeExecutionTimeout)
    next.codeExecutionMaxToolCalls = readNumber(codeExecution, 'max_tool_calls', current.codeExecutionMaxToolCalls)
  }
  if (loopGuardrails) {
    next.loopWarningsEnabled = readBoolean(loopGuardrails, 'warnings_enabled', current.loopWarningsEnabled)
    next.loopHardStopEnabled = readBoolean(loopGuardrails, 'hard_stop_enabled', current.loopHardStopEnabled)
    next.nonInteractiveHardStopEnabled = readBoolean(loopGuardrails, 'non_interactive_hard_stop_enabled', current.nonInteractiveHardStopEnabled)
  }
  if (warnAfter) {
    next.exactFailureWarnAfter = readNumber(warnAfter, 'exact_failure', current.exactFailureWarnAfter)
    next.sameToolFailureWarnAfter = readNumber(warnAfter, 'same_tool_failure', current.sameToolFailureWarnAfter)
    next.idempotentWarnAfter = readNumber(warnAfter, 'idempotent_no_progress', current.idempotentWarnAfter)
  }
  if (hardStopAfter) {
    next.exactFailureHardStopAfter = readNumber(hardStopAfter, 'exact_failure', current.exactFailureHardStopAfter)
    next.sameToolFailureHardStopAfter = readNumber(hardStopAfter, 'same_tool_failure', current.sameToolFailureHardStopAfter)
    next.idempotentHardStopAfter = readNumber(hardStopAfter, 'idempotent_no_progress', current.idempotentHardStopAfter)
  }
  if (loopCaps) {
    next.maxWebSearchesPerTurn = readNumber(loopCaps, 'max_web_searches', current.maxWebSearchesPerTurn)
    next.maxSubagentsPerTurn = readNumber(loopCaps, 'max_subagents', current.maxSubagentsPerTurn)
  }
  if (toolBudget) {
    next.genericResultSizeChars = readNumber(toolBudget, 'generic_result_size_chars', current.genericResultSizeChars)
    next.mcpResultSizeChars = readNumber(toolBudget, 'mcp_result_size_chars', current.mcpResultSizeChars)
  }
  if (runtime) {
    next.runtimeNofileSoftLimit = readNumber(runtime, 'nofile_soft_limit', current.runtimeNofileSoftLimit)
    next.executionGuidance = readString(runtime, 'execution_guidance', current.executionGuidance)
    next.stallGuards = readBoolean(runtime, 'stall_guards', current.stallGuards)
  }
  if (liveness) {
    next.turnLivenessTimeout = readNumber(liveness, 'timeout_s', current.turnLivenessTimeout)
    next.turnLivenessPoll = readNumber(liveness, 'poll_s', current.turnLivenessPoll)
  }
  if (automation) {
    next.cronEnabled = readBoolean(automation, 'cron_enabled', current.cronEnabled)
    next.wakeEnabled = readBoolean(automation, 'wake_enabled', current.wakeEnabled)
    next.backgroundAgents = readBoolean(automation, 'background_agents', current.backgroundAgents)
    next.schedulePolicy = readString(automation, 'schedule_policy', current.schedulePolicy)
    next.scheduleConcurrency = readNumber(automation, 'schedule_concurrency', current.scheduleConcurrency)
    next.completionNotifications = readBoolean(automation, 'completion_notifications', current.completionNotifications)
  }
  if (humanDelay) {
    next.humanDelayMode = readString(humanDelay, 'mode', current.humanDelayMode)
    next.humanDelayMinMs = readNumber(humanDelay, 'min_ms', current.humanDelayMinMs)
    next.humanDelayMaxMs = readNumber(humanDelay, 'max_ms', current.humanDelayMaxMs)
  }
  if (security) {
    next.safeMode = readBoolean(security, 'safe_mode', current.safeMode)
    next.approvalMode = readString(security, 'approval_mode', current.approvalMode)
    next.redactPii = readBoolean(security, 'redact_pii', current.redactPii)
    next.networkGuard = readBoolean(security, 'network_guard', current.networkGuard)
    next.shellConfirmation = readBoolean(security, 'shell_confirmation', current.shellConfirmation)
    next.gitForceGuard = readBoolean(security, 'git_force_guard', current.gitForceGuard)
    next.checkpointsEnabled = readBoolean(security, 'checkpoints_enabled', current.checkpointsEnabled)
    next.maxSnapshots = readNumber(security, 'max_snapshots', current.maxSnapshots)
    next.clearOnExit = readBoolean(security, 'clear_on_exit', current.clearOnExit)
  }

  if (hermesContext) {
    next.contextEngine = readString(hermesContext, 'engine', current.contextEngine)
    next.memoryProvider = readString(hermesContext, 'memory_provider', current.memoryProvider)
    next.auxiliaryReasoningEffort = readString(hermesContext, 'auxiliary_reasoning_effort', current.auxiliaryReasoningEffort)
  }
  if (credentialPool) next.credentialPoolStrategy = readString(credentialPool, 'strategy', current.credentialPoolStrategy)
  if (fallbackModel) {
    next.fallbackModelProvider = readString(fallbackModel, 'provider', current.fallbackModelProvider)
    next.fallbackModel = readString(fallbackModel, 'model', current.fallbackModel)
    next.fallbackModelBaseUrl = readString(fallbackModel, 'base_url', current.fallbackModelBaseUrl)
  }

  const mapAux = (prefix: 'WebExtract' | 'Approval' | 'SessionSearch' | 'SkillsHub' | 'Mcp' | 'Flush', key: string) => {
    const record = aux(key)
    if (!record) return
    next[`aux${prefix}Provider` as keyof SettingsState] = readString(record, 'provider', current[`aux${prefix}Provider` as keyof SettingsState] as string) as never
    next[`aux${prefix}Model` as keyof SettingsState] = readString(record, 'model', current[`aux${prefix}Model` as keyof SettingsState] as string) as never
    next[`aux${prefix}BaseUrl` as keyof SettingsState] = readString(record, 'base_url', current[`aux${prefix}BaseUrl` as keyof SettingsState] as string) as never
    next[`aux${prefix}Timeout` as keyof SettingsState] = readNumber(record, 'timeout', current[`aux${prefix}Timeout` as keyof SettingsState] as number) as never
  }
  mapAux('WebExtract', 'web_extract')
  mapAux('Approval', 'approval')
  mapAux('SessionSearch', 'session_search')
  mapAux('SkillsHub', 'skills_hub')
  mapAux('Mcp', 'mcp')
  mapAux('Flush', 'flush_memories')

  const vision = aux('vision')
  if (vision) next.visionDownloadTimeout = readNumber(vision, 'download_timeout', current.visionDownloadTimeout)
  if (hermesTts) {
    next.ttsBaseUrl = readString(hermesTts, 'base_url', current.ttsBaseUrl)
    next.ttsVoiceId = readString(hermesTts, 'voice_id', current.ttsVoiceId)
    next.ttsModelId = readString(hermesTts, 'model_id', current.ttsModelId)
    next.ttsRefAudio = readString(hermesTts, 'ref_audio', current.ttsRefAudio)
    next.ttsRefText = readString(hermesTts, 'ref_text', current.ttsRefText)
    next.ttsDevice = readString(hermesTts, 'device', current.ttsDevice)
  }
  if (hermesVoice) {
    next.voiceRecordKey = readString(hermesVoice, 'record_key', current.voiceRecordKey)
    next.voiceMaxRecordingSeconds = readNumber(hermesVoice, 'max_recording_seconds', current.voiceMaxRecordingSeconds)
    next.voiceAutoTts = readBoolean(hermesVoice, 'auto_tts', current.voiceAutoTts)
    next.voiceSilenceThreshold = readNumber(hermesVoice, 'silence_threshold', current.voiceSilenceThreshold)
    next.voiceSilenceDuration = readNumber(hermesVoice, 'silence_duration', current.voiceSilenceDuration)
  }
  if (hermesDisplay) {
    next.cliSkin = readString(hermesDisplay, 'skin', current.cliSkin)
    next.personalityPreset = readString(hermesDisplay, 'personality', current.personalityPreset)
    next.toolProgressOverrides = readString(hermesDisplay, 'tool_progress_overrides', current.toolProgressOverrides)
  }
  if (hermesWeb) {
    next.webCrawlBackend = readString(hermesWeb, 'crawl_backend', current.webCrawlBackend)
    next.parallelSearchMode = readString(hermesWeb, 'parallel_search_mode', current.parallelSearchMode)
    next.firecrawlApiUrl = readString(hermesWeb, 'firecrawl_api_url', current.firecrawlApiUrl)
  }
  if (hermesStreaming) {
    next.streamReadTimeout = readNumber(hermesStreaming, 'read_timeout', current.streamReadTimeout)
    next.streamStaleTimeout = readNumber(hermesStreaming, 'stale_timeout', current.streamStaleTimeout)
    next.apiTimeout = readNumber(hermesStreaming, 'api_timeout', current.apiTimeout)
    next.gatewayBufferThreshold = readNumber(hermesStreaming, 'gateway_buffer_threshold', current.gatewayBufferThreshold)
    next.gatewayCursor = readString(hermesStreaming, 'gateway_cursor', current.gatewayCursor)
  }
  if (hermesGateway) {
    next.groupSessionsPerUser = readBoolean(hermesGateway, 'group_sessions_per_user', current.groupSessionsPerUser)
    next.unauthorizedDmBehavior = readString(hermesGateway, 'unauthorized_dm_behavior', current.unauthorizedDmBehavior)
    next.unauthorizedDmOverrides = readString(hermesGateway, 'unauthorized_dm_overrides', current.unauthorizedDmOverrides)
  }
  if (hermes) next.quickCommands = readString(hermes, 'quick_commands', current.quickCommands)
  const hermesEnvironment = hermes && isRecord(hermes.environment) ? hermes.environment : undefined
  if (hermesEnvironment) {
    next.envSubstitutionEnabled = readBoolean(hermesEnvironment, 'substitution_enabled', current.envSubstitutionEnabled)
    next.envSubstitutionTemplate = readString(hermesEnvironment, 'template', current.envSubstitutionTemplate)
  }

  next.fileReadMaxChars = readNumber(payload, 'file_read_max_chars', current.fileReadMaxChars)
  next.contextFileMaxChars = readNumber(payload, 'context_file_max_chars', current.contextFileMaxChars)
  if (typeof payload.timezone === 'string') next.timezone = payload.timezone
  if (hermesUi) {
    next.theme = readString(hermesUi, 'theme', current.theme) as Theme
    next.accent = readString(hermesUi, 'accent', current.accent) as Accent
    next.density = readString(hermesUi, 'density', current.density) as Density
    next.uiScale = readNumber(hermesUi, 'ui_scale', current.uiScale)
    next.fontSize = readNumber(hermesUi, 'font_size', current.fontSize)
    next.language = readString(hermesUi, 'language', current.language)
    next.workspaceName = readString(hermesUi, 'workspace_name', current.workspaceName)
    next.startupView = readString(hermesUi, 'startup_view', current.startupView)
  }

  return next
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
      temp_dir: settings.terminalTempDir,
      font_family: settings.terminalFontFamily,
      home_mode: settings.terminalHomeMode,
      timeout: settings.terminalTimeout,
      persistent: settings.terminalPersistent,
      sync_back_max_bytes: settings.terminalSyncBackMaxBytes,
      cpu: settings.terminalCpu,
      memory: settings.terminalMemory,
      disk: settings.terminalDisk,
      docker_image: settings.dockerImage,
      vercel_sandbox_image: settings.vercelSandboxImage,
      modal_image: settings.modalImage,
      daytona_image: settings.daytonaImage,
      singularity_image: settings.singularityImage,
      docker_forward_env: settings.dockerForwardEnv,
      docker_volumes: settings.dockerVolumes,
      docker_run_as_host_user: settings.dockerRunAsHostUser,
      docker_extra_args: settings.dockerExtraArgs,
      docker_persist_across_processes: settings.dockerPersistAcrossProcesses,
      docker_orphan_reaper: settings.dockerOrphanReaper,
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
      write_approval: settings.memoryWriteApproval,
      nudge_interval: settings.memoryNudgeInterval,
      flush_min_turns: settings.memoryFlushMinTurns,
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
      focus_view: settings.focusView,
      interim_assistant_messages: settings.interimAssistantMessages,
      suppress_warning_notifications: settings.suppressWarningNotifications,
      show_commentary: settings.showCommentary,
      vim_mode: settings.vimMode,
      timestamps: settings.timestamps,
      timestamp_format: settings.timestampFormat,
      turn_summary: settings.turnSummary,
      spinner_token_flow: settings.spinnerTokenFlow,
      bell_on_prompt: settings.bellOnPrompt,
      file_mutation_verifier: settings.fileMutationVerifier,
      credits_notices: settings.creditsNotices,
      cli_multiline_shortcuts: settings.cliMultilineShortcuts,
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
      provider_tier: { parallel: settings.parallelTier, exa: settings.exaTier },
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
      tool_loop_guardrails: {
        warnings_enabled: settings.loopWarningsEnabled,
        hard_stop_enabled: settings.loopHardStopEnabled,
        non_interactive_hard_stop_enabled: settings.nonInteractiveHardStopEnabled,
        warn_after: {
          exact_failure: settings.exactFailureWarnAfter,
          same_tool_failure: settings.sameToolFailureWarnAfter,
          idempotent_no_progress: settings.idempotentWarnAfter,
        },
        hard_stop_after: {
          exact_failure: settings.exactFailureHardStopAfter,
          same_tool_failure: settings.sameToolFailureHardStopAfter,
          idempotent_no_progress: settings.idempotentHardStopAfter,
        },
        loop_caps: {
          max_web_searches: settings.maxWebSearchesPerTurn,
          max_subagents: settings.maxSubagentsPerTurn,
        },
      },
      execution_guidance: settings.executionGuidance,
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
    hermes_parity: {
      context: {
        engine: settings.contextEngine,
        memory_provider: settings.memoryProvider,
        auxiliary_reasoning_effort: settings.auxiliaryReasoningEffort,
      },
      credential_pool: {
        strategy: settings.credentialPoolStrategy,
      },
      fallback_model: {
        provider: settings.fallbackModelProvider,
        model: settings.fallbackModel,
        base_url: settings.fallbackModelBaseUrl,
      },
      auxiliary: {
        web_extract: {
          provider: settings.auxWebExtractProvider,
          model: settings.auxWebExtractModel,
          base_url: settings.auxWebExtractBaseUrl,
          timeout: settings.auxWebExtractTimeout,
        },
        approval: {
          provider: settings.auxApprovalProvider,
          model: settings.auxApprovalModel,
          base_url: settings.auxApprovalBaseUrl,
          timeout: settings.auxApprovalTimeout,
        },
        session_search: {
          provider: settings.auxSessionSearchProvider,
          model: settings.auxSessionSearchModel,
          base_url: settings.auxSessionSearchBaseUrl,
          timeout: settings.auxSessionSearchTimeout,
        },
        skills_hub: {
          provider: settings.auxSkillsHubProvider,
          model: settings.auxSkillsHubModel,
          base_url: settings.auxSkillsHubBaseUrl,
          timeout: settings.auxSkillsHubTimeout,
        },
        mcp: {
          provider: settings.auxMcpProvider,
          model: settings.auxMcpModel,
          base_url: settings.auxMcpBaseUrl,
          timeout: settings.auxMcpTimeout,
        },
        flush_memories: {
          provider: settings.auxFlushProvider,
          model: settings.auxFlushModel,
          base_url: settings.auxFlushBaseUrl,
          timeout: settings.auxFlushTimeout,
        },
        vision: {
          download_timeout: settings.visionDownloadTimeout,
        },
      },
      tts: {
        base_url: settings.ttsBaseUrl,
        voice_id: settings.ttsVoiceId,
        model_id: settings.ttsModelId,
        ref_audio: settings.ttsRefAudio,
        ref_text: settings.ttsRefText,
        device: settings.ttsDevice,
      },
      voice: {
        record_key: settings.voiceRecordKey,
        max_recording_seconds: settings.voiceMaxRecordingSeconds,
        auto_tts: settings.voiceAutoTts,
        silence_threshold: settings.voiceSilenceThreshold,
        silence_duration: settings.voiceSilenceDuration,
      },
      display: {
        skin: settings.cliSkin,
        personality: settings.personalityPreset,
        tool_progress_overrides: settings.toolProgressOverrides,
      },
      web: {
        crawl_backend: settings.webCrawlBackend,
        parallel_search_mode: settings.parallelSearchMode,
        firecrawl_api_url: settings.firecrawlApiUrl,
      },
      streaming: {
        read_timeout: settings.streamReadTimeout,
        stale_timeout: settings.streamStaleTimeout,
        api_timeout: settings.apiTimeout,
        gateway_buffer_threshold: settings.gatewayBufferThreshold,
        gateway_cursor: settings.gatewayCursor,
      },
      gateway: {
        group_sessions_per_user: settings.groupSessionsPerUser,
        unauthorized_dm_behavior: settings.unauthorizedDmBehavior,
        unauthorized_dm_overrides: settings.unauthorizedDmOverrides,
      },
      quick_commands: settings.quickCommands,
      environment: {
        substitution_enabled: settings.envSubstitutionEnabled,
        template: settings.envSubstitutionTemplate,
      },
    },
    file_read_max_chars: settings.fileReadMaxChars,
    context_file_max_chars: settings.contextFileMaxChars,
    timezone: settings.timezone,
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
