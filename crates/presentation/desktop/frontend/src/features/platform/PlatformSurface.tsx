import React, { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import type { PlatformMode, RailMode } from '../../navigation'
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
const RemoteControlCenter = lazy(() => import('./RemoteControlCenter'))
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
const RunControlCenter = lazy(() => import('./RunControlCenter'))
const MemoryStudio = lazy(() => import('./MemoryStudio'))
const ToolPolicyStudio = lazy(() => import('./ToolPolicyStudio'))
const WorkflowStudio = lazy(() => import('./WorkflowStudio'))
const FrontendCompletenessStudio = lazy(() => import('./FrontendCompletenessStudio').then((module) => ({ default: module.FrontendCompletenessStudio })))
const FinalControlSuite = lazy(() => import('./FinalControlSuite').then((module) => ({ default: module.FinalControlSuite })))
const GitControlCenter = lazy(() => import('./GitControlCenter').then((module) => ({ default: module.GitControlCenter })))
const DeveloperWorkspace = lazy(() => import('./DeveloperWorkspace').then((module) => ({ default: module.DeveloperWorkspace })))
const SessionReplayStudio = lazy(() => import('./SessionReplayStudio').then((module) => ({ default: module.SessionReplayStudio })))
const EvidenceArtifactInspector = lazy(() => import('./EvidenceArtifactInspector').then((module) => ({ default: module.EvidenceArtifactInspector })))
const ProjectControlCenter = lazy(() => import('./ProjectControlCenter').then((module) => ({ default: module.ProjectControlCenter })))
const IntelligenceControlCenter = lazy(() => import('./IntelligenceControlCenter').then((module) => ({ default: module.IntelligenceControlCenter })))
const GovernanceControlCenter = lazy(() => import('./GovernanceControlCenter').then((module) => ({ default: module.GovernanceControlCenter })))
const IntegrationControlCenter = lazy(() => import('./IntegrationControlCenter').then((module) => ({ default: module.IntegrationControlCenter })))
const ModelControlCenter = lazy(() => import('./ModelControlCenter').then((module) => ({ default: module.ModelControlCenter })))
const QualityWorkbench = lazy(() => import('./QualityWorkbench').then((module) => ({ default: module.QualityWorkbench })))
const NavigationCenter = lazy(() => import('./NavigationCenter').then((module) => ({ default: module.NavigationCenter })))
const FrontendCoverageStudio = lazy(() => import('./FrontendCoverageStudio').then((module) => ({ default: module.FrontendCoverageStudio })))
const CollaborationReviewCenter = lazy(() => import('./CollaborationReviewCenter').then((module) => ({ default: module.CollaborationReviewCenter })))
const DesignSystemStudio = lazy(() => import('./DesignSystemStudio').then((module) => ({ default: module.DesignSystemStudio })))
const AgentArena = lazy(() => import('./AgentArena').then((module) => ({ default: module.AgentArena })))
const FrontendStateMatrix = lazy(() => import('./FrontendStateMatrix').then((module) => ({ default: module.FrontendStateMatrix })))
const VisualAccessibilityLab = lazy(() => import('./VisualAccessibilityLab').then((module) => ({ default: module.VisualAccessibilityLab })))
const EnvironmentLab = lazy(() => import('./EnvironmentLab').then((module) => ({ default: module.EnvironmentLab })))
const TaskExecutionCenter = lazy(() => import('./TaskExecutionCenter').then((module) => ({ default: module.TaskExecutionCenter })))
const AgentMissionControl = lazy(() => import('./AgentMissionControl').then((module) => ({ default: module.AgentMissionControl })))
const KnowledgeStudio = lazy(() => import('./KnowledgeStudio').then((module) => ({ default: module.KnowledgeStudio })))
const FrontendQAHarness = lazy(() => import('./FrontendQAHarness').then((module) => ({ default: module.FrontendQAHarness })))
const FeatureWorkbench = lazy(() => import('./FeatureWorkbench'))
const GENERIC_FEATURE_MODES: ReadonlySet<PlatformMode> = new Set<PlatformMode>([
  'evaluations', 'versions', 'audit', 'notifications', 'sessions', 'logs', 'analytics',
  'batch', 'learning', 'playground', 'routing', 'token-observatory', 'toolsets', 'execution',
  'webhooks', 'imports', 'media', 'wake',
])

const ProviderStudio = lazy(() => import('../providers/ProviderStudio'))
const SkillsStudio = lazy(() => import('../skills/SkillsStudio'))
const ToolsStudio = lazy(() => import('../tools/ToolsStudio'))
const WorkflowBuilder = lazy(() => import('../workflows/WorkflowBuilder'))
import './FinalControlSuite.css'
import './KnowledgeStudio.css'
import './DeveloperWorkspace.css'
import './AgentMissionControl.css'
import './TaskExecutionCenter.css'
import './SessionReplayStudio.css'
import './EvidenceArtifactInspector.css'
import './EnvironmentLab.css'
import './AgentArena.css'
import './CollaborationReviewCenter.css'
import './FrontendCoverageStudio.css'
import './NavigationCenter.css'
import './QualityWorkbench.css'
import './ModelControlCenter.css'
import './IntegrationControlCenter.css'
import './GovernanceControlCenter.css'
import './IntelligenceControlCenter.css'
import './ProjectControlCenter.css'
import './RemoteControlCenter.css'
import './DesignSystemStudio.css'
import './FrontendStateMatrix.css'
import './VisualAccessibilityLab.css'
import './GitControlCenter.css'

import { projects, indexEntries, ruleSources, backgroundJobs, checkpoints, bots, integrations, evaluationRuns } from './platformData'
import { Shell, Panel, Metric, MetricCard, List, Tag, Toast } from './PlatformPrimitives'

function PlatformSurfaceContent({ mode, onNavigate }: { mode: PlatformMode; onNavigate?: (mode: RailMode) => void }) {
  const [query, setQuery] = useState('')
  const [selectedProject, setSelectedProject] = useState(projects[0].id)
  const [selectedJob, setSelectedJob] = useState(backgroundJobs[0][0])
  const [selectedRule, setSelectedRule] = useState(ruleSources[0][0])
  const [ruleText, setRuleText] = useState('Prefer reversible changes. Preserve runtime contracts. Verify every implementation slice before advancing state.')
  const [voiceMode, setVoiceMode] = useState(true)
  const [integration, setIntegration] = useState(integrations[0][0])
  const [notice, setNotice] = useState('')

  function notify(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2200)
  }

  if (mode === 'teams' || mode === 'advanced-context' || mode === 'usage' || mode === 'observability' || mode === 'release' || mode === 'customization' || mode === 'help' || mode === 'recovery') {
    return (
      <Shell>
        <FinalControlSuite mode={mode === 'advanced-context' ? 'context' : mode} onAction={notify} />
        <Toast message={notice} />
      </Shell>
    )
  }

  if (mode === 'qa') {
    return (
      <Shell>
        <FrontendQAHarness onAction={notify} />
        <Toast message={notice} />
      </Shell>
    )
  }

  if (mode === 'plugins' || mode === 'onboarding') {
    return (
      <Shell>
        <FrontendCompletenessStudio mode={mode} onAction={notify} />
        <Toast message={notice} />
      </Shell>
    )
  }

  if (mode === 'overview') return (
    <Shell>
      <WorkspaceOverview onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'tasks') return (
    <Shell>
      <TaskExecutionCenter onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'providers') return (
    <Shell>
      <ProviderStudio onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'skills') return (
    <Shell>
      <SkillsStudio onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'permissions') return (
    <Shell>
      <PermissionsMatrix onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'canvas') return (
    <Shell>
      <CanvasStudio onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'commands') return (
    <Shell>
      <CommandStudio onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'subagents') return (
    <Shell>
      <SubagentFleet onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'cloud') return (
    <Shell>
      <CloudAgentsWorkspace onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'remote-control') return (
    <Shell>
      <RemoteControlCenter onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'computer') return (
    <Shell>
      <ComputerUseWorkspace onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'operations') return (
    <Shell>
      <OperationsCenter onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'kanban') return (
    <Shell>
      <KanbanBoard onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'credentials') return (
    <Shell>
      <CredentialManager onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'hooks') return (
    <Shell>
      <HookManager onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'marketplace') return (
    <Shell>
      <MarketplaceStudio onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'security') return (
    <Shell>
      <SecurityCenter onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'homeassistant' || mode === 'social') return (
    <Shell>
      <IntegrationCatalogSurface mode={mode} onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (GENERIC_FEATURE_MODES.has(mode)) return (
    <Shell>
      <FeatureWorkbench mode={mode} onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

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




  if (mode === 'git-control') return (
    <Shell>
      <GitControlCenter onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'project-control') return (<Shell><ProjectControlCenter onAction={notify} /><Toast message={notice} /></Shell>)

  if (mode === 'intelligence-control') return (<Shell><IntelligenceControlCenter onAction={notify} /><Toast message={notice} /></Shell>)

  if (mode === 'governance-control') return (<Shell><GovernanceControlCenter onAction={notify} /><Toast message={notice} /></Shell>)

  if (mode === 'integration-control') return (<Shell><IntegrationControlCenter onAction={notify} /><Toast message={notice} /></Shell>)

  if (mode === 'model-control') return (<Shell><ModelControlCenter onAction={notify} /><Toast message={notice} /></Shell>)

  if (mode === 'quality-workbench') return (<Shell><QualityWorkbench onAction={notify} /><Toast message={notice} /></Shell>)

  if (mode === 'navigation-center') return (<Shell><NavigationCenter active={mode} onChange={(nextMode) => onNavigate?.(nextMode)} /><Toast message={notice} /></Shell>)

  if (mode === 'frontend-coverage') return (<Shell><FrontendCoverageStudio onAction={notify} /><Toast message={notice} /></Shell>)

  if (mode === 'collaboration-review') return (<Shell><CollaborationReviewCenter onAction={notify} /><Toast message={notice} /></Shell>)

  if (mode === 'design-system') return (<Shell><DesignSystemStudio onAction={notify} /><Toast message={notice} /></Shell>)

  if (mode === 'agent-arena') return (<Shell><AgentArena onAction={notify} /><Toast message={notice} /></Shell>)

  if (mode === 'frontend-state-matrix') return (<Shell><FrontendStateMatrix onAction={notify} /><Toast message={notice} /></Shell>)

  if (mode === 'visual-accessibility-lab') return (<Shell><VisualAccessibilityLab onAction={notify} /><Toast message={notice} /></Shell>)

  if (mode === 'session-replay') return (<Shell><SessionReplayStudio onAction={notify} /><Toast message={notice} /></Shell>)

  if (mode === 'evidence-inspector') return (<Shell><EvidenceArtifactInspector onAction={notify} /><Toast message={notice} /></Shell>)

  if (mode === 'environment-lab') return (<Shell><EnvironmentLab onAction={notify} /><Toast message={notice} /></Shell>)

  if (mode === 'task-execution') return (
    <Shell>
      <TaskExecutionCenter onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'agent-mission') return (
    <Shell>
      <AgentMissionControl onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'developer-workspace') return (
    <Shell>
      <DeveloperWorkspace onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'knowledge') return (
    <Shell>
      <KnowledgeStudio onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'memory') return (
    <Shell>
      {renderHeader('Persistent context', 'Memory Studio', 'Inspect semantic, episodic and workspace memory with provenance, retention and conflict policies.', <span className="state-pill state-pill--pending">Preview</span>)}
      <MemoryStudio onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'tools') return (
    <Shell>
      {renderHeader('Capability governance', 'Tool Policy Studio', 'Define tool profiles, scopes, risk levels, approvals and fail-closed execution boundaries.', <span className="state-pill state-pill--pending">Preview</span>)}
      <ToolPolicyStudio onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'workflows') return (
    <Shell>
      {renderHeader('Agent orchestration', 'Workflow Studio', 'Compose bounded graphs with agents, subagents, conditions, parallel branches, human gates and recovery.', <span className="state-pill state-pill--pending">Preview</span>)}
      <WorkflowStudio onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )

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
      <FeatureWorkbench mode={mode} onAction={notify} />
      <Toast message={notice} />
    </Shell>
  )
}

class SurfaceErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('AgentiCOS platform surface failed to render', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="surface-error" role="alert">
          <div className="surface-error__icon"><Icon name="alert" size={18} /></div>
          <div>
            <strong>Workspace feature could not be rendered</strong>
            <small>The frontend kept the failure isolated. Retry the surface or return to another workspace area.</small>
          </div>
          <button className="studio-button" type="button" onClick={() => this.setState({ hasError: false })}>Retry</button>
        </section>
      )
    }
    return this.props.children
  }
}

function PlatformSurface({ mode, onNavigate }: { mode: PlatformMode; onNavigate?: (mode: RailMode) => void }) {
  return (
    <SurfaceErrorBoundary>
      <Suspense fallback={
      <section className="surface-loading" aria-live="polite">
        <span className="surface-loading__spinner" />
        <div><strong>Loading workspace feature</strong><small>The selected tool is being loaded on demand.</small></div>
      </section>
    }>
        <PlatformSurfaceContent mode={mode} onNavigate={onNavigate} />
      </Suspense>
    </SurfaceErrorBoundary>
  )
}

export default PlatformSurface

