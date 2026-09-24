import { useEffect, useMemo, useState } from 'react'
import { navigationItems, type RailMode } from '../../navigation'
import Icon from '../../components/Icon'
import { MetricCard, Panel, Tag } from './PlatformPrimitives'
import RuntimeProbePanel from './RuntimeProbePanel'
import './FeatureWorkbench.css'

type FeatureWorkbenchProps = {
  mode: RailMode
  onAction: (message: string) => void
}

type FeatureConfig = {
  eyebrow: string
  purpose: string
  actions: string[]
  metrics: [string, string, string][]
  items: [string, string, string, string][]
  capabilities: string[]
  shortcuts: string[]
}

const configs: Partial<Record<RailMode, FeatureConfig>> = {
  overview: {
    eyebrow: 'Workspace overview',
    purpose: 'Unified launch surface for project health, active execution, attention items and next safe actions.',
    actions: ['New task', 'Run verification', 'Open command palette'],
    metrics: [['Workspace health', 'Stable', 'Presentation state'], ['Active work', '6', '3 agents · 3 tasks'], ['Attention', '3', '2 warnings · 1 approval'], ['Readiness', '92%', 'UI contracts covered']],
    items: [['Workspace brief', 'Project context, branch and active policy', 'Ready', 'Overview'], ['Agent activity', 'Current runs and delegated work', 'Live', 'Operations'], ['Quality gate', 'Frontend checks and evidence', 'Pending', 'Quality'], ['Next action', 'Recommended safe continuation', 'Ready', 'Guidance']],
    capabilities: ['Context-aware dashboard', 'Action routing', 'Attention inbox', 'Readiness tracking'],
    shortcuts: ['⌘K Command palette', '⌘⇧F Global search', '⌘⇧Enter Focus mode'],
  },
  terminal: {
    eyebrow: 'Developer workspace',
    purpose: 'Integrated shell surface with history, sessions, environment context and safe command presentation.',
    actions: ['New shell', 'Split terminal', 'Clear history'],
    metrics: [['Shell sessions', '3', '1 focused'], ['Environment', 'Local', 'Workspace'], ['History', '128', 'Commands indexed'], ['Safety', 'Guarded', 'Execution policy']],
    items: [['zsh / PowerShell', 'Primary interactive shell', 'Ready', 'Local'], ['Task shell', 'Bound to active task', 'Idle', 'Task execution'], ['Agent shell', 'Isolated agent workspace', 'Idle', 'Sandbox'], ['Command history', 'Recent commands and outcomes', 'Indexed', 'History']],
    capabilities: ['Multi-session terminal UI', 'Environment selector', 'Command history', 'Output inspection'],
    shortcuts: ['Ctrl+J Dock', 'Enter Run command', 'Ctrl+L Clear prompt'],
  },
  evaluations: {
    eyebrow: 'Evaluation plane',
    purpose: 'Design repeatable suites for prompts, agents, tools and models with comparable evidence.',
    actions: ['New suite', 'Run selected', 'Compare runs'],
    metrics: [['Suites', '14', '4 active'], ['Cases', '248', '32 new'], ['Pass rate', '94.8%', 'Last 30 runs'], ['Drift', 'Low', 'Model baseline']],
    items: [['Agent regression', 'Core coding task battery', 'Ready', 'Suite'], ['Tool reliability', 'Tool selection and recovery', 'Ready', 'Suite'], ['Prompt fidelity', 'Instruction hierarchy checks', 'Draft', 'Suite'], ['Provider compare', 'Same workload across providers', 'Queued', 'Suite']],
    capabilities: ['Scenario builder', 'Baseline snapshots', 'Run comparison', 'Evidence export'],
    shortcuts: ['R Run suite', 'C Compare', 'E Export evidence'],
  },
  versions: {
    eyebrow: 'Configuration lifecycle',
    purpose: 'Track immutable agent configurations, compare versions and stage safe rollbacks.',
    actions: ['Create version', 'Compare', 'Rollback preview'],
    metrics: [['Current version', 'v4', 'Released locally'], ['Versions', '18', '7 recent'], ['Changes', '12', 'Since v3'], ['Rollback', 'Ready', '1 checkpoint']],
    items: [['AgenticOS Core v4', 'Current workspace configuration', 'Current', 'Version'], ['AgenticOS Core v3', 'Previous verified configuration', 'Stable', 'Version'], ['Context v2', 'Context policy revision', 'Stable', 'Component'], ['Tools v7', 'Tool policy revision', 'Stable', 'Component']],
    capabilities: ['Immutable snapshots', 'Diff inspection', 'Restore preview', 'Release labels'],
    shortcuts: ['V Version compare', 'D Open diff', 'R Restore preview'],
  },
  audit: {
    eyebrow: 'Evidence plane',
    purpose: 'Chronological audit evidence for agent decisions, tool calls, policy checks and workspace mutations.',
    actions: ['Filter events', 'Export evidence', 'Pin event'],
    metrics: [['Events', '18.4k', 'This workspace'], ['Verified', '99.2%', 'Provenance coverage'], ['Alerts', '7', 'Needs review'], ['Retention', '30d', 'Configured']],
    items: [['Policy check', 'Agent requested guarded mutation', 'Verified', 'Governance'], ['Tool call', 'Filesystem inspection completed', 'Verified', 'Execution'], ['Approval', 'Human gate resolved', 'Approved', 'Governance'], ['Artifact', 'Evidence package generated', 'Verified', 'Artifacts']],
    capabilities: ['Timeline filtering', 'Provenance chain', 'Event pinning', 'Export bundles'],
    shortcuts: ['F Filter', 'E Export', 'P Pin'],
  },
  notifications: {
    eyebrow: 'Attention center',
    purpose: 'Consolidated workspace alerts for approvals, completed runs, failures and important system events.',
    actions: ['Mark all read', 'Mute source', 'Notification settings'],
    metrics: [['Unread', '2', 'Action required'], ['Today', '18', 'All sources'], ['Critical', '0', 'No active criticals'], ['Muted', '3', 'Sources']],
    items: [['Approval requested', 'Modify protected branch requires review', 'Action', 'APR-018'], ['Verification complete', 'Frontend evidence package is ready', 'Info', 'RUN-042'], ['Remote session', 'A remote device reconnected', 'Info', 'REMOTE-042'], ['Provider notice', 'Model quota window renewed', 'Info', 'PROVIDER']],
    capabilities: ['Priority inbox', 'Source filters', 'Read state', 'Notification routing'],
    shortcuts: ['M Mark read', 'S Search notifications', 'N Notification settings'],
  },
  sessions: {
    eyebrow: 'Session lifecycle',
    purpose: 'Recall, inspect, rename, archive and compare agent conversations without exposing runtime secrets.',
    actions: ['New session', 'Export selected', 'Archive'],
    metrics: [['Sessions', '48', '12 this week'], ['Pinned', '7', 'High-value context'], ['Archived', '31', 'Retained'], ['Sync', 'Local', 'Runtime optional']],
    items: [['Architecture review', 'Sequential implementation controls', 'Pinned', 'SESSION-ARCH'], ['Frontend hardening', 'UI verification and cleanup', 'Active', 'SESSION-FE'], ['Provider research', 'Multi-provider routing notes', 'Recent', 'SESSION-PROV'], ['Release prep', 'Evidence and readiness', 'Recent', 'SESSION-REL']],
    capabilities: ['Session recall', 'Pinning', 'Archive state', 'Export preview'],
    shortcuts: ['N New session', 'P Pin', 'A Archive'],
  },
  logs: {
    eyebrow: 'Diagnostics',
    purpose: 'Structured events, tool output and traces grouped by run, session and surface.',
    actions: ['Live tail', 'Filter', 'Export logs'],
    metrics: [['Log lines', '42.8k', 'Current window'], ['Errors', '3', 'Needs review'], ['Warnings', '12', 'Non-blocking'], ['Trace coverage', '98%', 'Instrumented']],
    items: [['RUN-042', 'Frontend verification trace', 'Live', 'Run'], ['TOOL-381', 'Filesystem tool output', 'Verified', 'Tool'], ['PROV-104', 'Provider route decision', 'Verified', 'Provider'], ['UI-026', 'Surface render event', 'Info', 'Frontend']],
    capabilities: ['Live tail', 'Trace grouping', 'Structured filters', 'Log export'],
    shortcuts: ['T Toggle live tail', 'F Filter', 'X Export'],
  },
  analytics: {
    eyebrow: 'Workspace telemetry',
    purpose: 'Read-only dashboards for usage, latency, token flow and feature adoption.',
    actions: ['Refresh', 'Time range', 'Export'],
    metrics: [['Requests', '2.4k', '7d'], ['P95 latency', '428 ms', '7d'], ['Tokens', '1.8M', '7d'], ['Tool success', '98.7%', '7d']],
    items: [['Usage', 'Requests, sessions and active surfaces', 'Healthy', 'Metric'], ['Latency', 'Provider and tool latency distribution', 'Healthy', 'Metric'], ['Token flow', 'Context and response token movement', 'Healthy', 'Metric'], ['Adoption', 'Most used workspace features', 'Healthy', 'Metric']],
    capabilities: ['Metric cards', 'Trend summaries', 'Window selector', 'Evidence export'],
    shortcuts: ['1 24 hours', '7 7 days', 'E Export'],
  },
  batch: {
    eyebrow: 'Bounded concurrency',
    purpose: 'Prepare batches of work with explicit concurrency, retry policy, ordering and result inspection.',
    actions: ['New batch', 'Validate batch', 'Run preview'],
    metrics: [['Jobs', '12', '3 queued'], ['Concurrency', '4', 'Bounded'], ['Retries', '2', 'Policy'], ['Failures', '0', 'Current batch']],
    items: [['Frontend inventory', 'Index 42 UI surfaces', 'Queued', 'BATCH-12'], ['Prompt suite', 'Evaluate 64 cases', 'Ready', 'BATCH-11'], ['Artifact export', 'Package evidence set', 'Ready', 'BATCH-10'], ['Research sweep', 'Compare source snapshots', 'Draft', 'BATCH-09']],
    capabilities: ['Batch builder', 'Concurrency control', 'Retry policy', 'Result grouping'],
    shortcuts: ['B New batch', 'V Validate', 'R Run preview'],
  },
  learning: {
    eyebrow: 'Learning loop',
    purpose: 'Capture run outcomes, useful patterns and explicit feedback without silently mutating agent policy.',
    actions: ['Capture signal', 'Review patterns', 'Export learning'],
    metrics: [['Signals', '126', '23 new'], ['Useful patterns', '38', 'Curated'], ['Conflicts', '2', 'Needs review'], ['Policy changes', '0', 'Human gated']],
    items: [['Successful fix', 'Navigation type hardening pattern', 'Captured', 'Signal'], ['Tool recovery', 'Retry after transient failure', 'Captured', 'Pattern'], ['Prompt improvement', 'More explicit verification language', 'Review', 'Signal'], ['Conflict', 'Two memory items disagree', 'Needs review', 'Conflict']],
    capabilities: ['Signal capture', 'Pattern review', 'Conflict visibility', 'Human-gated updates'],
    shortcuts: ['C Capture', 'R Review', 'E Export'],
  },
  playground: {
    eyebrow: 'Model workspace',
    purpose: 'Compare providers and models against identical prompts while keeping evidence and routing decisions visible.',
    actions: ['New comparison', 'Run prompt', 'Save scenario'],
    metrics: [['Models', '6', 'Selected'], ['Providers', '9', 'Available'], ['Latency', '612 ms', 'Median'], ['Context', '128k', 'Policy']],
    items: [['Code repair', 'Same bug prompt across 3 models', 'Ready', 'Scenario'], ['Architecture', 'Long-context design comparison', 'Draft', 'Scenario'], ['Tool use', 'Structured call accuracy', 'Ready', 'Scenario'], ['Vision', 'Screenshot understanding', 'Draft', 'Scenario']],
    capabilities: ['Side-by-side compare', 'Prompt replay', 'Latency inspection', 'Scenario saving'],
    shortcuts: ['R Run', 'C Compare', 'S Save scenario'],
  },
  routing: {
    eyebrow: 'Model routing',
    purpose: 'Define priorities, role-based routes, health checks, fallback and cost-aware policies.',
    actions: ['Add route', 'Simulate', 'Validate policy'],
    metrics: [['Routes', '12', '5 active'], ['Fallbacks', '3', 'Configured'], ['Healthy', '94%', 'Providers'], ['Policy', 'Guarded', 'Failover']],
    items: [['Coding', 'Primary → fallback → local', 'Healthy', 'Route'], ['Research', 'Search model with grounded context', 'Healthy', 'Route'], ['Vision', 'Multimodal provider chain', 'Healthy', 'Route'], ['Background', 'Low-cost bounded execution', 'Healthy', 'Route']],
    capabilities: ['Role routing', 'Health-aware fallback', 'Cost weighting', 'Simulation'],
    shortcuts: ['A Add route', 'S Simulate', 'V Validate'],
  },
  'token-observatory': {
    eyebrow: 'Context economics',
    purpose: 'Inspect token pressure, compaction, cache behavior and optimization stages before runtime execution.',
    actions: ['Simulate compaction', 'Inspect budget', 'Compare snapshot'],
    metrics: [['Context load', '68%', 'Current policy'], ['Saved', '42%', 'Optimization preview'], ['Cache hits', '81%', 'Recent window'], ['Hard limit', '128k', 'Model policy']],
    items: [['Static noise trim', 'Remove formatting and protocol noise', 'Ready', 'Stage 01'], ['Memory dedup', 'Collapse repeated context', 'Ready', 'Stage 02'], ['Structural compaction', 'Preserve semantics with less text', 'Ready', 'Stage 03'], ['Adaptive trim', 'Trim old turns only at hard limits', 'Guarded', 'Stage 04']],
    capabilities: ['Budget visualization', 'Pipeline inspection', 'Snapshot compare', 'Hard-limit guard'],
    shortcuts: ['B Budget', 'C Compact', 'D Compare'],
  },
  toolsets: {
    eyebrow: 'Capability bundles',
    purpose: 'Activate grouped tool capabilities while preserving per-tool policy and approval boundaries.',
    actions: ['Create toolset', 'Attach tools', 'Validate'],
    metrics: [['Toolsets', '8', '3 active'], ['Tools', '42', 'Indexed'], ['Risk', 'Guarded', 'Policy'], ['Approvals', '6', 'Sensitive']],
    items: [['Developer', 'Filesystem, shell, git, editor', 'Active', 'Toolset'], ['Research', 'Search, browser, sources', 'Active', 'Toolset'], ['QA', 'Browser, screenshots, logs', 'Active', 'Toolset'], ['Media', 'Vision, TTS, image tools', 'Draft', 'Toolset']],
    capabilities: ['Bundle management', 'Tool attachment', 'Risk preview', 'Approval mapping'],
    shortcuts: ['N New', 'A Attach', 'V Validate'],
  },
  execution: {
    eyebrow: 'Execution lab',
    purpose: 'Design reproducible execution previews with inputs, environment, limits, artifacts and verification gates.',
    actions: ['New execution', 'Validate', 'Run preview'],
    metrics: [['Executions', '24', 'Recent'], ['Sandbox', 'Strict', 'Default'], ['Timeout', '10m', 'Policy'], ['Evidence', 'Required', 'Gate']],
    items: [['Code task', 'Bounded shell + file mutation', 'Ready', 'Execution'], ['Browser task', 'Browser actions + screenshot evidence', 'Ready', 'Execution'], ['Batch task', 'Bounded concurrent workers', 'Draft', 'Execution'], ['Recovery task', 'Resume from checkpoint', 'Ready', 'Execution']],
    capabilities: ['Input mapping', 'Environment selection', 'Resource limits', 'Evidence gates'],
    shortcuts: ['N New', 'V Validate', 'R Run preview'],
  },
  webhooks: {
    eyebrow: 'Event ingress',
    purpose: 'Model inbound triggers, signatures, retries and delivery status without storing secrets in presentation state.',
    actions: ['Add endpoint', 'Test delivery', 'Inspect events'],
    metrics: [['Endpoints', '6', '4 active'], ['Deliveries', '2.8k', '7d'], ['Success', '99.1%', '7d'], ['Retries', '11', '7d']],
    items: [['GitHub push', 'Repository change trigger', 'Active', 'WEB-01'], ['GitHub PR', 'Review event trigger', 'Active', 'WEB-02'], ['Build complete', 'CI result trigger', 'Active', 'WEB-03'], ['Custom event', 'User-defined integration hook', 'Draft', 'WEB-04']],
    capabilities: ['Endpoint cards', 'Delivery history', 'Retry visualization', 'Signature policy'],
    shortcuts: ['N New endpoint', 'T Test', 'E Events'],
  },
  imports: {
    eyebrow: 'Migration plane',
    purpose: 'Bring rules, skills, sessions and configuration from other systems with validation and provenance.',
    actions: ['New import', 'Validate package', 'Inspect mapping'],
    metrics: [['Imports', '9', '2 active'], ['Records', '1,284', 'Indexed'], ['Conflicts', '4', 'Review'], ['Provenance', '100%', 'Tracked']],
    items: [['Hermes rules', 'Import agent instructions', 'Ready', 'Package'], ['Session archive', 'Migrate conversation history', 'Ready', 'Package'], ['Skills bundle', 'Import procedural capabilities', 'Draft', 'Package'], ['Provider config', 'Map compatible endpoints', 'Review', 'Package']],
    capabilities: ['Package validation', 'Field mapping', 'Conflict review', 'Provenance tracking'],
    shortcuts: ['N New import', 'V Validate', 'M Mapping'],
  },
  media: {
    eyebrow: 'Multimodal studio',
    purpose: 'Design visual, audio and document input/output flows while keeping provider capabilities explicit.',
    actions: ['New media flow', 'Preview', 'Compare providers'],
    metrics: [['Flows', '7', '2 active'], ['Vision', '4', 'Providers'], ['TTS', '3', 'Providers'], ['Storage', 'Local', 'Policy']],
    items: [['Image understanding', 'Vision input → grounded response', 'Ready', 'Flow'], ['TTS response', 'Text → speech output', 'Ready', 'Flow'], ['Screenshot QA', 'Browser screenshot → inspection', 'Ready', 'Flow'], ['Document ingest', 'File → extracted context', 'Draft', 'Flow']],
    capabilities: ['Media pipeline UI', 'Capability matrix', 'Provider comparison', 'Preview cards'],
    shortcuts: ['N New flow', 'P Preview', 'C Compare'],
  },
  wake: {
    eyebrow: 'Presence & activation',
    purpose: 'Configure wake-word style activation, presence indicators and hands-free session readiness.',
    actions: ['Configure', 'Test microphone', 'Reset state'],
    metrics: [['Wake state', 'Ready', 'Local UI'], ['Microphone', 'Available', 'Device'], ['Sensitivity', '72%', 'Configured'], ['Session', 'Idle', 'No active run']],
    items: [['Wake phrase', 'Hands-free activation phrase', 'Configured', 'Activation'], ['Presence', 'Microphone activity indicator', 'Ready', 'Presence'], ['Push-to-talk', 'Manual recording shortcut', 'Ready', 'Input'], ['Auto-stop', 'End capture after inactivity', 'Ready', 'Input']],
    capabilities: ['Activation settings', 'Presence indicator', 'Input preferences', 'Safety preview'],
    shortcuts: ['Space Push to talk', 'M Test mic', 'R Reset'],
  },
}

const fallbackConfig: FeatureConfig = {
  eyebrow: 'Workspace feature',
  purpose: 'A structured presentation surface for the selected AgentiCOS capability. Runtime execution remains behind explicit contracts.',
  actions: ['New item', 'Inspect', 'Validate'],
  metrics: [['Surface', 'Ready', 'UI contract'], ['State', 'Local', 'Presentation'], ['Policy', 'Guarded', 'Runtime boundary'], ['Coverage', 'High', 'Interactive shell']],
  items: [['Overview', 'Primary controls and current workspace state', 'Ready', 'Surface'], ['Configuration', 'Editable presentation preferences', 'Local', 'Settings'], ['Activity', 'Recent events and evidence', 'Ready', 'Timeline'], ['Verification', 'Quality and recovery checkpoints', 'Pending', 'Quality']],
  capabilities: ['Search and filtering', 'Selection state', 'Action routing', 'Verification visibility'],
  shortcuts: ['⌘K Command palette', '⌘⇧F Global search', '⌘⇧Enter Focus mode'],
}

export default function FeatureWorkbench({ mode, onAction }: FeatureWorkbenchProps) {
  const navigation = navigationItems.find(item => item.id === mode)
  const config = configs[mode] ?? fallbackConfig
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(config.items[0][0])
  const [view, setView] = useState<'Overview' | 'Activity'>('Overview')
  const [favorite, setFavorite] = useState(false)
  const [density, setDensity] = useState<'Comfortable' | 'Compact'>('Comfortable')
  const [statePreview, setStatePreview] = useState<'Ready' | 'Loading' | 'Empty' | 'Error' | 'Offline' | 'Approval'>('Ready')

  useEffect(() => {
    setQuery('')
    setSelected(config.items[0][0])
    setView('Overview')
    setFavorite(false)
    setDensity('Comfortable')
    setStatePreview('Ready')
  }, [mode])
  const normalized = query.trim().toLowerCase()
  const visible = useMemo(() => config.items.filter(item => !normalized || item.join(' ').toLowerCase().includes(normalized)), [config.items, normalized])
  const current = config.items.find(item => item[0] === selected) ?? config.items[0]

  return (
    <div className={density === 'Compact' ? 'feature-workbench feature-workbench--compact' : 'feature-workbench'}>
      <header className="feature-workbench__hero">
        <div className="feature-workbench__hero-copy">
          <span className="eyebrow">{config.eyebrow}</span>
          <h1>{navigation?.label ?? mode.replaceAll('-', ' ')}</h1>
          <p>{config.purpose}</p>
          <div className="feature-workbench__badges"><Tag label="Presentation ready" /><Tag label="Runtime contract aware" /><Tag label={favorite ? 'Pinned' : 'Available'} /></div>
        </div>
        <div className="feature-workbench__actions">
          {config.actions.map(action => <button key={action} className={action === config.actions[0] ? 'studio-button studio-button--active' : 'studio-button'} type="button" onClick={() => onAction(action + ' opened for ' + mode.replaceAll('-', ' '))}><Icon name={action.includes('Inspect') ? 'search' : action.includes('Validate') ? 'check' : action.includes('Run') ? 'play' : action.includes('Export') ? 'download' : 'plus'} size={14} />{action}</button>)}
          <button className="icon-button" type="button" aria-pressed={favorite} aria-label="Pin workspace feature" title="Pin feature" onClick={() => { setFavorite(value => !value); onAction((favorite ? 'Unpinned ' : 'Pinned ') + mode) }}><Icon name={favorite ? 'archive' : 'archive'} size={15} /></button>
        </div>
      </header>

      <section className="feature-workbench__metrics" aria-label="Feature metrics">
        {config.metrics.map(([label, value, sub]) => <MetricCard key={label} label={label} value={value} sub={sub} />)}
      </section>

      <RuntimeProbePanel mode={mode} onAction={onAction} />

      <div className="feature-state-preview" aria-label="Preview surface state">
        <span className="feature-state-preview__label">State preview</span>
        {(['Ready', 'Loading', 'Empty', 'Error', 'Offline', 'Approval'] as const).map((state) => (
          <button
            key={state}
            type="button"
            className={statePreview === state ? 'feature-state-button feature-state-button--active' : 'feature-state-button'}
            aria-pressed={statePreview === state}
            onClick={() => setStatePreview(state)}
          >
            {state}
          </button>
        ))}
      </div>

      <div className="feature-workbench__toolbar">
        <div className="feature-workbench__tabs" role="tablist" aria-label="Feature views" aria-orientation="horizontal">
          {(['Overview', 'Activity'] as const).map((tab, index, tabs) => <button key={tab} id={'feature-tab-' + tab.toLowerCase()} type="button" role="tab" tabIndex={view === tab ? 0 : -1} aria-selected={view === tab} aria-controls={'feature-panel-' + tab.toLowerCase()} className={view === tab ? 'feature-tab feature-tab--active' : 'feature-tab'} onClick={() => setView(tab)} onKeyDown={(event) => {
            const nextIndex = event.key === 'ArrowRight'
              ? (index + 1) % tabs.length
              : event.key === 'ArrowLeft'
                ? (index - 1 + tabs.length) % tabs.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
            if (nextIndex >= 0) {
              event.preventDefault()
              const next = tabs[nextIndex]
              setView(next)
              window.requestAnimationFrame(() => document.getElementById('feature-tab-' + next.toLowerCase())?.focus())
            }
          }}><Icon name={tab === 'Overview' ? 'layers' : 'activity'} size={13} />{tab}</button>)}
        </div>
        <div className="feature-workbench__controls">
          <label className="feature-search"><Icon name="search" size={13} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search this workspace…" aria-label="Search feature workspace" /></label>
          <button className="soft-button" type="button" onClick={() => setDensity(value => value === 'Comfortable' ? 'Compact' : 'Comfortable')}><Icon name="sliders" size={13} />{density}</button>
          <button className="soft-button" type="button" onClick={() => onAction('Filter opened for ' + mode)}><Icon name="filter" size={13} />Filter</button>
        </div>
      </div>

      {statePreview !== 'Ready' ? (
        <section className={`feature-state-panel feature-state-panel--${statePreview.toLowerCase()}`} role={statePreview === 'Error' ? 'alert' : 'status'} aria-live="polite">
          <div className="feature-state-panel__icon">
            <Icon name={statePreview === 'Error' ? 'alert' : statePreview === 'Offline' ? 'cloud' : statePreview === 'Approval' ? 'shield' : statePreview === 'Loading' ? 'refresh' : 'archive'} size={18} />
          </div>
          <div>
            <span className="eyebrow">{statePreview} state</span>
            <strong>
              {statePreview === 'Loading' ? 'Workspace surface is loading' :
               statePreview === 'Empty' ? 'No items are available yet' :
               statePreview === 'Error' ? 'Workspace surface needs recovery' :
               statePreview === 'Offline' ? 'Runtime is currently unavailable' :
               'Human approval is required'}
            </strong>
            <p>
              {statePreview === 'Loading' ? 'Keep the surrounding shell interactive while the selected module prepares its data.' :
               statePreview === 'Empty' ? 'Use the primary action above to create the first local presentation item.' :
               statePreview === 'Error' ? 'The failure should remain isolated to this surface so the rest of the workspace stays usable.' :
               statePreview === 'Offline' ? 'The UI can remain navigable while runtime-owned operations wait for reconnection.' :
               'Sensitive or destructive actions must remain blocked until an explicit approval contract resolves.'}
            </p>
          </div>
          <div className="feature-state-panel__actions">
            <button className="studio-button" type="button" onClick={() => setStatePreview('Ready')}>Return ready</button>
            {statePreview === 'Error' && <button className="studio-button studio-button--active" type="button" onClick={() => onAction('Recovery requested for ' + mode)}>Retry preview</button>}
            {statePreview === 'Offline' && <button className="studio-button studio-button--active" type="button" onClick={() => onAction('Reconnect requested for ' + mode)}>Reconnect</button>}
          </div>
        </section>
      ) : view === 'Overview' ? (
        <section id="feature-panel-overview" role="tabpanel" aria-labelledby="feature-tab-overview" tabIndex={0}>
          <div className="feature-workbench__grid">
            <Panel title="Workspace items">
            <div className="feature-list">
              {visible.map(([name, detail, state, kind]) => <button key={name} type="button" className={selected === name ? 'feature-list__row feature-list__row--active' : 'feature-list__row'} onClick={() => setSelected(name)}>
                <span className="feature-list__icon"><Icon name={kind === 'Metric' ? 'activity' : kind === 'Timeline' ? 'history' : 'layers'} size={14} /></span>
                <span><strong>{name}</strong><small>{detail}</small></span>
                <Tag label={state} />
                <Icon name="chevron-right" size={13} />
              </button>)}
            </div>
            {visible.length === 0 && <div className="feature-empty"><Icon name="search" size={16} /><strong>No matching workspace items</strong><span>Adjust the query or clear the filter.</span></div>}
          </Panel>

          <Panel title={current[0]}>
            <div className="feature-detail">
              <div className="feature-detail__header"><span className="eyebrow">{current[3]}</span><Tag label={current[2]} /></div>
              <h2>{current[0]}</h2>
              <p>{current[1]}</p>
              <div className="feature-detail__section"><span>Capabilities</span><div className="feature-chip-grid">{config.capabilities.map(item => <span key={item}>{item}</span>)}</div></div>
              <div className="feature-detail__section"><span>Local presentation actions</span><div className="platform-actions">{config.actions.map(action => <button key={action} className="studio-button" type="button" onClick={() => onAction(action + ' staged in UI for ' + current[0])}>{action}</button>)}</div></div>
            </div>
            </Panel>
          </div>
        </section>
      ) : (
        <section id="feature-panel-activity" role="tabpanel" aria-labelledby="feature-tab-activity" tabIndex={0}>
          <Panel title="Recent activity">
            <div className="feature-activity">
            {config.items.map(([name, detail, state, kind], index) => <div className="feature-activity__row" key={name}><span className="feature-activity__index">0{index + 1}</span><div><strong>{name}</strong><small>{detail} · {kind}</small></div><Tag label={state} /><time>{index + 1}m ago</time></div>)}
            </div>
          </Panel>
        </section>
      )}

      <footer className="feature-workbench__footer">
        <div><Icon name="shield" size={13} /><span>Presentation state is local. Runtime authority, secrets and destructive execution remain outside this surface.</span></div>
        <div className="feature-shortcuts">{config.shortcuts.map(shortcut => <kbd key={shortcut}>{shortcut}</kbd>)}</div>
      </footer>
    </div>
  )
}
