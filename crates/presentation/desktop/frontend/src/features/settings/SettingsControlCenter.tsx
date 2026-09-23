import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import Icon, { type IconName } from '../../components/Icon'
import EffectivePermissionMatrix from '../security/EffectivePermissionMatrix'
const SettingsStudio = lazy(() => import('./SettingsStudio'))
const CustomizeManager = lazy(() => import('./CustomizeManager'))
const KeymapEditor = lazy(() => import('./KeymapEditor'))
const CapabilityRegistry = lazy(() => import('../runtime/CapabilityRegistry'))
const SetupChecklist = lazy(() => import('./SetupChecklist'))
const ScopeResolverPreview = lazy(() => import('./ScopeResolverPreview'))
import {
  type SettingsScope,
  type SettingsStore,
  createSettingsStore,
  exportSettingsStore,
  readSettingsStore,
  resolveSettingsScope,
  saveSettingsStore,
  getSettingsHistory,
} from './settings-engine'

type Scope = 'global' | 'project' | 'session' | 'agent'
type SectionId = 'overview' | 'ai' | 'context' | 'execution' | 'browser' | 'customizations' | 'cloud' | 'developer' | 'interface' | 'data'

interface ControlState {
  scope: Scope
  activeMode: string
  defaultModel: string
  fastModel: string
  auxiliaryProvider: string
  visionAuxModel: string
  compressionAuxModel: string
  approvalAuxModel: string
  browserAuxModel: string
  imageAuxModel: string
  titleAuxModel: string
  reasoning: string
  fallback: string
  autoRun: string
  autoFix: boolean
  autoApply: boolean
  guardrails: boolean
  customInstructions: string
  parallelSubagents: number
  toolBudget: number
  iterationBudget: number
  serviceTier: string
  codebaseIndex: boolean
  semanticSearch: boolean
  watchFiles: boolean
  indexIgnored: boolean
  maxIndexedFiles: number
  contextBudget: number
  autoCompression: boolean
  memory: boolean
  sessionRecall: boolean
  attachments: boolean
  terminalContext: boolean
  diffContext: boolean
  browserContext: boolean
  permissionMode: string
  terminalSandbox: boolean
  workspaceOnly: boolean
  networkAccess: string
  commandTimeout: number
  checkpointing: boolean
  reviewBeforeApply: boolean
  browserEnabled: boolean
  browserBackend: string
  browserRecording: boolean
  chromeDevtools: boolean
  browserPersistence: boolean
  visionEmbedBytes: number
  visionMaxCalls: number
  mcpEnabled: boolean
  rulesEnabled: boolean
  skillsEnabled: boolean
  pluginsEnabled: boolean
  customAgentsEnabled: boolean
  inheritCustomizations: boolean
  hooksEnabled: boolean
  cloudAgents: boolean
  backgroundAgents: boolean
  isolatedWorktrees: boolean
  remoteControl: boolean
  captureArtifacts: boolean
  automationEnabled: boolean
  pushNotifications: boolean
  theme: string
  density: string
  reducedMotion: boolean
  compactSidebar: boolean
  splitTerminal: boolean
  hoverPreviews: boolean
  showDiffReview: boolean
  statusFields: string
  platformDisplayOverride: string
  telemetry: boolean
  privacyMode: boolean
  costTracking: boolean
  usageLimit: number
  editorFontSize: number
  editorTabSize: number
  wordWrap: string
  minimap: boolean
  breadcrumbs: boolean
  formatOnSave: boolean
  codeActionsOnSave: boolean
  inlineSuggestions: boolean
  tabAutocomplete: boolean
  autocompleteModel: string
  autocompleteDelay: number
  semanticHighlighting: boolean
  gitPanel: boolean
  autoStageAgentChanges: boolean
  generatedCommitMessages: boolean
  branchDiffs: boolean
  conflictResolver: boolean
  verifyOnCompletion: boolean
  verificationCommand: string
  artifactPreview: boolean
  autoAttachArtifacts: boolean
  goalRetention: boolean
  steeringWhileRunning: boolean
  loopCheckInterval: number
  remoteNickname: string
}

const defaults: ControlState = {
  scope: 'project',
  activeMode: 'Agent',
  defaultModel: 'Auto route',
  fastModel: 'Fast / low-latency',
  auxiliaryProvider: 'Automatic',
  visionAuxModel: 'Auto vision',
  compressionAuxModel: 'Auto summarizer',
  approvalAuxModel: 'Auto approval',
  browserAuxModel: 'Auto browser',
  imageAuxModel: 'Auto image',
  titleAuxModel: 'Auto title',
  reasoning: 'Medium',
  fallback: 'Automatic failover',
  autoRun: 'Auto-review',
  autoFix: true,
  autoApply: false,
  guardrails: true,
  customInstructions: '',
  parallelSubagents: 4,
  toolBudget: 72,
  iterationBudget: 500,
  serviceTier: 'Auto',
  codebaseIndex: true,
  semanticSearch: true,
  watchFiles: true,
  indexIgnored: false,
  maxIndexedFiles: 12000,
  contextBudget: 72,
  autoCompression: true,
  memory: true,
  sessionRecall: true,
  attachments: true,
  terminalContext: true,
  diffContext: true,
  browserContext: true,
  permissionMode: 'Request review',
  terminalSandbox: true,
  workspaceOnly: true,
  networkAccess: 'Guarded',
  commandTimeout: 180,
  checkpointing: true,
  reviewBeforeApply: true,
  browserEnabled: true,
  browserBackend: 'Auto',
  browserRecording: false,
  chromeDevtools: true,
  browserPersistence: false,
  visionEmbedBytes: 262144,
  visionMaxCalls: 3,
  mcpEnabled: true,
  rulesEnabled: true,
  skillsEnabled: true,
  pluginsEnabled: true,
  customAgentsEnabled: true,
  inheritCustomizations: true,
  hooksEnabled: true,
  cloudAgents: true,
  backgroundAgents: true,
  isolatedWorktrees: true,
  remoteControl: true,
  captureArtifacts: true,
  automationEnabled: true,
  pushNotifications: true,
  theme: 'Monochrome',
  density: 'Comfortable',
  reducedMotion: false,
  compactSidebar: false,
  splitTerminal: true,
  hoverPreviews: true,
  showDiffReview: true,
  statusFields: 'model · context · latency · branch',
  platformDisplayOverride: 'Inherit global',
  telemetry: false,
  privacyMode: true,
  costTracking: true,
  usageLimit: 100,
  editorFontSize: 13,
  editorTabSize: 2,
  wordWrap: 'off',
  minimap: false,
  breadcrumbs: true,
  formatOnSave: false,
  codeActionsOnSave: true,
  inlineSuggestions: true,
  tabAutocomplete: true,
  autocompleteModel: 'Auto route',
  autocompleteDelay: 80,
  semanticHighlighting: true,
  gitPanel: true,
  autoStageAgentChanges: false,
  generatedCommitMessages: true,
  branchDiffs: true,
  conflictResolver: true,
  verifyOnCompletion: true,
  verificationCommand: 'npm test && npm run verify',
  artifactPreview: true,
  autoAttachArtifacts: true,
  goalRetention: true,
  steeringWhileRunning: true,
  loopCheckInterval: 30,
  remoteNickname: 'this workstation',
}

const sections: Array<{ id: SectionId; label: string; detail: string; icon: IconName }> = [
  { id: 'overview', label: 'Overview', detail: 'Scopes, active mode and system state', icon: 'home' },
  { id: 'ai', label: 'AI & Agent', detail: 'Models, modes, autonomy and subagents', icon: 'bot' },
  { id: 'context', label: 'Codebase & Context', detail: 'Indexing, @context, memory and compression', icon: 'search' },
  { id: 'execution', label: 'Execution & Security', detail: 'Permissions, sandbox, terminal and review', icon: 'lock' },
  { id: 'browser', label: 'Browser & Web', detail: 'Browser agent, DevTools and web context', icon: 'globe' },
  { id: 'customizations', label: 'Customizations', detail: 'Rules, skills, plugins, MCP, agents and hooks', icon: 'spark' },
  { id: 'cloud', label: 'Cloud & Automations', detail: 'Background agents, worktrees, artifacts and triggers', icon: 'cloud' },
  { id: 'developer', label: 'Editor, Git & Verification', detail: 'Autocomplete, VCS, task verification, artifacts and goals', icon: 'code' },
  { id: 'interface', label: 'Interface & Performance', detail: 'Theme, density, panels and rendering efficiency', icon: 'layout' },
  { id: 'data', label: 'Data & Usage', detail: 'Privacy, telemetry, cost and local state', icon: 'database' },
]

const modes = ['Agent', 'Plan', 'Ask', 'Review', 'Custom']
const models = ['Auto route', 'GPT-5.x', 'Claude', 'Gemini', 'Qwen', 'DeepSeek', 'Codex', 'Local model', 'Custom endpoint']
const toolModes = ['Auto-review', 'Allowlist', 'Request review', 'Always proceed']
const browserBackends = ['Auto', 'Local Chrome', 'Chrome DevTools', 'Browser Use', 'Browserbase', 'Camofox', 'Lightpanda']
const themes = ['Monochrome', 'Graphite', 'Paper', 'High contrast', 'Dark OLED']
const densities = ['Compact', 'Comfortable', 'Spacious']

interface SettingsControlCenterProps {
  notify: (message: string) => void
}

type PersistedControlState = Omit<ControlState, 'scope'>
const { scope: _defaultScope, ...persistedDefaults } = defaults
const CONTROL_CENTER_STORAGE_KEY = 'agenticos.settings.control-center-v2'

function readControlStore(): SettingsStore<PersistedControlState> {
  const stored = readSettingsStore(CONTROL_CENTER_STORAGE_KEY, persistedDefaults)
  if (stored.history.length > 0 || stored.activeScope !== 'project' || window.localStorage.getItem(CONTROL_CENTER_STORAGE_KEY)) {
    return stored
  }

  try {
    const legacyRaw = window.localStorage.getItem('agenticos.ui.control-center-v1')
    if (!legacyRaw) return stored
    const legacy = JSON.parse(legacyRaw) as Partial<ControlState>
    const { scope: legacyScope = 'project', ...legacySettings } = legacy
    return {
      ...createSettingsStore(persistedDefaults),
      activeScope: legacyScope as SettingsScope,
      scopes: {
        ...createSettingsStore(persistedDefaults).scopes,
        [legacyScope]: { ...persistedDefaults, ...legacySettings },
      },
    }
  } catch {
    return stored
  }
}

export default function SettingsControlCenter({ notify }: SettingsControlCenterProps) {
  const initialStore = useMemo(() => readControlStore(), [])
  const [store, setStore] = useState<SettingsStore<PersistedControlState>>(initialStore)
  const [section, setSection] = useState<SectionId>('overview')
  const [query, setQuery] = useState('')
  const [deepConfig, setDeepConfig] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [savedStore, setSavedStore] = useState<SettingsStore<PersistedControlState>>(initialStore)
  const [historyOpen, setHistoryOpen] = useState(false)

  const state = useMemo<ControlState>(() => ({
    ...resolveSettingsScope(store, store.activeScope),
    scope: store.activeScope,
  }), [store])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.agenticosTheme = state.theme.toLowerCase().replace(/\\s+/g, '-')
    root.dataset.agenticosDensity = state.density.toLowerCase()
    root.dataset.agenticosReducedMotion = state.reducedMotion ? 'true' : 'false'
  }, [state.theme, state.density, state.reducedMotion])

  const visibleSections = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return sections
    return sections.filter((item) => (item.label + ' ' + item.detail).toLowerCase().includes(normalized))
  }, [query])

  const update = <K extends keyof ControlState>(key: K, value: ControlState[K]) => {
    if (key === 'scope') {
      const nextScope = value as SettingsScope
      if (dirty && !window.confirm('Discard unsaved changes before switching scope?')) return
      setStore((current) => ({ ...current, activeScope: nextScope }))
      setSavedStore((current) => ({ ...current, activeScope: nextScope }))
      setDirty(false)
      return
    }

    const persistedKey = key as keyof PersistedControlState
    const persistedValue = value as PersistedControlState[typeof persistedKey]
    setStore((current) => ({
      ...current,
      scopes: {
        ...current.scopes,
        [current.activeScope]: {
          ...current.scopes[current.activeScope],
          [persistedKey]: persistedValue,
        },
      },
    }))
    setDirty(true)
  }

  function save() {
    const next = saveSettingsStore(CONTROL_CENTER_STORAGE_KEY, store, `Saved ${store.activeScope} configuration`)
    setStore(next)
    setSavedStore(next)
    setDirty(false)
    notify(`Saved ${state.scope} configuration`)
  }

  function discard() {
    setStore(savedStore)
    setDirty(false)
    notify('Discarded local Control Center changes')
  }

  function reset() {
    if (!window.confirm(`Reset the ${state.scope} Control Center scope to safe defaults?`)) return
    setStore((current) => {
      const next = {
        ...current,
        scopes: {
          ...current.scopes,
          [current.activeScope]: { ...persistedDefaults },
        },
      }
      return next
    })
    setDirty(true)
  }

  function exportConfig() {
    const serialized = exportSettingsStore(store)
    const blob = new Blob([serialized], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'agenticos-settings-store.json'
    link.click()
    URL.revokeObjectURL(url)
    notify('Scoped settings store exported')
  }

  if (deepConfig) {
    return (
      <section className="settings-control-center">
        <div className="settings-control-center__deepbar">
          <button type="button" className="studio-button" onClick={() => setDeepConfig(false)}>
            <Icon name="chevron-left" size={14} /> Control Center
          </button>
          <span className="settings-control-center__deeptitle">
            <Icon name="sliders" size={14} /> Deep Configuration
          </span>
          <span className="settings-control-center__deepmeta">193+ detailed runtime-inspired controls</span>
        </div>
        <SettingsStudio notify={notify} />
      </section>
    )
  }

  return (
    <section className="settings-control-center">
      <header className="settings-control-center__header">
        <div className="settings-control-center__brand">
          <span className="settings-kicker"><span className="status-dot status-dot--live" /> Unified Control Plane</span>
          <h1>Settings</h1>
          <p>One optimized interface for the configuration surfaces found across modern agent IDEs, desktop agents and autonomous runtimes.</p>
        </div>
        <div className="settings-control-center__toolbar">
          <label className="control-center-search">
            <Icon name="search" size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search settings, agents, permissions, models…" />
            <kbd>⌘K</kbd>
          </label>
          <button type="button" className={dirty ? 'studio-button studio-button--active' : 'studio-button'} onClick={save} disabled={!dirty}><Icon name="check" size={14} /> Save</button>
          <button type="button" className="studio-button" onClick={discard} disabled={!dirty}><Icon name="refresh" size={14} /> Discard</button>
          <button type="button" className={historyOpen ? 'studio-button studio-button--active' : 'studio-button'} onClick={() => setHistoryOpen((open) => !open)}><Icon name="history" size={14} /> History</button>
          <button type="button" className="studio-button" onClick={exportConfig}><Icon name="download" size={14} /> Export</button>
          <button type="button" className="studio-button" onClick={reset}><Icon name="refresh" size={14} /> Reset scope</button>
        </div>
      </header>

      <div className="control-center-scopebar">
        <div className="control-center-scopes" role="tablist" aria-label="Configuration scope">
          {([
            ['global', 'Global'],
            ['project', 'Project'],
            ['session', 'Session'],
            ['agent', 'Agent'],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" className={state.scope === id ? 'control-center-scope control-center-scope--active' : 'control-center-scope'} onClick={() => update('scope', id)}>{label}</button>
          ))}
        </div>
        <div className="control-center-status">
          <span className="status-dot status-dot--live" /> {dirty ? 'Local changes' : 'Saved locally'}
          <span className="control-center-status__sep">·</span>
          Scope: {state.scope}
        </div>
      </div>

      {historyOpen && (
        <div className="control-center-history">
          <div className="control-center-history__header">
            <div><strong>Configuration history</strong><small>Local snapshots kept for the last 20 saves.</small></div>
            <button type="button" className="icon-button" onClick={() => setHistoryOpen(false)} aria-label="Close history"><Icon name="x" size={14} /></button>
          </div>
          <div className="control-center-history__list">
            {getSettingsHistory(store).slice(0, 8).map((entry) => (
              <div className="control-center-history__row" key={entry.id}>
                <span><strong>{entry.label}</strong><small>{entry.scope} · {new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></span>
                <button type="button" className="studio-button" onClick={() => {
                  if (dirty && !window.confirm('Discard current unsaved changes before restoring this snapshot?')) return
                  setStore((current) => ({ ...current, scopes: { ...current.scopes, [current.activeScope]: { ...entry.snapshot } } }))
                  setDirty(true)
                  setHistoryOpen(false)
                }}>Restore</button>
              </div>
            ))}
            {getSettingsHistory(store).length === 0 && <div className="control-center-history__empty">No saved snapshots yet.</div>}
          </div>
        </div>
      )}

      <div className="control-center-layout">
        <aside className="control-center-nav" aria-label="Settings sections">
          <div className="control-center-nav__caption">Configuration</div>
          {visibleSections.map((item) => (
            <button key={item.id} type="button" className={section === item.id ? 'control-center-nav__item control-center-nav__item--active' : 'control-center-nav__item'} onClick={() => setSection(item.id)}>
              <Icon name={item.icon} size={15} />
              <span><strong>{item.label}</strong><small>{item.detail}</small></span>
              {item.id === 'overview' && <span className="control-center-nav__pulse" />}
            </button>
          ))}
          <div className="control-center-nav__divider" />
          <button type="button" className="control-center-nav__item control-center-nav__item--deep" onClick={() => setDeepConfig(true)}>
            <Icon name="sliders" size={15} />
            <span><strong>Deep Configuration</strong><small>Full detailed catalog</small></span>
            <span className="control-center-nav__count">193+</span>
          </button>
        </aside>

        <main className="control-center-content">
          {section === 'overview' && (
            <ControlPage title="Overview" description="High-signal controls first. Detail remains one click away, so a large feature set does not become a slow or confusing control wall.">
              <div className="control-center-grid control-center-grid--status">
                <StatusCard label="Active mode" value={state.activeMode} detail={state.scope + ' scope'} icon="bot" />
                <StatusCard label="Model route" value={state.defaultModel} detail={state.fallback} icon="network" />
                <StatusCard label="Execution" value={state.autoRun} detail={state.permissionMode} icon="terminal" />
                <StatusCard label="Security" value={state.guardrails ? 'Guardrails on' : 'Guardrails off'} detail={state.workspaceOnly ? 'Workspace boundary' : 'Extended access'} icon="lock" />
                <StatusCard label="Context" value={state.codebaseIndex ? 'Indexed' : 'Manual'} detail={state.contextBudget + '% budget'} icon="search" />
                <StatusCard label="Performance" value={state.reducedMotion ? 'Low motion' : 'Full motion'} detail={state.compactSidebar ? 'Compact chrome' : 'Standard chrome'} icon="activity" />
              </div>
              <ControlSection title="Fast controls" detail="The controls most often changed during active work.">
                <Toggle label="Auto-fix errors" value={state.autoFix} onChange={(value) => update('autoFix', value)} />
                <Toggle label="Review before apply" value={state.reviewBeforeApply} onChange={(value) => update('reviewBeforeApply', value)} />
                <Toggle label="Checkpoint changes" value={state.checkpointing} onChange={(value) => update('checkpointing', value)} />
                <Toggle label="Background agents" value={state.backgroundAgents} onChange={(value) => update('backgroundAgents', value)} />
                <Toggle label="Capture artifacts" value={state.captureArtifacts} onChange={(value) => update('captureArtifacts', value)} />
                <Toggle label="Push notifications" value={state.pushNotifications} onChange={(value) => update('pushNotifications', value)} />
              </ControlSection>
              <ControlSection title="Configuration inheritance" detail="Use scoped settings instead of one global pile of toggles.">
                <Select label="Active mode" value={state.activeMode} options={modes} onChange={(value) => update('activeMode', value)} />
                <Text label="Custom agent instructions" value={state.customInstructions} onChange={(value) => update('customInstructions', value)} placeholder="Optional workspace-specific guidance…" />
              </ControlSection>
              <ControlSection title="First-run setup" detail="High-signal setup state before deep configuration.">
                <LazyPanel><SetupChecklist /></LazyPanel>
              </ControlSection>
              <ControlSection title="Runtime capabilities" detail="The frontend adapts to what the runtime actually exposes.">
                <LazyPanel><CapabilityRegistry /></LazyPanel>
              </ControlSection>
              <ControlSection title="Effective configuration" detail="Preview how Global, Project, Agent and Session values resolve.">
                <LazyPanel><ScopeResolverPreview /></LazyPanel>
              </ControlSection>
            </ControlPage>
          )}

          {section === 'ai' && (
            <ControlPage title="AI & Agent" description="A unified model and agent control plane covering modes, models, autonomy, tools and parallel specialists.">
              <ControlSection title="Modes">
                <ModePicker value={state.activeMode} onChange={(value) => update('activeMode', value)} />
                <Select label="Reasoning effort" value={state.reasoning} options={['None', 'Minimal', 'Low', 'Medium', 'High', 'xHigh']} onChange={(value) => update('reasoning', value)} />
                <Select label="Execution approval" value={state.autoRun} options={toolModes} onChange={(value) => update('autoRun', value)} />
              </ControlSection>
              <ControlSection title="Models & routing">
                <Select label="Default model" value={state.defaultModel} options={models} onChange={(value) => update('defaultModel', value)} />
                <Select label="Fast / low-latency model" value={state.fastModel} options={models} onChange={(value) => update('fastModel', value)} />
                <Select label="Fallback strategy" value={state.fallback} options={['Automatic failover', 'Provider priority', 'Pinned model', 'Local-only']} onChange={(value) => update('fallback', value)} />
                <Range label="Tool budget" value={state.toolBudget} description="Logical budget for tool-heavy turns." onChange={(value) => update('toolBudget', value)} />
              </ControlSection>
              <ControlSection title="Auxiliary model routing">
                <Select label="Auxiliary provider" value={state.auxiliaryProvider} options={['Automatic', 'Main model', 'OpenRouter', 'Nous', 'Custom']} onChange={(value) => update('auxiliaryProvider', value)} />
                <Select label="Vision analysis model" value={state.visionAuxModel} options={models} onChange={(value) => update('visionAuxModel', value)} />
                <Select label="Compression model" value={state.compressionAuxModel} options={models} onChange={(value) => update('compressionAuxModel', value)} />
                <Select label="Approval model" value={state.approvalAuxModel} options={models} onChange={(value) => update('approvalAuxModel', value)} />
                <Select label="Browser analysis model" value={state.browserAuxModel} options={models} onChange={(value) => update('browserAuxModel', value)} />
                <Select label="Image / media model" value={state.imageAuxModel} options={models} onChange={(value) => update('imageAuxModel', value)} />
                <Select label="Session title model" value={state.titleAuxModel} options={models} onChange={(value) => update('titleAuxModel', value)} />
              </ControlSection>
              <ControlSection title="Agent behavior">
                <Number label="Iteration budget" value={state.iterationBudget} suffix="turns" min={10} max={5000} onChange={(value) => update('iterationBudget', value)} />
                <Select label="Provider service tier" value={state.serviceTier} options={['Auto', 'Priority', 'Standard', 'Cold']} onChange={(value) => update('serviceTier', value)} />
                <Number label="Parallel subagents" value={state.parallelSubagents} suffix="agents" min={0} max={32} onChange={(value) => update('parallelSubagents', value)} />
                <Toggle label="Auto-fix errors" value={state.autoFix} onChange={(value) => update('autoFix', value)} />
                <Toggle label="Auto-apply edits" value={state.autoApply} onChange={(value) => update('autoApply', value)} />
                <Toggle label="Guardrails" value={state.guardrails} onChange={(value) => update('guardrails', value)} />
                <Text label="Persistent instructions" value={state.customInstructions} onChange={(value) => update('customInstructions', value)} placeholder="Rules for this scope…" />
              </ControlSection>
              <InfoCallout icon="bot" title="Custom-agent model" text="Custom agents can bind a model, instructions, tools, skills, rules, subagents and MCP inheritance from this control plane." />
            </ControlPage>
          )}

          {section === 'context' && (
            <ControlPage title="Codebase & Context" description="Fast retrieval matters more than showing every option at once. Indexing and context controls are grouped by how they affect agent performance.">
              <ControlSection title="Codebase indexing">
                <Toggle label="Codebase index" value={state.codebaseIndex} onChange={(value) => update('codebaseIndex', value)} />
                <Toggle label="Semantic search" value={state.semanticSearch} onChange={(value) => update('semanticSearch', value)} />
                <Toggle label="Watch file changes" value={state.watchFiles} onChange={(value) => update('watchFiles', value)} />
                <Toggle label="Include ignored paths" value={state.indexIgnored} onChange={(value) => update('indexIgnored', value)} />
                <Number label="Indexed-file budget" value={state.maxIndexedFiles} suffix="files" min={100} max={250000} onChange={(value) => update('maxIndexedFiles', value)} />
              </ControlSection>
              <ControlSection title="@Context sources">
                <Toggle label="Files & folders" value={state.attachments} onChange={(value) => update('attachments', value)} />
                <Toggle label="Terminal output" value={state.terminalContext} onChange={(value) => update('terminalContext', value)} />
                <Toggle label="Git diffs / commits" value={state.diffContext} onChange={(value) => update('diffContext', value)} />
                <Toggle label="Browser context" value={state.browserContext} onChange={(value) => update('browserContext', value)} />
              </ControlSection>
              <ControlSection title="Context engine">
                <Range label="Context budget" value={state.contextBudget} description="Target share of the active model window." onChange={(value) => update('contextBudget', value)} />
                <Toggle label="Automatic compression" value={state.autoCompression} onChange={(value) => update('autoCompression', value)} />
                <Toggle label="Persistent memory" value={state.memory} onChange={(value) => update('memory', value)} />
                <Toggle label="Session recall" value={state.sessionRecall} onChange={(value) => update('sessionRecall', value)} />
              </ControlSection>
              <ControlSection title="Vision embed budget">
                <Number label="Target embed bytes" value={state.visionEmbedBytes} suffix="bytes" min={65536} max={4194304} onChange={(value) => update('visionEmbedBytes', value)} />
                <Number label="Max embeds per image" value={state.visionMaxCalls} suffix="calls" min={0} max={100} onChange={(value) => update('visionMaxCalls', value)} />
              </ControlSection>
              <InfoCallout icon="search" title="Progressive disclosure" text="The shell renders only the selected domain. Large histories, artifact lists and codebase views should use the same lazy/virtual strategy instead of mounting every surface at once." />
            </ControlPage>
          )}

          {section === 'execution' && (
            <ControlPage title="Execution & Security" description="Permission boundaries inspired by modern agent IDEs, plus Hermes-style sandbox and runtime guardrails.">
              <ControlSection title="Agent permissions">
                <Select label="Execution mode" value={state.permissionMode} options={['Auto-review', 'Allowlist', 'Request review', 'Always proceed']} onChange={(value) => update('permissionMode', value)} />
                <Select label="Network access" value={state.networkAccess} options={['Blocked', 'Guarded', 'Workspace only', 'Open']} onChange={(value) => update('networkAccess', value)} />
                <Toggle label="Workspace-only file access" value={state.workspaceOnly} onChange={(value) => update('workspaceOnly', value)} />
                <Toggle label="Review before apply" value={state.reviewBeforeApply} onChange={(value) => update('reviewBeforeApply', value)} />
              </ControlSection>
              <ControlSection title="Project scope">
                <Select label="Project permission preset" value={state.permissionMode} options={['Auto-review', 'Allowlist', 'Request review', 'Always proceed']} onChange={(value) => update('permissionMode', value)} />
                <Select label="Outside-workspace access" value={state.workspaceOnly ? 'Always deny' : 'Ask / allow'} options={['Always deny', 'Ask / allow']} onChange={(value) => update('workspaceOnly', value === 'Always deny')} />
                <Toggle label="Terminal sandbox" value={state.terminalSandbox} onChange={(value) => update('terminalSandbox', value)} />
                <Toggle label="Isolated project worktrees" value={state.isolatedWorktrees} onChange={(value) => update('isolatedWorktrees', value)} />
              </ControlSection>
              <ControlSection title="Terminal & sandbox">
                <Number label="Command timeout" value={state.commandTimeout} suffix="seconds" min={5} max={3600} onChange={(value) => update('commandTimeout', value)} />
                <Toggle label="Checkpointing" value={state.checkpointing} onChange={(value) => update('checkpointing', value)} />
              </ControlSection>
              <ControlSection title="Agent guardrails">
                <Toggle label="Loop guardrails" value={state.guardrails} onChange={(value) => update('guardrails', value)} />
                <Toggle label="Auto-fix errors" value={state.autoFix} onChange={(value) => update('autoFix', value)} />
                <Toggle label="Auto-run" value={state.autoRun === 'Always proceed'} onChange={(value) => update('autoRun', value ? 'Always proceed' : 'Request review')} />
              </ControlSection>
              <ControlSection title="Effective permissions">
                <EffectivePermissionMatrix
                  executionMode={state.permissionMode}
                  workspaceOnly={state.workspaceOnly}
                  networkAccess={state.networkAccess}
                  terminalSandbox={state.terminalSandbox}
                  guardrails={state.guardrails}
                />
              </ControlSection>
              <InfoCallout icon="lock" title="Safe defaults" text="Destructive and privileged execution remains explicit. The frontend represents policy state; runtime enforcement stays behind typed service contracts." />
            </ControlPage>
          )}

          {section === 'browser' && (
            <ControlPage title="Browser & Web" description="Browser-agent controls, Chrome DevTools connectivity, recordings, web context and managed persistence.">
              <ControlSection title="Browser agent">
                <Toggle label="Browser enabled" value={state.browserEnabled} onChange={(value) => update('browserEnabled', value)} />
                <Select label="Browser backend" value={state.browserBackend} options={browserBackends} onChange={(value) => update('browserBackend', value)} />
                <Toggle label="Chrome DevTools integration" value={state.chromeDevtools} onChange={(value) => update('chromeDevtools', value)} />
                <Toggle label="Record sessions" value={state.browserRecording} onChange={(value) => update('browserRecording', value)} />
                <Toggle label="Managed persistence" value={state.browserPersistence} onChange={(value) => update('browserPersistence', value)} />
              </ControlSection>
              <ControlSection title="Web context">
                <Toggle label="@Browser context" value={state.browserContext} onChange={(value) => update('browserContext', value)} />
                <Toggle label="Browser survives agent turns" value={state.browserPersistence} onChange={(value) => update('browserPersistence', value)} />
              </ControlSection>
              <InfoCallout icon="globe" title="Verification surface" text="The browser configuration is designed for on-demand invocation, DevTools inspection, recordings and provider switching without changing the chat layout." />
            </ControlPage>
          )}

          {section === 'customizations' && (
            <ControlPage title="Customizations" description="One manager for the reusable context that shapes agent behavior across workspaces.">
              <div className="control-center-grid control-center-grid--status">
                <StatusCard label="Rules" value="Workspace + global" detail={state.rulesEnabled ? 'Enabled' : 'Disabled'} icon="shield" />
                <StatusCard label="Skills" value="On demand" detail={state.skillsEnabled ? 'Enabled' : 'Disabled'} icon="spark" />
                <StatusCard label="MCP" value="7 configured" detail={state.mcpEnabled ? 'Available' : 'Disabled'} icon="network" />
                <StatusCard label="Agents" value="Custom + built-in" detail={state.customAgentsEnabled ? 'Available' : 'Disabled'} icon="bot" />
              </div>
              <ControlSection title="Customization sources">
                <Toggle label="Rules" value={state.rulesEnabled} onChange={(value) => update('rulesEnabled', value)} />
                <Toggle label="Skills" value={state.skillsEnabled} onChange={(value) => update('skillsEnabled', value)} />
                <Toggle label="Plugins" value={state.pluginsEnabled} onChange={(value) => update('pluginsEnabled', value)} />
                <Toggle label="MCP servers" value={state.mcpEnabled} onChange={(value) => update('mcpEnabled', value)} />
                <Toggle label="Custom agents" value={state.customAgentsEnabled} onChange={(value) => update('customAgentsEnabled', value)} />
                <Toggle label="Lifecycle hooks" value={state.hooksEnabled} onChange={(value) => update('hooksEnabled', value)} />
                <Toggle label="Inherit existing customizations" value={state.inheritCustomizations} onChange={(value) => update('inheritCustomizations', value)} />
              </ControlSection>
              <ControlSection title="Customization manager">
                <LazyPanel><CustomizeManager /></LazyPanel>
              </ControlSection>
              <ControlSection title="Source formats">
                <InfoLine title=".cursor/rules + AGENTS.md" detail="Scoped project instructions and nested rules." />
                <InfoLine title="Skills / slash workflows" detail="Reusable procedural capabilities with progressive disclosure." />
                <InfoLine title="MCP + plugins" detail="External tools, data and packaged capabilities." />
                <InfoLine title="Custom agents" detail="Dedicated model, prompt, tools, skills, rules and inheritance." />
              </ControlSection>
            </ControlPage>
          )}

          {section === 'cloud' && (
            <ControlPage title="Cloud & Automations" description="Long-running work should be isolated, observable and easy to resume without bloating the foreground session.">
              <ControlSection title="Background agents">
                <Toggle label="Cloud agents" value={state.cloudAgents} onChange={(value) => update('cloudAgents', value)} />
                <Toggle label="Background agents" value={state.backgroundAgents} onChange={(value) => update('backgroundAgents', value)} />
                <Toggle label="Isolated worktrees" value={state.isolatedWorktrees} onChange={(value) => update('isolatedWorktrees', value)} />
                <Toggle label="Capture screenshots / logs / artifacts" value={state.captureArtifacts} onChange={(value) => update('captureArtifacts', value)} />
                <Toggle label="Remote control" value={state.remoteControl} onChange={(value) => update('remoteControl', value)} />
              </ControlSection>
              <ControlSection title="Automations">
                <Toggle label="Automations" value={state.automationEnabled} onChange={(value) => update('automationEnabled', value)} />
                <Toggle label="Push notifications" value={state.pushNotifications} onChange={(value) => update('pushNotifications', value)} />
                <InfoLine title="Triggers" detail="Schedule, GitHub/GitLab events, Slack, webhooks and other integration events." />
                <InfoLine title="Actions" detail="Run agents, review changes, comment on pull requests, send notifications and invoke MCP." />
              </ControlSection>
              <InfoCallout icon="cloud" title="Keep the foreground light" text="The control plane exposes long-running workloads without mounting their full histories. Detailed run timelines remain isolated in the Operations surfaces." />
            </ControlPage>
          )}

          {section === 'developer' && (
            <ControlPage title="Editor, Git & Verification" description="IDE-level controls for code editing, inline completion, version control, verification and long-running task workflows.">
              <ControlSection title="Keymap">
                <LazyPanel><KeymapEditor /></LazyPanel>
              </ControlSection>
              <ControlSection title="Editor">
                <Number label="Editor font size" value={state.editorFontSize} suffix="px" min={10} max={24} onChange={(value) => update('editorFontSize', value)} />
                <Number label="Tab size" value={state.editorTabSize} suffix="spaces" min={1} max={8} onChange={(value) => update('editorTabSize', value)} />
                <Select label="Word wrap" value={state.wordWrap} options={['off', 'bounded', 'on']} onChange={(value) => update('wordWrap', value)} />
                <Toggle label="Minimap" value={state.minimap} onChange={(value) => update('minimap', value)} />
                <Toggle label="Breadcrumbs" value={state.breadcrumbs} onChange={(value) => update('breadcrumbs', value)} />
                <Toggle label="Semantic highlighting" value={state.semanticHighlighting} onChange={(value) => update('semanticHighlighting', value)} />
                <Toggle label="Format on save" value={state.formatOnSave} onChange={(value) => update('formatOnSave', value)} />
                <Toggle label="Code actions on save" value={state.codeActionsOnSave} onChange={(value) => update('codeActionsOnSave', value)} />
              </ControlSection>
              <ControlSection title="Autocomplete & Tab">
                <Toggle label="Inline suggestions" value={state.inlineSuggestions} onChange={(value) => update('inlineSuggestions', value)} />
                <Toggle label="Tab autocomplete" value={state.tabAutocomplete} onChange={(value) => update('tabAutocomplete', value)} />
                <Select label="Autocomplete model" value={state.autocompleteModel} options={models} onChange={(value) => update('autocompleteModel', value)} />
                <Number label="Suggestion delay" value={state.autocompleteDelay} suffix="ms" min={0} max={2000} onChange={(value) => update('autocompleteDelay', value)} />
              </ControlSection>
              <ControlSection title="Git / VCS">
                <Toggle label="VCS review panel" value={state.gitPanel} onChange={(value) => update('gitPanel', value)} />
                <Toggle label="Auto-stage agent changes" value={state.autoStageAgentChanges} onChange={(value) => update('autoStageAgentChanges', value)} />
                <Toggle label="Generated commit messages" value={state.generatedCommitMessages} onChange={(value) => update('generatedCommitMessages', value)} />
                <Toggle label="Branch diffs" value={state.branchDiffs} onChange={(value) => update('branchDiffs', value)} />
                <Toggle label="Conflict resolver" value={state.conflictResolver} onChange={(value) => update('conflictResolver', value)} />
              </ControlSection>
              <ControlSection title="Task verification & artifacts">
                <Toggle label="Verify on completion" value={state.verifyOnCompletion} onChange={(value) => update('verifyOnCompletion', value)} />
                <Text label="Verification command" value={state.verificationCommand} onChange={(value) => update('verificationCommand', value)} placeholder="Test/verify command…" />
                <Toggle label="Artifact preview" value={state.artifactPreview} onChange={(value) => update('artifactPreview', value)} />
                <Toggle label="Auto-attach artifacts" value={state.autoAttachArtifacts} onChange={(value) => update('autoAttachArtifacts', value)} />
              </ControlSection>
              <ControlSection title="Long-running goals">
                <Toggle label="Retain long-lived goals" value={state.goalRetention} onChange={(value) => update('goalRetention', value)} />
                <Toggle label="Steer agent while running" value={state.steeringWhileRunning} onChange={(value) => update('steeringWhileRunning', value)} />
                <Number label="Loop/check interval" value={state.loopCheckInterval} suffix="seconds" min={5} max={3600} onChange={(value) => update('loopCheckInterval', value)} />
              </ControlSection>
              <ControlSection title="Remote control">
                <Toggle label="Remote control" value={state.remoteControl} onChange={(value) => update('remoteControl', value)} />
                <Text label="Machine nickname" value={state.remoteNickname} onChange={(value) => update('remoteNickname', value)} />
              </ControlSection>
              <InfoCallout icon="code" title="Verification remains explicit" text="Editor, Git, task verification, artifacts and remote control are presentation controls. Actual writes, commands, tests and remote sessions stay behind runtime-owned contracts." />
            </ControlPage>
          )}

          {section === 'interface' && (
            <ControlPage title="Interface & Performance" description="Visual customization without trading away responsiveness. Rendering is scoped so only the current configuration domain is mounted.">
              <ControlSection title="Appearance">
                <Select label="Theme" value={state.theme} options={themes} onChange={(value) => update('theme', value)} />
                <Select label="Density" value={state.density} options={densities} onChange={(value) => update('density', value)} />
                <Toggle label="Reduced motion" value={state.reducedMotion} onChange={(value) => update('reducedMotion', value)} />
                <Toggle label="Compact sidebar" value={state.compactSidebar} onChange={(value) => update('compactSidebar', value)} />
              </ControlSection>
              <ControlSection title="Workspace layout">
                <Toggle label="Split terminals" value={state.splitTerminal} onChange={(value) => update('splitTerminal', value)} />
                <Toggle label="Hover previews" value={state.hoverPreviews} onChange={(value) => update('hoverPreviews', value)} />
                <Toggle label="Review diffs inline" value={state.showDiffReview} onChange={(value) => update('showDiffReview', value)} />
                <Text label="Status line fields" value={state.statusFields} onChange={(value) => update('statusFields', value)} />
                <Select label="Platform display override" value={state.platformDisplayOverride} options={['Inherit global', 'CLI', 'Desktop', 'Telegram', 'Discord', 'Slack']} onChange={(value) => update('platformDisplayOverride', value)} />
              </ControlSection>
              <ControlSection title="Performance contract">
                <InfoLine title="Lazy surfaces" detail="Heavy feature modules should load on navigation, not during shell startup." />
                <InfoLine title="Stable shell" detail="The shell keeps one layout tree and swaps the selected workspace surface." />
                <InfoLine title="Long lists" detail="Conversation, artifact and tool-heavy views should virtualize or page their visible rows." />
                <InfoLine title="Reduced motion" detail="Global motion preference avoids unnecessary compositor work and respects accessibility." />
              </ControlSection>
            </ControlPage>
          )}

          {section === 'data' && (
            <ControlPage title="Data & Usage" description="Privacy, cost and local-state controls stay visible without exposing secrets.">
              <ControlSection title="Privacy">
                <Toggle label="Privacy mode" value={state.privacyMode} onChange={(value) => update('privacyMode', value)} />
                <Toggle label="Telemetry" value={state.telemetry} onChange={(value) => update('telemetry', value)} />
                <Toggle label="Cost tracking" value={state.costTracking} onChange={(value) => update('costTracking', value)} />
                <Range label="Usage warning threshold" value={state.usageLimit} description="Visual threshold for quota/usage warnings." onChange={(value) => update('usageLimit', value)} />
              </ControlSection>
              <ControlSection title="Local state">
                <InfoLine title="Preferences" detail="Stored locally as presentation state until a runtime settings contract is connected." />
                <InfoLine title="Secrets" detail="API keys, OAuth credentials, passwords and bot tokens are never persisted by this React control plane." />
                <InfoLine title="Configuration snapshots" detail="Portable exports contain structure, not credentials." />
              </ControlSection>
              <InfoCallout icon="database" title="Runtime boundary" text="Usage data, provider health, credentials and security enforcement remain runtime-owned. The frontend provides the complete management surface without inventing a backend contract." />
            </ControlPage>
          )}
        </main>
      </div>
    </section>
  )
}

function LazyPanel({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="settings-lazy-panel"><span className="surface-loading__spinner" /><span>Loading control surface…</span></div>}>{children}</Suspense>
}

function ControlPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="control-page">
      <header className="control-page__header">
        <div><span className="eyebrow">Settings domain</span><h2>{title}</h2><p>{description}</p></div>
        <span className="control-page__icon"><Icon name="sliders" size={17} /></span>
      </header>
      {children}
    </div>
  )
}

function ControlSection({ title, detail, children }: { title: string; detail?: string; children: ReactNode }) {
  return (
    <section className="control-card">
      <header className="control-card__header"><div><strong>{title}</strong>{detail && <small>{detail}</small>}</div><Icon name="settings" size={14} /></header>
      <div className="control-card__body">{children}</div>
    </section>
  )
}

function StatusCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: IconName }) {
  return <div className="control-status-card"><span className="control-status-card__icon"><Icon name={icon} size={15} /></span><span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span></div>
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="control-row control-row--toggle">
      <div><strong>{label}</strong><small>{value ? 'Enabled' : 'Disabled'}</small></div>
      <button type="button" className={value ? 'switch switch--on' : 'switch'} role="switch" aria-checked={value} onClick={() => onChange(!value)}><span /></button>
    </div>
  )
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="control-row control-row--field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>
}

function Text({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return <label className="control-row control-row--field"><span>{label}</span><input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>
}

function Number({ label, value, suffix, min, max, onChange }: { label: string; value: number; suffix: string; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="control-row control-row--field"><span>{label}</span><span className="control-number"><input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value))))} /><small>{suffix}</small></span></label>
}

function Range({ label, value, description, onChange }: { label: string; value: number; description: string; onChange: (value: number) => void }) {
  return <div className="control-range"><div><strong>{label}</strong><small>{description}</small></div><div className="control-range__input"><input type="range" min={0} max={100} value={value} onChange={(event) => onChange(Number(event.target.value))} /><output>{value}</output></div></div>
}

function ModePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="mode-picker">{modes.map((mode) => <button type="button" key={mode} className={value === mode ? 'mode-picker__item mode-picker__item--active' : 'mode-picker__item'} onClick={() => onChange(mode)}><Icon name={mode === 'Ask' ? 'search' : mode === 'Review' ? 'shield' : mode === 'Plan' ? 'check' as IconName : mode === 'Custom' ? 'spark' : 'bot'} size={14} />{mode}</button>)}</div>
}

function InfoLine({ title, detail }: { title: string; detail: string }) {
  return <div className="control-info-line"><span><Icon name="info" size={14} /></span><div><strong>{title}</strong><small>{detail}</small></div></div>
}

function InfoCallout({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return <div className="control-info-callout"><span><Icon name={icon} size={15} /></span><div><strong>{title}</strong><small>{text}</small></div></div>
}
