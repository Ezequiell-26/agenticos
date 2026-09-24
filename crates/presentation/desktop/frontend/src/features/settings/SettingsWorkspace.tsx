import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Icon, { type IconName } from '../../components/Icon'
import { readUiPreferences, updateUiPreferences } from '../../services/ui-preferences'
import type { RailMode } from '../../navigation'

const EffectivePermissionMatrix = lazy(() => import('../security/EffectivePermissionMatrix'))
const KeymapEditor = lazy(() => import('./KeymapEditor'))
const ThemeStudio = lazy(() => import('./ThemeStudio'))
const WorkspacePresetPicker = lazy(() => import('./WorkspacePresetPicker'))
const SetupChecklist = lazy(() => import('./SetupChecklist'))
const SettingsControlCenter = lazy(() => import('./SettingsControlCenter'))

interface SettingsWorkspaceProps {
  notify: (message: string) => void
  onClose?: () => void
  onNavigate?: (mode: RailMode) => void
  initialSection?: string
}

interface WorkspaceSection {
  id: string
  label: string
  icon: IconName
  detail: string
  children?: Array<{ id: string; label: string; detail: string }>
}

/* Presentation-only settings shell. Values persist locally and never invent runtime authority. */
const sections: WorkspaceSection[] = [
  {
    id: 'model',
    label: 'Model',
    icon: 'layers',
    detail: 'Applies to new sessions. Use the model picker in the composer to hot-swap the active chat.',
    children: [
      { id: 'model/main', label: 'Main model', detail: 'Main chat model, reasoning effort and context override.' },
      { id: 'model/fallback', label: 'Fallback models', detail: 'Ordered fallback chain used when the main model fails.' },
      { id: 'model/auxiliary', label: 'Auxiliary models', detail: 'Specialized models for vision, titles, compression and approvals.' },
      { id: 'model/moa', label: 'Mixture of Agents', detail: 'Combine several models on one task and merge their answers.' },
    ],
  },
  { id: 'chat', label: 'Chat', icon: 'message', detail: 'Conversation behavior, instructions and composer defaults.' },
  { id: 'appearance', label: 'Appearance', icon: 'spark', detail: 'Themes, accents, density and workspace presets.' },
  { id: 'workspace', label: 'Workspace', icon: 'layout', detail: 'Project paths, startup view and setup checklist.' },
  { id: 'safety', label: 'Safety', icon: 'shield', detail: 'Approvals, permissions and effective agent boundaries.' },
  { id: 'browser', label: 'Browser', icon: 'globe', detail: 'Browser tool backend, sessions and recording.' },
  { id: 'passwords', label: 'Passwords & Logins', icon: 'lock', detail: 'Stored logins handled through the credential boundary.' },
  { id: 'memory', label: 'Memory & Context', icon: 'database', detail: 'Persistent memory, recall and context budgeting.' },
  { id: 'voice', label: 'Voice', icon: 'mic', detail: 'Voice input, speech output and wake presence.' },
  { id: 'advanced', label: 'Advanced', icon: 'tool', detail: 'Keymaps, scope resolution and the full control center.' },
  { id: 'notifications', label: 'Notifications', icon: 'bell', detail: 'Delivery position, push behavior and quiet state.' },
  { id: 'billing', label: 'Billing', icon: 'activity', detail: 'Plan and usage presentation; charges stay with the provider.' },
  { id: 'providers', label: 'Providers', icon: 'network', detail: 'Connections, health and model catalogs per provider.' },
  { id: 'gateways', label: 'Gateways', icon: 'cloud', detail: 'Channel gateways and delivery endpoints.' },
]

function flattenTarget(sectionId: string): { section: WorkspaceSection; child?: { id: string; label: string; detail: string } } {
  const [groupId, childId] = sectionId.split('/')
  const section = sections.find((item) => item.id === groupId) ?? sections[0]
  const child = section.children?.find((item) => item.id === childId)
  return { section, child }
}

export default function SettingsWorkspace({ notify, onClose, onNavigate, initialSection = 'model/main' }: SettingsWorkspaceProps) {
  const [activeId, setActiveId] = useState(initialSection)
  const [query, setQuery] = useState('')
  const [modelGroupOpen, setModelGroupOpen] = useState(true)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        event.stopPropagation()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  const filteredSections = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return sections
    return sections
      .map((section) => {
        const matchesGroup = section.label.toLowerCase().includes(term)
        if (!section.children) return matchesGroup ? section : null
        const children = matchesGroup ? section.children : section.children.filter((child) => child.label.toLowerCase().includes(term))
        return children.length ? { ...section, children } : null
      })
      .filter((entry): entry is WorkspaceSection => entry !== null)
  }, [query])

  const { section, child } = flattenTarget(activeId)
  const crumb = child ? [section.label, child.label] : [section.label]

  function select(target: string) {
    setActiveId(target)
    const group = target.split('/')[0]
    if (group === 'model') setModelGroupOpen(true)
  }

  return (
    <section className="settings-workspace" aria-label="Settings">
      <div className="settings-workspace__searchbar">
        <label className="settings-workspace__search">
          <Icon name="search" size={13} />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search settings"
          />
          <kbd>Ctrl</kbd><kbd>K</kbd>
        </label>
      </div>

      <div className="settings-workspace__body">
        <nav className="settings-workspace__nav" aria-label="Settings sections">
          {filteredSections.map((item) => (
            <div key={item.id} className="settings-workspace__group">
              {item.children ? (
                <>
                  <button
                    type="button"
                    className={'sw-nav-row sw-nav-row--group' + (item.id === section.id ? ' sw-nav-row--open' : '')}
                    aria-expanded={item.id === 'model' ? modelGroupOpen : false}
                    onClick={() => {
                      if (item.id === 'model') setModelGroupOpen((open) => !open)
                      select(item.children![0].id)
                    }}
                  >
                    <Icon name={item.icon} size={14} />
                    <span>{item.label}</span>
                    <Icon name="chevron-right" size={12} className={item.id === 'model' && modelGroupOpen ? 'sw-chevron sw-chevron--open' : 'sw-chevron'} />
                  </button>
                  {item.id === 'model' && modelGroupOpen && item.children.map((childItem) => (
                    <button
                      key={childItem.id}
                      type="button"
                      className={'sw-nav-row sw-nav-row--child' + (activeId === childItem.id ? ' sw-nav-row--active' : '')}
                      onClick={() => select(childItem.id)}
                    >
                      <span>{childItem.label}</span>
                    </button>
                  ))}
                </>
              ) : (
                <button
                  type="button"
                  className={'sw-nav-row' + (activeId === item.id ? ' sw-nav-row--active' : '')}
                  onClick={() => select(item.id)}
                >
                  <Icon name={item.icon} size={14} />
                  <span>{item.label}</span>
                  <Icon name="chevron-right" size={12} className="sw-chevron" />
                </button>
              )}
            </div>
          ))}
        </nav>

        <div className="settings-workspace__content">
          <header className="settings-workspace__contenthead">
            <nav className="sw-crumbs" aria-label="Settings breadcrumb">
              <span>Settings</span>
              {crumb.map((part) => <span key={part} className="sw-crumbs__part"><Icon name="chevron-right" size={11} />{part}</span>)}
            </nav>
            {onClose && (
              <button type="button" className="icon-button" aria-label="Close settings" title="Close settings" onClick={onClose}>
                <Icon name="x" size={14} />
              </button>
            )}
          </header>
          <div className="settings-workspace__panel">
            <SettingsPanel target={activeId} notify={notify} onNavigate={onNavigate} />
          </div>
        </div>
      </div>
    </section>
  )
}

function SettingsPanel({ target, notify, onNavigate }: { target: string; notify: (message: string) => void; onNavigate?: (mode: RailMode) => void }) {
  switch (target) {
    case 'model/main': return <MainModelPanel notify={notify} />
    case 'model/fallback': return <FallbackPanel notify={notify} />
    case 'model/auxiliary': return <AuxiliaryPanel notify={notify} />
    case 'model/moa': return <MixturePanel notify={notify} />
    case 'chat': return <ChatPanel notify={notify} />
    case 'appearance': return (
      <div className="sw-stack">
        <ThemeStudio />
        <WorkspacePresetPicker />
      </div>
    )
    case 'workspace': return (
      <div className="sw-stack">
        <SetupChecklist />
        <WorkspacePresetPicker />
      </div>
    )
    case 'safety': return <SafetyPanel notify={notify} />
    case 'browser': return <BrowserPanel notify={notify} />
    case 'passwords': return (
      <SettingsBlock title="Passwords & Logins" description="Logins are stored by the runtime credential boundary; the UI never reads secrets.">
        <Row label="Credential vault" description="Connection metadata without exposing secrets to the UI.">
          <button type="button" className="sw-button" onClick={() => onNavigate?.('credentials')}>Open credentials</button>
        </Row>
        <Row label="Browser logins" description="Managed per browser session by the runtime.">
          <span className="sw-static">Runtime managed</span>
        </Row>
      </SettingsBlock>
    )
    case 'memory': return <MemoryPanel notify={notify} />
    case 'voice': return <VoicePanel notify={notify} />
    case 'advanced': return <AdvancedPanel />
    case 'notifications': return <NotificationsPanel />
    case 'billing': return (
      <SettingsBlock title="Billing" description="Plan, quota and spend presentation. Charges are settled by the connected providers.">
        <Row label="Plan" description="Presentation preview of the active workspace plan."><span className="sw-static">Preview</span></Row>
        <Row label="Usage limit" description="Soft workspace-level stop for spend tracking."><span className="sw-static">Not set</span></Row>
        <Row label="Open usage center" description="Tokens, requests and provider consumption.">
          <button type="button" className="sw-button" onClick={() => onNavigate?.('usage')}>Open usage</button>
        </Row>
      </SettingsBlock>
    )
    case 'providers': return (
      <SettingsBlock title="Providers" description="Connections, health, model catalogs and failover behavior per provider.">
        <Row label="Provider studio" description="Routes, catalogs, quotas and resilience evidence.">
          <button type="button" className="sw-button" onClick={() => onNavigate?.('providers')}>Open providers</button>
        </Row>
        <Row label="Model control center" description="Provider, model, routing and capability plane.">
          <button type="button" className="sw-button" onClick={() => onNavigate?.('model-control')}>Open models</button>
        </Row>
      </SettingsBlock>
    )
    case 'gateways': return (
      <SettingsBlock title="Gateways" description="Channel gateways, delivery endpoints and connection policy.">
        <Row label="Channels & Gateway" description="Messaging surfaces and gateway connections.">
          <button type="button" className="sw-button" onClick={() => onNavigate?.('channels')}>Open channels</button>
        </Row>
        <Row label="Webhooks & Events" description="Inbound triggers and endpoint policy.">
          <button type="button" className="sw-button" onClick={() => onNavigate?.('webhooks')}>Open webhooks</button>
        </Row>
      </SettingsBlock>
    )
    default: return null
  }
}

function MainModelPanel({ notify }: { notify: (message: string) => void }) {
  const [provider, setProvider] = useState('freellmapi')
  const [model, setModel] = useState('auto')
  const [reasoning, setReasoning] = useState('Ultra')
  const [contextOverride, setContextOverride] = useState(0)

  return (
    <SettingsBlock title="Main model" description="Applies to new sessions. Use the model picker in the composer to hot-swap the active chat.">
      <Row label="Provider" description="Upstream connection used for the main chat model.">
        <select className="sw-select" value={provider} onChange={(event) => setProvider(event.target.value)} aria-label="Main provider">
          <option>freellmapi</option><option>openai</option><option>anthropic</option><option>google</option><option>local</option>
        </select>
      </Row>
      <Row label="Model" description="Model id resolved by the provider catalog.">
        <select className="sw-select" value={model} onChange={(event) => setModel(event.target.value)} aria-label="Main model">
          <option>auto</option><option>flagship</option><option>fast</option><option>reasoning</option><option>custom…</option>
        </select>
      </Row>
      <div className="sw-actions">
        <button type="button" className="sw-button sw-button--primary" onClick={() => notify(`Main model applied: ${provider} / ${model}`)}>Apply</button>
        <div className="sw-inline">
          <button type="button" className="sw-chip" onClick={() => notify('Reasoning defaults restored')}>Defaults</button>
          <label className="sw-inline__label" htmlFor="sw-reasoning">Reasoning</label>
          <select id="sw-reasoning" className="sw-select sw-select--compact" value={reasoning} onChange={(event) => setReasoning(event.target.value)}>
            <option>Off</option><option>Medium</option><option>High</option><option>Ultra</option>
          </select>
        </div>
      </div>
      <Row
        label="Main model context window (override)"
        description="Overrides the detected context window of the MAIN chat model only (tokens). Leave at 0 to use the selected model's detected value. Does not affect auxiliary/MoA models."
      >
        <input
          className="sw-input sw-input--number"
          type="number"
          min={0}
          value={contextOverride}
          aria-label="Main model context window override"
          onChange={(event) => setContextOverride(Number(event.target.value) || 0)}
        />
      </Row>
    </SettingsBlock>
  )
}

function FallbackPanel({ notify }: { notify: (message: string) => void }) {
  const [enabled, setEnabled] = useState(true)
  const [chain, setChain] = useState('flagship → fast → local')
  return (
    <SettingsBlock title="Fallback models" description="Ordered chain tried when the main model errors, throttles or times out.">
      <Row label="Failover" description="Enable automatic fallback for chat and tool calls.">
        <Switch checked={enabled} label="Failover" onChange={() => { setEnabled((value) => !value); notify(enabled ? 'Failover disabled' : 'Failover enabled') }} />
      </Row>
      <Row label="Fallback chain" description="Comma or arrow separated model ids, tried in order.">
        <input className="sw-input" value={chain} onChange={(event) => setChain(event.target.value)} aria-label="Fallback chain" />
      </Row>
      <div className="sw-actions"><button type="button" className="sw-button sw-button--primary" onClick={() => notify('Fallback chain applied')}>Apply</button></div>
    </SettingsBlock>
  )
}

function AuxiliaryPanel({ notify }: { notify: (message: string) => void }) {
  const [aux, setAux] = useState({ vision: 'auto', title: 'fast', compression: 'fast', approval: 'reasoning', browser: 'auto', image: 'auto' })
  const rows: Array<[keyof typeof aux, string, string, string[]]> = [
    ['vision', 'Vision model', 'Screenshots and image understanding.', ['auto', 'fast', 'flagship']],
    ['title', 'Title model', 'Generates conversation titles.', ['fast', 'flagship']],
    ['compression', 'Compression model', 'Summarizes long context when the budget is tight.', ['fast', 'reasoning']],
    ['approval', 'Approval model', 'Pre-screens sensitive actions against policy.', ['reasoning', 'flagship']],
    ['browser', 'Browser model', 'Page reading and DOM inspection summaries.', ['auto', 'fast']],
    ['image', 'Image model', 'Image generation and editing.', ['auto']],
  ]
  return (
    <SettingsBlock title="Auxiliary models" description="Specialized models for support tasks; the main chat model stays unchanged.">
      {rows.map(([key, label, description, options]) => (
        <Row key={key} label={label} description={description}>
          <select className="sw-select" value={aux[key]} aria-label={label} onChange={(event) => setAux((current) => ({ ...current, [key]: event.target.value }))}>
            {options.map((option) => <option key={option}>{option}</option>)}
          </select>
        </Row>
      ))}
      <div className="sw-actions"><button type="button" className="sw-button sw-button--primary" onClick={() => notify('Auxiliary models applied')}>Apply</button></div>
    </SettingsBlock>
  )
}

function MixturePanel({ notify }: { notify: (message: string) => void }) {
  const [enabled, setEnabled] = useState(false)
  const [strategy, setStrategy] = useState('balanced')
  return (
    <SettingsBlock title="Mixture of Agents" description="Run several models on one task and merge or compare their answers.">
      <Row label="Mixture of Agents" description="Enable multi-model answers for the composer.">
        <Switch checked={enabled} label="Mixture of Agents" onChange={() => { setEnabled((value) => !value); notify(enabled ? 'Mixture of Agents disabled' : 'Mixture of Agents enabled') }} />
      </Row>
      <Row label="Merge strategy" description="How multiple answers are combined into one reply.">
        <select className="sw-select" value={strategy} disabled={!enabled} aria-label="Merge strategy" onChange={(event) => setStrategy(event.target.value)}>
          <option>balanced</option><option>quality</option><option>speed</option><option>compare only</option>
        </select>
      </Row>
    </SettingsBlock>
  )
}

function SafetyPanel({ notify }: { notify: (message: string) => void }) {
  const [executionMode, setExecutionMode] = useState('Ask every time')
  const [workspaceOnly, setWorkspaceOnly] = useState(true)
  const [terminalSandbox, setTerminalSandbox] = useState(true)
  const [guardrails, setGuardrails] = useState(true)
  const [networkAccess, setNetworkAccess] = useState('Allowlist domains')

  return (
    <div className="sw-stack">
      <SettingsBlock title="Safety" description="Approval policy and effective agent boundaries. Changes preview instantly below.">
        <Row label="Execution mode" description="When the agent must ask before running commands.">
          <select className="sw-select" value={executionMode} aria-label="Execution mode" onChange={(event) => setExecutionMode(event.target.value)}>
            <option>Ask every time</option><option>Auto-run safe commands</option><option>Full access</option>
          </select>
        </Row>
        <Row label="Workspace only" description="Restrict file tools to the current workspace."><Switch checked={workspaceOnly} label="Workspace only" onChange={() => setWorkspaceOnly((value) => !value)} /></Row>
        <Row label="Terminal sandbox" description="Run commands inside the sandboxed shell."><Switch checked={terminalSandbox} label="Terminal sandbox" onChange={() => setTerminalSandbox((value) => !value)} /></Row>
        <Row label="Guardrails" description="Keep verification gates and policy checks active."><Switch checked={guardrails} label="Guardrails" onChange={() => setGuardrails((value) => !value)} /></Row>
        <Row label="Network access" description="Outbound reachability for browser and tools.">
          <select className="sw-select" value={networkAccess} aria-label="Network access" onChange={(event) => setNetworkAccess(event.target.value)}>
            <option>Allowlist domains</option><option>Ask per request</option><option>Block all</option>
          </select>
        </Row>
        <div className="sw-actions"><button type="button" className="sw-button sw-button--primary" onClick={() => notify('Safety policy applied')}>Apply</button></div>
      </SettingsBlock>
      <LazyPanel label="Effective permission matrix">
        <EffectivePermissionMatrix
          executionMode={executionMode}
          workspaceOnly={workspaceOnly}
          networkAccess={networkAccess}
          terminalSandbox={terminalSandbox}
          guardrails={guardrails}
        />
      </LazyPanel>
    </div>
  )
}

function ChatPanel({ notify }: { notify: (message: string) => void }) {
  const [instructions, setInstructions] = useState('')
  const [autoRun, setAutoRun] = useState(true)
  const [autoFix, setAutoFix] = useState(true)
  const [autoApply, setAutoApply] = useState(false)
  return (
    <SettingsBlock title="Chat" description="Conversation behavior, instructions and composer defaults.">
      <Row label="Custom instructions" description="Standing guidance prepended to every new session.">
        <textarea
          className="sw-input sw-input--area"
          rows={3}
          value={instructions}
          placeholder="e.g. Prefer safe edits; verify before applying."
          aria-label="Custom instructions"
          onChange={(event) => setInstructions(event.target.value)}
        />
      </Row>
      <Row label="Auto-run commands" description="Run generated shell commands without asking each time."><Switch checked={autoRun} label="Auto-run commands" onChange={() => setAutoRun((value) => !value)} /></Row>
      <Row label="Auto-fix errors" description="Let the agent retry and repair failed steps."><Switch checked={autoFix} label="Auto-fix errors" onChange={() => setAutoFix((value) => !value)} /></Row>
      <Row label="Auto-apply changes" description="Apply file edits without a confirmation step."><Switch checked={autoApply} label="Auto-apply changes" onChange={() => setAutoApply((value) => !value)} /></Row>
      <div className="sw-actions"><button type="button" className="sw-button sw-button--primary" onClick={() => notify('Chat settings applied')}>Apply</button></div>
    </SettingsBlock>
  )
}

function BrowserPanel({ notify }: { notify: (message: string) => void }) {
  const [enabled, setEnabled] = useState(true)
  const [backend, setBackend] = useState('managed')
  const [recording, setRecording] = useState(true)
  return (
    <SettingsBlock title="Browser" description="Browser tool backend, isolated sessions and evidence recording.">
      <Row label="Browser tool" description="Allow agents to navigate, inspect and fill pages."><Switch checked={enabled} label="Browser tool" onChange={() => setEnabled((value) => !value)} /></Row>
      <Row label="Backend" description="Execution backend selected by the runtime.">
        <select className="sw-select" value={backend} onChange={(event) => setBackend(event.target.value)} aria-label="Browser backend">
          <option>managed</option><option>system chrome</option><option>isolated preview</option>
        </select>
      </Row>
      <Row label="Session recording" description="Record navigation and actions as verifiable evidence."><Switch checked={recording} label="Session recording" onChange={() => setRecording((value) => !value)} /></Row>
      <div className="sw-actions"><button type="button" className="sw-button sw-button--primary" onClick={() => notify('Browser settings applied')}>Apply</button></div>
    </SettingsBlock>
  )
}

function MemoryPanel({ notify }: { notify: (message: string) => void }) {
  const [memory, setMemory] = useState(true)
  const [recall, setRecall] = useState(true)
  const [compression, setCompression] = useState(true)
  const [budget, setBudget] = useState(128)
  return (
    <SettingsBlock title="Memory & Context" description="Persistent memory, cross-session recall and the context budget.">
      <Row label="Persistent memory" description="Remember useful facts across sessions."><Switch checked={memory} label="Persistent memory" onChange={() => setMemory((value) => !value)} /></Row>
      <Row label="Session recall" description="Surface relevant earlier sessions in chat."><Switch checked={recall} label="Session recall" onChange={() => setRecall((value) => !value)} /></Row>
      <Row label="Auto compression" description="Compress history when approaching the token budget."><Switch checked={compression} label="Auto compression" onChange={() => setCompression((value) => !value)} /></Row>
      <Row label="Context budget (k tokens)" description="Maximum context handed to the model per run.">
        <input className="sw-input sw-input--number" type="number" min={8} max={1000} value={budget} aria-label="Context budget" onChange={(event) => setBudget(Number(event.target.value) || 0)} />
      </Row>
      <div className="sw-actions"><button type="button" className="sw-button sw-button--primary" onClick={() => notify('Memory and context applied')}>Apply</button></div>
    </SettingsBlock>
  )
}

function VoicePanel({ notify }: { notify: (message: string) => void }) {
  const [input, setInput] = useState(true)
  const [tts, setTts] = useState(false)
  return (
    <SettingsBlock title="Voice" description="Voice input, speech output and hands-free presence.">
      <Row label="Voice input" description="Dictate into the composer with the microphone button."><Switch checked={input} label="Voice input" onChange={() => setInput((value) => !value)} /></Row>
      <Row label="Speech output" description="Read assistant replies aloud."><Switch checked={tts} label="Speech output" onChange={() => setTts((value) => !value)} /></Row>
      <Row label="Wake word" description="Hands-free activation and microphone presence.">
        <button type="button" className="sw-button" onClick={() => notify('Wake word presence is configured in the Voice & Media surface')}>Open presence studio</button>
      </Row>
    </SettingsBlock>
  )
}

function AdvancedPanel() {
  const [controlCenterOpen, setControlCenterOpen] = useState(false)
  return (
    <div className="sw-stack">
      <SettingsBlock title="Advanced" description="Keymaps, scope resolution and the full control center.">
        <Row label="Keymap editor" description="Inspect and rebind workspace shortcuts.">
          <span className="sw-static"><Icon name="command" size={12} /> below</span>
        </Row>
        <Row label="Unified control center" description="The full 245-control deep settings surface.">
          <button type="button" className="sw-button" onClick={() => setControlCenterOpen((value) => !value)}>{controlCenterOpen ? 'Hide control center' : 'Open control center'}</button>
        </Row>
      </SettingsBlock>
      <LazyPanel label="Keymap editor"><KeymapEditor /></LazyPanel>
      {controlCenterOpen && <LazyPanel label="Unified control center"><SettingsControlCenter notify={() => { /* preview surface */ }} /></LazyPanel>}
    </div>
  )
}

function NotificationsPanel() {
  const [preferences, setPreferences] = useState(() => readUiPreferences())
  return (
    <SettingsBlock title="Notifications" description="Delivery position and push behavior for workspace alerts.">
      <Row label="Position" description="Where toast notifications appear on screen.">
        <select
          className="sw-select"
          value={preferences.notificationPosition}
          aria-label="Notification position"
          onChange={(event) => setPreferences(updateUiPreferences({ notificationPosition: event.target.value }))}
        >
          <option value="top-right">top right</option>
          <option value="top-left">top left</option>
          <option value="bottom-right">bottom right</option>
          <option value="bottom-left">bottom left</option>
        </select>
      </Row>
      <Row label="Desktop notifications" description="Requires the desktop runtime notification permission."><span className="sw-static">Runtime gated</span></Row>
    </SettingsBlock>
  )
}

function SettingsBlock({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="sw-block">
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="sw-block__rows">{children}</div>
    </div>
  )
}

function Row({ label, description, children }: { label: string; description: string; children: ReactNode }) {
  return (
    <div className="sw-row">
      <div className="sw-row__copy"><strong>{label}</strong><small>{description}</small></div>
      <div className="sw-row__control">{children}</div>
    </div>
  )
}

function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={checked ? 'sw-switch sw-switch--on' : 'sw-switch'} onClick={onChange}>
      <span aria-hidden="true" />
    </button>
  )
}

function LazyPanel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Suspense fallback={<div className="settings-lazy-panel"><span className="surface-loading__spinner" /><span>Loading {label}…</span></div>}>
      {children}
    </Suspense>
  )
}
