import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import type { PlatformMode } from '../../navigation'
const ContextInspector = lazy(() => import('../context/ContextInspector'))
const McpManager = lazy(() => import('../mcp/McpManager'))
const HookManager = lazy(() => import('../hooks/HookManager'))
const GitDiffCenter = lazy(() => import('../git/GitDiffCenter'))
const EnvironmentBuilder = lazy(() => import('../environments/EnvironmentBuilder'))
const AutomationBuilder = lazy(() => import('../automations/AutomationBuilder'))
const CredentialManager = lazy(() => import('../credentials/CredentialManager'))
const ChannelGatewayManager = lazy(() => import('../channels/ChannelGatewayManager'))
const ResearchWorkbench = lazy(() => import('../research/ResearchWorkbench'))
import Icon from '../../components/Icon'
const BrowserWorkspace = lazy(() => import('../browser/BrowserWorkspace'))
const SecurityCenter = lazy(() => import('../security/SecurityCenter'))
const CanvasStudio = lazy(() => import('../canvas/CanvasStudio'))
const CommandStudio = lazy(() => import('../commands/CommandStudio'))
const SubagentFleet = lazy(() => import('../subagents/SubagentFleet'))
const CloudAgentsWorkspace = lazy(() => import('../cloud/CloudAgentsWorkspace'))
const ComputerUseWorkspace = lazy(() => import('../computer/ComputerUseWorkspace'))
const OperationsCenter = lazy(() => import('../operations/OperationsCenter'))
const MarketplaceStudio = lazy(() => import('../marketplace/MarketplaceStudio'))
const KanbanBoard = lazy(() => import('../kanban/KanbanBoard'))
const IntegrationCatalogSurface = lazy(() => import('../integrations/IntegrationCatalogSurface'))
const AdvancedStudio = lazy(() => import('./AdvancedStudio').then((module) => ({ default: module.AdvancedStudio })))
const WorkspaceOverview = lazy(() => import('./WorkspaceOverview').then((module) => ({ default: module.WorkspaceOverview })))
const ApprovalCenter = lazy(() => import('./ApprovalCenter').then((module) => ({ default: module.ApprovalCenter })))
const PermissionsMatrix = lazy(() => import('./PermissionsMatrix').then((module) => ({ default: module.PermissionsMatrix })))
const PromptLab = lazy(() => import('./PromptLab').then((module) => ({ default: module.PromptLab })))
const AgentControlPlane = lazy(() => import('./AgentControlPlane').then((module) => ({ default: module.AgentControlPlane })))
import { projects, indexEntries, ruleSources, backgroundJobs, checkpoints, bots, channels, researchBatches, batchJobs, learningSignals, plugins, integrations, sessions, tasks, logEntries, analyticsCards, webhooks, toolsets, imports, mediaItems, evaluationSuites, evaluationRuns, notifications, securityPolicies } from './platformData'
import { Shell, Panel, Metric, MetricCard, List, Tag, Toast } from './PlatformPrimitives'

function PlatformSurfaceContent({ mode }: { mode: PlatformMode }) {
  const [query, setQuery] = useState('')
  const [selectedProject, setSelectedProject] = useState(projects[0].id)
  const [selectedJob, setSelectedJob] = useState(backgroundJobs[0][0])
  const [selectedRule, setSelectedRule] = useState(ruleSources[0][0])
  const [ruleText, setRuleText] = useState('Prefer reversible changes. Preserve runtime contracts. Verify every implementation slice before advancing state.')
  const [enabledPolicies, setEnabledPolicies] = useState(() => new Set(securityPolicies.filter((item) => item[2]).map((item) => item[0])))
  const [voiceMode, setVoiceMode] = useState(true)
  const [researchBatch, setResearchBatch] = useState(researchBatches[0][0])
  const [batchJob, setBatchJob] = useState(batchJobs[0][0])
  const [selectedPlugin, setSelectedPlugin] = useState(plugins[0][0])
  const [integration, setIntegration] = useState(integrations[0][0])
  const [selectedSession, setSelectedSession] = useState(sessions[0][0])
  const [enabledWebhooks, setEnabledWebhooks] = useState(() => new Set(webhooks.filter((item) => item[4]).map((item) => item[0])))
  const [enabledToolsets, setEnabledToolsets] = useState(() => new Set(toolsets.filter((item) => item[3]).map((item) => item[0])))
  const [selectedImport, setSelectedImport] = useState(imports[0][0])
  const [selectedMedia, setSelectedMedia] = useState(mediaItems[0][0])
  const [selectedEvaluation, setSelectedEvaluation] = useState(evaluationSuites[0][0])
  const [notificationsRead, setNotificationsRead] = useState(() => new Set(notifications.filter((item) => item[4]).map((item) => item[0])))
  const [wakeEnabled, setWakeEnabled] = useState(true)
  const [selectedTask, setSelectedTask] = useState(tasks[0][0])
  const [notice, setNotice] = useState('')

  function notify(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2200)
  }

  function toggle(setter: (value: Set<string>) => void, current: Set<string>, value: string) {
    const next = new Set(current)
    next.has(value) ? next.delete(value) : next.add(value)
    setter(next)
  }

  const filteredIndex = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return normalized ? indexEntries.filter((item) => item.join(' ').toLowerCase().includes(normalized)) : indexEntries
  }, [query])

  function renderHeader(eyebrow: string, title: string, subtitle: string, actions?: ReactNode) {
    return (
      <header className="platform-header">
        <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>
        <div className="platform-header__actions">{actions}</div>
      </header>
    )
  }




  if (mode === 'approvals') return (
    <ApprovalCenter onAction={notify} />
  )

  if (mode === 'prompts') return (
    <Shell>
      {renderHeader('Prompt engineering', 'Prompt Lab', 'Version prompts, variables, layered instructions, tests, diffs and release safeguards.', <span className="state-pill state-pill--pending">Preview</span>)}
      <PromptLab onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'agent-control') return (
    <Shell>
      {renderHeader('Agent configuration', 'Agent Control Plane', 'Configure autonomy, policy, budgets, behavior and lifecycle without coupling the frontend to runtime execution.', <span className="state-pill state-pill--pending">Preview</span>)}
      <AgentControlPlane onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'permissions') return (
    <PermissionsMatrix onAction={notify} />
  )

  if (mode === 'overview') return (
    <WorkspaceOverview onAction={notify} />
  )

  if (mode === 'playground' || mode === 'routing' || mode === 'token-observatory' || mode === 'versions' || mode === 'audit') return (
    <AdvancedStudio mode={mode} onAction={notify} />
  )

  if (mode === 'canvas') return (
    <Shell>
      {renderHeader('Visual workspace', 'Canvas', 'Compose interactive artifacts and side-by-side visual workflows without leaving the agent session.', <span className="state-pill state-pill--pending">Preview</span>)}
      <CanvasStudio onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'commands') return (
    <Shell>
      {renderHeader('Reusable workflows', 'Commands', 'Build slash commands and focused workflows with explicit scope, variables and invocation behavior.', <span className="state-pill state-pill--pending">Preview</span>)}
      <CommandStudio onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'subagents') return (
    <Shell>
      {renderHeader('Delegation', 'Subagents', 'Manage specialized agents with isolated context windows, tools, models and handoffs.', <button className="studio-button studio-button--active" type="button" onClick={() => notify('Parallel subagents started in preview')}><Icon name="play" size={13} /> Run parallel</button>)}
      <SubagentFleet onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'cloud') return (
    <Shell>
      {renderHeader('Remote execution', 'Cloud Agents', 'Inspect remote agent environments, artifacts and desktop handoff state.', <span className="state-pill state-pill--pending">Preview</span>)}
      <CloudAgentsWorkspace onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'computer') return (
    <Shell>
      {renderHeader('Computer interaction', 'Computer Use', 'Model desktop/browser control, recordings and verification artifacts as a dedicated execution surface.', <span className="state-pill state-pill--pending">Preview</span>)}
      <ComputerUseWorkspace onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'operations') return (
    <Shell>
      {renderHeader('Administration', 'Operations Center', 'Health, doctor, backups, maintenance and support operations with explicit safety boundaries.', <span className="state-pill state-pill--pending">Preview</span>)}
      <OperationsCenter onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'kanban') return (
    <Shell>
      {renderHeader('Work management', 'Kanban', 'Coordinate tasks, ownership and agent handoffs using a visual work board.', <span className="state-pill state-pill--pending">Preview</span>)}
      <KanbanBoard onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'marketplace') return (
    <Shell>
      {renderHeader('Extension ecosystem', 'Marketplace', 'Discover and manage bundled plugins, skills, MCP servers and reusable commands.', <span className="state-pill state-pill--pending">Preview</span>)}
      <MarketplaceStudio onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'homeassistant' || mode === 'social') return (
    <Shell>
      <IntegrationCatalogSurface mode={mode} onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'security') return (
    <Shell>
      {renderHeader('Control plane', 'Security Center', 'Inspect workspace protection, permissions, secrets boundaries, audit state and recovery controls.', <button className="studio-button" type="button" onClick={() => notify('Security policies refreshed in preview')}><Icon name="history" size={14} /> Refresh</button>)}
      <SecurityCenter onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'evaluations') return (
    <Shell>
      {renderHeader('Quality intelligence', 'Evaluations', 'Repeatable suites for agent behavior, tools, prompts and model comparisons.', <button className="studio-button studio-button--active" type="button" onClick={() => notify('Evaluation run staged in preview')}><Icon name="play" size={14} /> Run suite</button>)}
      <div className="evaluation-layout"><div className="evaluation-list">{evaluationSuites.map(([id, title, cases, score, state]) => <button type="button" key={id} className={`evaluation-row ${selectedEvaluation === id ? 'evaluation-row--active' : ''}`} onClick={() => setSelectedEvaluation(id)}><div><strong>{title}</strong><span>{id} · {cases}</span></div><span className="mono-text">{score}</span><span className={state === 'Stable' ? 'state-pill state-pill--completed' : 'state-pill state-pill--pending'}>{state}</span></button>)}</div><Panel title={selectedEvaluation}><div className="evaluation-score"><div><span>Current score</span><strong>93.8%</strong><small>+2.4 pts vs previous</small></div><div className="score-ring"><span>93</span></div></div><div className="evaluation-run-list">{evaluationRuns.map(([id, model, passed, duration]) => <div key={id}><div><strong>{model}</strong><span>{id} · {duration}</span></div><span className="mono-text">{passed}</span></div>)}</div><div className="platform-actions"><button className="studio-button" type="button" onClick={() => notify('Case browser opened in preview')}>Browse cases</button><button className="studio-button" type="button" onClick={() => notify('Model comparison opened in preview')}>Compare models</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Evaluation report exported in preview')}><Icon name="arrow-down" size={13} /> Export report</button></div></Panel></div>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'notifications') return (
    <Shell>
      {renderHeader('Workspace inbox', 'Notifications', 'Centralize approvals, completions, warnings and background activity without interrupting the current task.', <><button className="studio-button" type="button" onClick={() => setNotificationsRead(new Set(notifications.map((item) => item[0])))}>Mark all read</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Notification preferences opened in preview')}>Preferences</button></>)}
      <div className="notification-summary"><Metric label="Unread" value={String(notifications.length - notificationsRead.size)} /><Metric label="Approvals" value="1" /><Metric label="Warnings" value="1" /><Metric label="Recent runs" value="4" /></div>
      <div className="notification-list">{notifications.map(([title, detail, age, level]) => { const isRead = notificationsRead.has(title); return <button type="button" key={title} className={isRead ? 'notification-row notification-row--read' : 'notification-row'} onClick={() => setNotificationsRead((current) => new Set(current).add(title))}><span className={`notification-dot notification-dot--${level}`} /><div><strong>{title}</strong><span>{detail}</span><small>{age} · {isRead ? 'read' : 'unread'}</small></div><Icon name={level === 'high' ? 'shield' : 'chevron-right'} size={13} /></button> })}</div>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'wake') return (
    <Shell>
      {renderHeader('Hands-free control', 'Wake Word & Presence', 'Manage microphone readiness, hotword activation and voice-session behavior as explicit local UI state.', <button className={wakeEnabled ? 'studio-button studio-button--active' : 'studio-button'} type="button" onClick={() => setWakeEnabled((value) => !value)}><Icon name="mic" size={14} /> {wakeEnabled ? 'Wake enabled' : 'Wake disabled'}</button>)}
      <div className="wake-layout"><Panel title="Presence"><div className="wake-orb"><Icon name="mic" size={28} /></div><strong className="wake-title">{wakeEnabled ? 'Listening for activation' : 'Microphone idle'}</strong><span className="wake-description">Local UI preview only. No microphone stream is opened by this component.</span><div className="platform-grid platform-grid--2"><Metric label="Wake phrase" value="Hey AgentiCOS" /><Metric label="Sensitivity" value="Balanced" /><Metric label="Device" value="Default microphone" /><Metric label="Mode" value={wakeEnabled ? 'Standby' : 'Off'} /></div></Panel><Panel title="Voice handoff"><div className="strategy-stack"><div><span>Activation</span><strong>Wake word → session</strong></div><div><span>Response</span><strong>Text + TTS preview</strong></div><div><span>Privacy</span><strong>On-device gate preferred</strong></div><div><span>Fallback</span><strong>Push-to-talk</strong></div></div><div className="platform-actions"><button className="studio-button" type="button" onClick={() => notify('Voice preferences opened in preview')}>Voice settings</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Push-to-talk staged in preview')}>Test push-to-talk</button></div></Panel></div>
      <Toast message={notice} />
    </Shell>
  )


  if (mode === 'tasks') return (
    <Shell>
      {renderHeader('Execution planning', 'Tasks', 'Track objectives, dependencies, owners and handoff state before they become agent runs.', <button className="studio-button studio-button--active" type="button" onClick={() => notify('New task opened in preview')}><Icon name="plus" size={14} /> New task</button>)}
      <div className="task-layout"><div className="task-list">{tasks.map(([id, title, owner, state, priority]) => <button type="button" key={id} className={`task-row ${selectedTask === id ? 'task-row--active' : ''}`} onClick={() => setSelectedTask(id)}><span className="task-priority">{priority}</span><div><strong>{title}</strong><span>{id} · {owner}</span></div><span className={state === 'In progress' ? 'state-pill state-pill--active' : state === 'Ready' ? 'state-pill state-pill--completed' : 'state-pill state-pill--pending'}>{state}</span></button>)}</div><Panel title={selectedTask}><div className="task-detail"><span className="eyebrow">Objective</span><h2>Complete frontend architecture</h2><p>Keep UI capabilities explicit, split by domain and preserve the runtime boundary.</p></div><div className="task-dependencies"><div><strong>Dependencies</strong><span>TASK-103 · review findings</span><span>TASK-102 · verification plan</span></div><div><strong>Handoff</strong><span>→ Builder</span><span>→ Reviewer</span></div></div><div className="platform-actions"><button className="studio-button" type="button" onClick={() => notify('Task plan opened in preview')}>Open plan</button><button className="studio-button" type="button" onClick={() => notify('Task run preview opened')}>Preview run</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Task checkpoint staged in preview')}><Icon name="git" size={14} /> Checkpoint</button></div></Panel></div>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'sessions') return (
    <Shell>
      {renderHeader('Conversation management', 'Sessions', 'Browse, search, pin, export and manage agent conversations without leaving the workspace.', <button className="studio-button studio-button--active" type="button" onClick={() => notify('New session opened in preview')}><Icon name="plus" size={14} /> New session</button>)}
      <div className="session-layout"><div className="session-list">{sessions.map(([id, title, meta, state, pinned]) => <button type="button" key={id} className={`session-row ${selectedSession === id ? 'session-row--active' : ''}`} onClick={() => setSelectedSession(id)}><div className="session-row__icon"><Icon name={pinned ? 'archive' : 'history'} size={14} /></div><div><strong>{title}</strong><span>{id} · {meta}</span></div><span className={state === 'Active' ? 'state-pill state-pill--active' : state === 'Pinned' ? 'state-pill state-pill--completed' : 'state-pill state-pill--pending'}>{state}</span></button>)}</div><Panel title={selectedSession}><div className="platform-grid platform-grid--2"><Metric label="Messages" value="42" /><Metric label="Context" value="62.2k" /><Metric label="Model" value="Auto route" /><Metric label="Last active" value="2m" /></div><div className="platform-actions"><button className="studio-button" type="button" onClick={() => notify('Session search opened in preview')}><Icon name="search" size={13} /> Search messages</button><button className="studio-button" type="button" onClick={() => notify('Session export prepared in preview')}><Icon name="arrow-down" size={13} /> Export</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Session branch opened in preview')}><Icon name="branch" size={13} /> Fork</button></div></Panel></div>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'logs') return (
    <Shell>
      {renderHeader('Diagnostics', 'Logs & Traces', 'Inspect structured agent events, tool calls, policy checks and diagnostic output.', <><button className="studio-button" type="button" onClick={() => notify('Log filters opened in preview')}><Icon name="search" size={14} /> Filter</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Log export prepared in preview')}><Icon name="arrow-down" size={14} /> Export</button></>)}
      <div className="log-toolbar"><span className="state-pill state-pill--completed">Live preview</span><span className="mono-text">level: info · scope: current session</span></div>
      <div className="log-table">{logEntries.map(([time, scope, event, detail]) => <div className="log-row" key={time + event}><span>{time}</span><span>{scope}</span><strong>{event}</strong><span>{detail}</span></div>)}</div>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'analytics') return (
    <Shell>
      {renderHeader('Usage intelligence', 'Analytics', 'A product-level view of runs, tokens, latency and tool activity. Values below are preview data.', <button className="studio-button" type="button" onClick={() => notify('Analytics period changed in preview')}><Icon name="clock" size={14} /> Last 30 days</button>)}
      <div className="analytics-grid">{analyticsCards.map(([label, value, sub]) => <div className="platform-metric-card" key={label}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>)}</div>
      <div className="platform-grid platform-grid--2"><Panel title="Activity"><div className="analytics-bars">{[28,46,38,72,54,81,61,88,70,93,76,84,66,91].map((value, index) => <i key={index} style={{ height: value + '%' }} />)}</div></Panel><Panel title="Breakdown"><Metric label="Agent runs" value="71%" /><Metric label="Background" value="16%" /><Metric label="Research" value="8%" /><Metric label="Other" value="5%" /></Panel></div>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'webhooks') return (
    <Shell>
      {renderHeader('Event gateway', 'Webhooks & Events', 'Define inbound event triggers, delivery policies and local preview endpoints.', <button className="studio-button studio-button--active" type="button" onClick={() => notify('Webhook builder opened in preview')}><Icon name="plus" size={14} /> New webhook</button>)}
      <div className="webhook-list">{webhooks.map(([id, title, endpoint, state, enabled]) => <div className="webhook-row" key={id}><div><strong>{title}</strong><span>{id} · {endpoint}</span></div><span className={enabledWebhooks.has(id) ? 'state-pill state-pill--active' : 'state-pill state-pill--pending'}>{enabledWebhooks.has(id) ? 'Enabled' : enabled ? 'Configured' : state}</span><button className="studio-button" type="button" onClick={() => { const next = new Set(enabledWebhooks); next.has(id) ? next.delete(id) : next.add(id); setEnabledWebhooks(next); notify(id + ' toggled in preview') }}>{enabledWebhooks.has(id) ? 'Pause' : 'Enable'}</button></div>)}</div>
      <Panel title="Delivery policy"><div className="platform-grid platform-grid--2"><Metric label="Retries" value="3" /><Metric label="Backoff" value="Exponential" /><Metric label="Signing" value="Required" /><Metric label="Timeout" value="10s" /></div></Panel>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'credentials') return (
    <Shell>
      <CredentialManager onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'toolsets') return (
    <Shell>
      {renderHeader('Capability bundles', 'Toolsets', 'Activate groups of tools for a workflow while keeping individual tool permissions visible elsewhere.', <button className="studio-button" type="button" onClick={() => notify('Toolset editor opened in preview')}><Icon name="plus" size={14} /> New toolset</button>)}
      <div className="toolset-list">{toolsets.map(([name, detail, count, active]) => <div className="toolset-row" key={name}><div className="toolset-icon"><Icon name="layers" size={15} /></div><div><strong>{name}</strong><span>{detail} · {count}</span><small>{active ? 'Default toolset' : 'Optional toolset'}</small></div><button className={enabledToolsets.has(name) ? 'switch switch--on' : 'switch'} type="button" role="switch" aria-checked={enabledToolsets.has(name)} onClick={() => toggle(setEnabledToolsets, enabledToolsets, name)}><span /></button></div>)}</div>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'imports') return (
    <Shell>
      {renderHeader('Migration', 'Imports & Migrations', 'Bring instructions, rules, context and session archives into AgentiCOS with an explicit review step.', <button className="studio-button studio-button--active" type="button" onClick={() => notify('Import picker opened in preview')}><Icon name="arrow-down" size={14} /> Import package</button>)}
      <div className="import-layout"><div className="import-list">{imports.map(([name, source, type, state]) => <button type="button" key={name} className={`import-row ${selectedImport === name ? 'import-row--active' : ''}`} onClick={() => setSelectedImport(name)}><div><strong>{name}</strong><span>{source} · {type}</span></div><span className="state-pill state-pill--completed">{state}</span></button>)}</div><Panel title={selectedImport}><div className="platform-grid platform-grid--2"><Metric label="Review" value="Required" /><Metric label="Merge" value="Preview diff" /><Metric label="Secrets" value="Ignored" /><Metric label="Rollback" value="Available" /></div><div className="platform-actions"><button className="studio-button" type="button" onClick={() => notify('Migration diff opened in preview')}>View diff</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Migration approval staged in preview')}><Icon name="check" size={14} /> Approve import</button></div></Panel></div>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'media') return (
    <Shell>
      {renderHeader('Multimodal workspace', 'Media Studio', 'A unified surface for image generation, vision analysis, speech and multimodal artifacts.', <button className="studio-button studio-button--active" type="button" onClick={() => notify('New media task opened in preview')}><Icon name="plus" size={14} /> New media task</button>)}
      <div className="media-studio-grid">{mediaItems.map(([name, detail, category, state]) => <button type="button" key={name} className={`platform-card media-card ${selectedMedia === name ? 'platform-card--active' : ''}`} onClick={() => setSelectedMedia(name)}><div className="media-card__icon"><Icon name="layout" size={18} /></div><div><strong>{name}</strong><span>{detail}</span><small>{category}</small></div><span className="state-pill state-pill--pending">{state}</span></button>)}</div>
      <Panel title={selectedMedia}><div className="media-preview"><div className="empty-orb"><Icon name="layout" size={24} /></div><strong>Multimodal preview</strong><span>Attach an image, generate an artifact or queue audio when the corresponding runtime service is connected.</span></div><div className="platform-actions"><button className="studio-button" type="button" onClick={() => notify('Media input picker opened in preview')}>Add input</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Generation request staged in preview')}><Icon name="spark" size={14} /> Generate</button></div></Panel>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'batch') return (
    <Shell>
      {renderHeader('Parallel work', 'Batch Processing', 'Process many inputs with bounded concurrency, progress, failures and export-ready results.', <button className="studio-button studio-button--active" type="button" onClick={() => notify('New batch opened in preview')}><Icon name="plus" size={14} /> New batch</button>)}
      <div className="batch-layout"><div className="batch-list">{batchJobs.map(([id, title, inputs, state]) => <button type="button" key={id} className={`batch-row ${batchJob === id ? 'batch-row--active' : ''}`} onClick={() => setBatchJob(id)}><div><strong>{title}</strong><span>{id} · {inputs}</span></div><span className={`state-pill state-pill--${state === 'Complete' ? 'completed' : state === 'Running' ? 'active' : 'pending'}`}>{state}</span></button>)}</div><Panel title={batchJob}><div className="batch-metrics"><Metric label="Inputs" value="48" /><Metric label="Concurrency" value="6" /><Metric label="Processed" value="31" /><Metric label="Failed" value="1" /></div><div className="budget-bar"><span style={{ width:'64%' }} /></div><div className="platform-actions"><button className="studio-button" type="button" onClick={() => notify('Batch paused in preview')}><Icon name="stop" size={14} /> Pause</button><button className="studio-button" type="button" onClick={() => notify('Failed inputs opened in preview')}>Inspect failures</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Batch export prepared in preview')}><Icon name="arrow-down" size={14} /> Export results</button></div></Panel></div>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'learning') return (
    <Shell>
      {renderHeader('Continuous improvement', 'Learning Loop', 'Turn useful run outcomes into reviewable memory, skill and prompt candidates without silently changing behavior.', <button className="studio-button studio-button--active" type="button" onClick={() => notify('Learning review started in preview')}><Icon name="spark" size={14} /> Review candidates</button>)}
      <div className="learning-grid">{learningSignals.map(([kind, title, evidence, state]) => <button type="button" key={title} className="platform-card learning-card" onClick={() => notify(`${title} selected`)}><span className="eyebrow">{kind}</span><strong>{title}</strong><span>{evidence}</span><span className="state-pill state-pill--pending">{state}</span></button>)}</div>
      <Panel title="Safety boundary"><div className="callout"><Icon name="shield" size={14} /><span>Learning candidates remain drafts until a human or explicit runtime policy accepts them; no silent prompt, memory or skill mutation is performed by this UI.</span></div><div className="platform-actions"><button className="studio-button" type="button" onClick={() => notify('Candidate diff opened in preview')}>View proposed diff</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Candidate approval staged in preview')}>Approve candidate</button></div></Panel>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'plugins') return (
    <Shell>
      {renderHeader('Extension plane', 'Plugins', 'Discover packaged capabilities, inspect their tool surface and toggle local availability.', <button className="studio-button studio-button--active" type="button" onClick={() => notify('Plugin browser opened in preview')}><Icon name="plus" size={14} /> Add plugin</button>)}
      <div className="plugin-grid">{plugins.map(([name, detail, tools, category, enabled]) => <button type="button" key={name} className={`platform-card plugin-card ${enabled ? 'platform-card--active' : ''}`} onClick={() => setSelectedPlugin(name)}><div className="plugin-card__icon"><Icon name="tool" size={17} /></div><div><strong>{name}</strong><span>{detail}</span><small>{category} · {tools}</small></div><span className={`state-pill state-pill--${enabled ? 'active' : 'pending'}`}>{enabled ? 'Enabled' : 'Disabled'}</span></button>)}</div>
      <Panel title={selectedPlugin}><div className="platform-grid platform-grid--2"><Metric label="Capability scope" value="Explicit" /><Metric label="Credentials" value="External" /><Metric label="Updates" value="Review" /><Metric label="Source trust" value="Pinned" /></div><div className="platform-actions"><button className="studio-button" type="button" onClick={() => notify('Plugin manifest opened in preview')}>Inspect manifest</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Plugin toggle staged in preview')}>Enable / disable</button></div></Panel>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'hooks') return (
    <Shell>
      <HookManager onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'execution') return (
    <Shell>
      {renderHeader('Code execution', 'Execution Lab', 'Reproducible execution previews with language, environment, dependencies, stdin and captured output.', <button className="studio-button" type="button" onClick={() => notify('Execution sandbox reset in preview')}><Icon name="history" size={14} /> Reset</button>)}
      <div className="execution-layout"><Panel title="Program"><div className="execution-toolbar"><span className="mono-text">sandbox · no live execution</span><select className="settings-input" defaultValue="Python"><option>Python</option><option>Node.js</option><option>Rust</option><option>Shell</option></select></div><textarea className="execution-editor" defaultValue={'print("AgentiCOS execution preview")\nfor i in range(3):\n    print(i)'} aria-label="Execution editor" /><div className="platform-actions"><button className="studio-button studio-button--active" type="button" onClick={() => notify('Execution staged in preview')}><Icon name="play" size={14} /> Run preview</button><button className="studio-button" type="button" onClick={() => notify('Dependencies configuration opened in preview')}>Dependencies</button></div></Panel><Panel title="Output"><pre className="execution-output">$ sandbox\nAgentiCOS execution preview\n0\n1\n2\n\nexit: 0 (preview)</pre><div className="callout"><Icon name="shield" size={14} /><span>Execution UI never runs code in the browser. A future runtime contract must provide the sandbox and policy boundary.</span></div></Panel></div>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'environments') return (
    <Shell>
      <EnvironmentBuilder onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'integrations') return (
    <Shell>
      {renderHeader('Source control', 'Source Integrations', 'Repository providers and engineering systems that can participate in agent projects and handoffs.', <button className="studio-button" type="button" onClick={() => notify('Integration picker opened in preview')}><Icon name="plus" size={14} /> Add integration</button>)}
      <div className="integration-grid">{integrations.map(([name, role, state, detail]) => <button type="button" key={name} className={`platform-card integration-card ${integration === name ? 'platform-card--active' : ''}`} onClick={() => setIntegration(name)}><div className="integration-card__icon"><Icon name="git" size={17} /></div><div><strong>{name}</strong><span>{role}</span><small>{detail}</small></div><span className="state-pill state-pill--pending">{state}</span></button>)}</div>
      <Panel title={integration}><div className="platform-grid platform-grid--2"><Metric label="Auth" value="OAuth preview" /><Metric label="Repositories" value="Scoped" /><Metric label="Webhooks" value="Optional" /><Metric label="Handoff" value="Branch / PR preview" /></div><div className="platform-actions"><button className="studio-button" type="button" onClick={() => notify('Integration auth opened in preview')}>Authenticate</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Integration test staged in preview')}><Icon name="check" size={14} /> Test connection</button></div></Panel>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'projects') return (
    <Shell>
      {renderHeader('Workspace orchestration', 'Projects', 'Project-level context, branches, tasks and linked workspaces.', <button className="studio-button" type="button" onClick={() => notify('Project creation opened in preview')}><Icon name="plus" size={14} /> New project</button>)}
      <div className="project-grid">{projects.map((project) => <button key={project.id} type="button" className={`platform-card project-card ${selectedProject === project.id ? 'platform-card--active' : ''}`} onClick={() => setSelectedProject(project.id)}><div className="project-card__icon"><Icon name="folder" size={18} /></div><div><strong>{project.title}</strong><span>{project.detail}</span><small>{project.meta}</small></div><em>{project.state}</em></button>)}</div>
      <div className="platform-grid platform-grid--2"><Panel title="Project context"><Metric label="Open files" value="8" /><Metric label="Pinned memories" value="5" /><Metric label="Active tasks" value="3" /><div className="platform-actions"><button className="studio-button" type="button" onClick={() => notify('Project context pack rebuilt in preview')}>Rebuild context pack</button><button className="studio-button" type="button" onClick={() => notify('Project task created in preview')}>Create task</button></div></Panel><Panel title="Branches & worktrees"><List items={['main · protected', 'feature/frontend-platform · active', 'worktree/cloud-042 · background agent', 'review/bugbot-118 · review']} /><button className="studio-button" type="button" onClick={() => notify('New isolated worktree staged in preview')}><Icon name="branch" size={14} /> New worktree</button></Panel></div>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'codebase') return (
    <Shell>
      {renderHeader('Code intelligence', 'Codebase Index', 'Semantic repository search, incremental indexing and a model-aware workspace map.', <><button className="studio-button" type="button" onClick={() => notify('Index refresh queued in preview')}><Icon name="history" size={14} /> Refresh index</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Re-index scope opened in preview')}>Configure</button></>)}
      <div className="platform-metrics"><MetricCard label="Index coverage" value="97.4%" sub="preview · 1,842 files" /><MetricCard label="Last sync" value="18s" sub="incremental update" /><MetricCard label="Search quality" value="High" sub="semantic + lexical" /><MetricCard label="Changed chunks" value="14" sub="since last index" /></div>
      <div className="platform-grid platform-grid--2"><Panel title="Search codebase"><input className="global-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search symbols, files, concepts…" /><div className="index-result-list">{filteredIndex.map(([name, kind, relevance, matches]) => <button type="button" className="index-result-row" key={name} onClick={() => notify(`Opened ${name} in editor preview`)}><div><strong>{name}</strong><span>{kind} · {relevance}</span></div><small>{matches}</small><Icon name="chevron-right" size={14} /></button>)}</div></Panel><Panel title="Index strategy"><div className="strategy-stack"><div><span>Incremental hashing</span><strong>Enabled</strong></div><div><span>Semantic chunks</span><strong>Auto</strong></div><div><span>Ignored paths</span><strong>node_modules · target · .git</strong></div><div><span>Privacy</span><strong>Local/controlled</strong></div></div><div className="callout"><Icon name="shield" size={14} /><span>Only files inside the workspace are eligible for preview search.</span></div></Panel></div>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'context') return (
    <Shell>
      <ContextInspector onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'rules') return (
    <Shell>
      {renderHeader('Instruction plane', 'Rules & Instructions', 'Manage project rules, path-scoped behavior, AGENTS.md, SOUL and user-profile context.', <button className="studio-button" type="button" onClick={() => notify('Rule saved to local preview')}><Icon name="check" size={14} /> Save rule</button>)}
      <div className="rule-layout"><div className="rule-list">{ruleSources.map(([name, detail, scope]) => <button className={`rule-row ${selectedRule === name ? 'rule-row--active' : ''}`} key={name} type="button" onClick={() => setSelectedRule(name)}><div><strong>{name}</strong><span>{detail}</span></div><small>{scope}</small></button>)}</div><div className="rule-editor"><div className="rule-editor__top"><span>{selectedRule}</span><span className="state-pill state-pill--completed">Loaded</span></div><textarea value={ruleText} onChange={(event) => setRuleText(event.target.value)} aria-label="Rule editor" /><div className="rule-editor__foot"><span>Precedence: project → path → session</span><button className="studio-button" type="button" onClick={() => notify('Rule preview compiled')}>Preview instructions</button></div></div></div>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'background') return (
    <Shell>
      {renderHeader('Long-running execution', 'Background Agents', 'Cloud-style isolated agents with worktrees, logs, artifacts and handoff status.', <button className="studio-button studio-button--active" type="button" onClick={() => notify('New background task staged in preview')}><Icon name="cloud" size={14} /> New background task</button>)}
      <div className="background-layout"><div className="job-list">{backgroundJobs.map(([id, title, agent, state, age, worktree]) => <button type="button" key={id} className={`job-row ${selectedJob === id ? 'job-row--active' : ''}`} onClick={() => setSelectedJob(id)}><span className="job-icon"><Icon name="cloud" size={15} /></span><div><strong>{title}</strong><span>{id} · {agent} · {worktree}</span></div><small>{age}</small><span className={`state-pill state-pill--${state === 'working' ? 'active' : state === 'complete' ? 'completed' : 'pending'}`}>{state}</span></button>)}</div><Panel title={selectedJob}><div className="agent-run-banner"><Icon name="bot" size={18} /><div><strong>Isolated workspace</strong><span>worktree/{selectedJob.toLowerCase()} · sandboxed preview</span></div><span className="status-dot status-dot--live" /></div><div className="run-step-list">{['Plan task', 'Inspect repository', 'Edit files', 'Run tests', 'Collect artifacts', 'Prepare handoff'].map((step, index) => <div key={step} className="run-step"><span>0{index+1}</span><div><strong>{step}</strong><small>{index < 3 ? 'completed' : index === 3 ? 'running' : 'queued'}</small></div>{index < 3 ? <Icon name="check" size={13} /> : <span className="status-dot status-dot--offline" />}</div>)}</div><div className="platform-actions"><button className="studio-button" type="button" onClick={() => notify('Agent paused in preview')}><Icon name="stop" size={14} /> Pause</button><button className="studio-button" type="button" onClick={() => notify('Agent logs opened in preview')}>View logs</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Agent handoff opened in preview')}>Inspect handoff</button></div></Panel></div>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'reviews') return (
    <Shell>
      <GitDiffCenter onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'checkpoints') return (
    <Shell>
      {renderHeader('Safety net', 'Checkpoints', 'Local snapshots and restore previews around agent edits, reviews and risky operations.', <button className="studio-button" type="button" onClick={() => notify('Checkpoint captured in preview')}><Icon name="git" size={14} /> Capture checkpoint</button>)}
      <div className="checkpoint-layout"><div className="checkpoint-list">{checkpoints.map(([id, title, age, sha], index) => <button key={id} type="button" className={`checkpoint-row ${index === 0 ? 'checkpoint-row--active' : ''}`} onClick={() => notify(`${id} selected`)}><span>{id}</span><div><strong>{title}</strong><small>{age}</small></div><code>{sha}</code></button>)}</div><Panel title="Checkpoint CP-028"><div className="checkpoint-compare"><div><span>Files changed</span><strong>4</strong></div><div><span>Added</span><strong>38</strong></div><div><span>Removed</span><strong>11</strong></div><div><span>Rollback</span><strong>Available</strong></div></div><pre className="diff-preview-block">@@ frontend/src/App.tsx
+ navigationItems centralize platform modes
@@ frontend/src/components/ChatSurface.tsx
+ context references and agent actions</pre><div className="platform-actions"><button className="studio-button" type="button" onClick={() => notify('Checkpoint diff opened in preview')}>View diff</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Restore confirmation opened in preview')}><Icon name="history" size={14} /> Restore preview</button></div></Panel></div>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'bots') return (
    <Shell>
      {renderHeader('Multi-agent orchestration', 'Bots & Teams', 'Named specialist bots with roles, routines, mentions and isolated capabilities.', <button className="studio-button studio-button--active" type="button" onClick={() => notify('New specialist bot opened in preview')}><Icon name="bot" size={14} /> New bot</button>)}
      <div className="bot-grid">{bots.map(([name, role, tools, model, state]) => <button type="button" key={name} className="platform-card bot-card" onClick={() => notify(`${name} selected`)}><div className="bot-avatar"><Icon name="bot" size={18} /></div><div><strong>{name}</strong><span>{role}</span><small>{model} · {tools}</small></div><span className={`state-pill state-pill--${state === 'Online' ? 'active' : 'pending'}`}>{state}</span></button>)}</div>
      <div className="platform-grid platform-grid--2"><Panel title="Team routines"><List items={['@Builder implement the selected task', '@Reviewer inspect the resulting diff', '@Researcher verify external claims', '@Release Bot prepare evidence package']} /><button className="studio-button" type="button" onClick={() => notify('Routine editor opened in preview')}>Edit routine</button></Panel><Panel title="Delegation policy"><Metric label="Parallel workers" value="4" /><Metric label="Context isolation" value="Strict" /><Metric label="Shared artifacts" value="Allowed" /><Metric label="Human gate" value="Sensitive only" /></Panel></div>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'automations') return (
    <Shell>
      <AutomationBuilder onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'channels') return (
    <Shell>
      <ChannelGatewayManager onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'browser') return (
    <Shell>
      {renderHeader('Web control', 'Browser', 'Interactive browser workspace for navigation, DOM inspection, console output, network events and session state.', <button className="studio-button studio-button--active" type="button" onClick={() => notify('New browser session staged in preview')}><Icon name="plus" size={14} /> New session</button>)}
      <BrowserWorkspace onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'voice') return (
    <Shell>
      {renderHeader('Multimodal', 'Voice & Media', 'Voice mode, transcription, text-to-speech and visual inputs as one agent surface.', <button className={`studio-button ${voiceMode ? 'studio-button--active' : ''}`} type="button" onClick={() => setVoiceMode((value) => !value)}><Icon name="mic" size={14} /> {voiceMode ? 'Voice enabled' : 'Voice disabled'}</button>)}
      <div className="voice-layout"><Panel title="Voice session"><div className="voice-orb"><Icon name="mic" size={30} /></div><strong>Ready for voice input</strong><span>Push-to-talk, transcription and streaming responses are represented as local UI state.</span><div className="waveform">{[18,42,26,62,38,78,34,55,25,48,31,66,24,50,39,72].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div><button className="studio-button studio-button--active" type="button" onClick={() => notify('Recording staged in preview')}>{voiceMode ? 'Start recording' : 'Enable voice first'}</button></Panel><Panel title="Transcript & media"><div className="transcript"><span className="mono-text">00:00:03</span><p>User: Inspect the latest frontend change and explain what still needs verification.</p><span className="mono-text">00:00:08</span><p>AgentiCOS: The UI changes are local/preview until runtime contracts are added.</p></div><div className="media-row"><Tag label="image input" /><Tag label="document input" /><Tag label="audio input" /><Tag label="TTS output" /></div></Panel></div>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'research') return (
    <Shell>
      <ResearchWorkbench onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'mcp') return (
    <Shell>
      <McpManager onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  return (
    <Shell>
      {renderHeader('Security boundary', 'Security Center', 'Human approvals, sandboxing, secret hygiene, network permissions and data controls.', <button className="studio-button studio-button--active" type="button" onClick={() => notify('Security policy saved in local preview')}><Icon name="shield" size={14} /> Save policy</button>)}
      <div className="security-banner"><div><strong>Fail-closed execution</strong><span>Presentation policy only until runtime enforcement is connected.</span></div><span className="state-pill state-pill--completed">Protected</span></div>
      <div className="security-grid">{securityPolicies.map(([name, detail]) => <div className="security-row" key={name}><div><strong>{name}</strong><span>{detail}</span></div><button className={`switch ${enabledPolicies.has(name) ? 'switch--on' : ''}`} type="button" role="switch" aria-checked={enabledPolicies.has(name)} onClick={() => toggle(setEnabledPolicies, enabledPolicies, name)}><span /></button></div>)}</div>
      <div className="platform-grid platform-grid--2"><Panel title="Permission tiers"><Metric label="Read operations" value="Auto" /><Metric label="Write operations" value="Confirm" /><Metric label="Network operations" value="Confirm" /><Metric label="Destructive operations" value="Block" /></Panel><Panel title="Data handling"><Metric label="Credentials in UI" value="Never" /><Metric label="Local presentation state" value="Allowed" /><Metric label="Persistent telemetry" value="Off" /><Metric label="Rollback" value="Preferred" /></Panel></div>
      <Toast message={notice} />
    </Shell>
  )
}

function PlatformSurface({ mode }: { mode: PlatformMode }) {
  return (
    <Suspense fallback={
      <section className="surface-loading" aria-live="polite">
        <span className="surface-loading__spinner" />
        <div><strong>Loading workspace feature</strong><small>The selected tool is being loaded on demand.</small></div>
      </section>
    }>
      <PlatformSurfaceContent mode={mode} />
    </Suspense>
  )
}

export default PlatformSurface

