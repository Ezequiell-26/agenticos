import { useMemo, useState, type ReactNode } from 'react'
import type { RailMode } from '../../navigation'
import Icon from '../../components/Icon'

type PlatformMode = Extract<RailMode,
  | 'projects' | 'codebase' | 'context' | 'rules' | 'background' | 'reviews'
  | 'checkpoints' | 'bots' | 'automations' | 'channels' | 'browser'
  | 'voice' | 'research' | 'batch' | 'learning' | 'mcp' | 'plugins' | 'hooks' | 'execution' | 'environments' | 'integrations' | 'security'
>

type Item = { id: string; title: string; detail: string; meta?: string; state?: string }

const projects: Item[] = [
  { id: 'agenticos', title: 'AgentiCOS', detail: 'Rust runtime + Tauri desktop + React frontend', meta: 'main · clean preview', state: 'Active' },
  { id: 'ccos', title: 'CCOS', detail: 'C++ / Qt video editor workspace', meta: 'feature/editor', state: 'Linked' },
  { id: 'kinetix', title: 'KinetixFitt', detail: 'Fitness product workspace', meta: 'mobile + web', state: 'Linked' },
]

const indexEntries = [
  ['App.tsx', 'component', 'High relevance', '12 matches'],
  ['navigation.ts', 'architecture', 'High relevance', '9 matches'],
  ['StudioSurface.tsx', 'component', 'Medium relevance', '24 matches'],
  ['SettingsSurface.tsx', 'component', 'Medium relevance', '17 matches'],
  ['provider_plane_integration.rs', 'test', 'Medium relevance', '8 matches'],
  ['FRONTEND-ARCHITECTURE.md', 'docs', 'High relevance', '6 matches'],
]

const contextSources: ReadonlyArray<[string, string, string, boolean]> = [
  ['Workspace files', 'Source tree + project manifests', '42.8k', true],
  ['Open files', 'Currently active editor tabs', '8.4k', true],
  ['Git diff', 'Uncommitted or selected changes', '5.1k', true],
  ['Project rules', 'AGENTS.md + .cursor/rules + local instructions', '3.2k', true],
  ['Pinned memory', 'Curated persistent knowledge', '2.7k', true],
  ['Session history', 'Relevant previous conversations', '6.9k', false],
  ['Web sources', 'URLs and search extracts', '11.4k', false],
]

const ruleSources = [
  ['AGENTS.md', 'Project-wide agent instructions', 'Always'],
  ['.cursor/rules', 'Path-scoped project rules', 'Relevant'],
  ['.hermes.md', 'Hermes-compatible project context', 'Relevant'],
  ['SOUL.md', 'Agent identity and personality', 'Session'],
  ['USER.md', 'Persistent user profile', 'Session'],
  ['Workspace policy', 'Local safety and verification policy', 'Always'],
]

const backgroundJobs: ReadonlyArray<[string, string, string, string, string, string]> = [
  ['CLOUD-042', 'Implement provider failover UI', 'Builder', 'working', '12m', 'worktree/cloud-042'],
  ['CLOUD-039', 'Review frontend regression risk', 'Reviewer', 'waiting', '7m', 'worktree/cloud-039'],
  ['CLOUD-031', 'Research free-tier provider options', 'Researcher', 'complete', '23m', 'worktree/cloud-031'],
]

const reviewItems = [
  ['BUG-118', 'Possible unguarded state mutation', 'High', 'StudioSurface.tsx:184'],
  ['BUG-117', 'Missing keyboard focus restoration', 'Medium', 'CommandPalette.tsx:92'],
  ['BUG-116', 'Unverified preview copy could be clearer', 'Low', 'Observability'],
  ['BUG-112', 'Provider health should be runtime-owned', 'Medium', 'ProviderDashboard.tsx'],
]

const checkpoints = [
  ['CP-028', 'Before provider routing changes', '2m ago', '19bc9d3'],
  ['CP-027', 'Before settings expansion', '31m ago', 'a930b58'],
  ['CP-026', 'Before chat controls', '58m ago', 'df130b4'],
  ['CP-025', 'Command Center baseline', '2h ago', '988cc8b'],
]

const bots = [
  ['Builder', 'Implementation', '18 tools', 'Qwen3 Coder', 'Online'],
  ['Reviewer', 'Quality', '11 tools', 'GPT-OSS 120B', 'Online'],
  ['Researcher', 'Evidence', '9 tools', 'DeepSeek', 'Idle'],
  ['Release Bot', 'CI / release', '13 tools', 'Auto route', 'Scheduled'],
]

const automations = [
  ['Frontend regression scan', 'Every 6 hours', 'Git change trigger', 'Enabled'],
  ['Nightly repository audit', '02:30', 'Cron', 'Enabled'],
  ['Weekly dependency report', 'Mon 09:00', 'Cron', 'Paused'],
  ['Release evidence pack', 'On release tag', 'Webhook', 'Ready'],
]

const channels = [
  ['Desktop', 'Native app', 'Connected', 'Local session'],
  ['Telegram', 'Gateway', 'Preview', 'Delivery not connected'],
  ['Discord', 'Gateway', 'Preview', 'Delivery not connected'],
  ['Slack', 'Gateway', 'Preview', 'Delivery not connected'],
  ['WhatsApp', 'Gateway', 'Preview', 'Delivery not connected'],
  ['Email', 'Gateway', 'Preview', 'SMTP not connected'],
]

const researchBatches = [
  ['BATCH-014', 'Compare agent runtimes', '24 inputs', 'Queued'],
  ['BATCH-013', 'Provider free-tier audit', '18 inputs', 'Complete'],
  ['BATCH-012', 'Frontend UX benchmark', '12 inputs', 'Complete'],
]

const batchJobs: ReadonlyArray<[string, string, string, string]> = [
  ['BATCH-014', 'Frontend screenshot audit', '48 inputs · concurrency 6', 'Running'],
  ['BATCH-013', 'Provider metadata normalization', '18 inputs · concurrency 4', 'Complete'],
  ['BATCH-012', 'Documentation link validation', '62 inputs · concurrency 8', 'Queued'],
]

const learningSignals: ReadonlyArray<[string, string, string, string]> = [
  ['Skill candidate', 'frontend-regression-review', '4 supporting runs', 'Draft'],
  ['Memory candidate', 'Preferred fail-closed workflow', '3 supporting sessions', 'Ready'],
  ['Prompt improvement', 'Architecture planning checklist', '12% fewer retries', 'Suggested'],
]

const plugins: ReadonlyArray<[string, string, string, string, boolean]> = [
  ['GitHub Toolkit', 'Source control and PR workflows', '18 tools', 'Repository', true],
  ['Browser Operator', 'Browser automation and visual verification', '7 tools', 'Automation', true],
  ['Research Pack', 'Web sources and evidence workflows', '9 tools', 'Research', false],
  ['Media Pack', 'Vision, TTS and image/video surfaces', '6 tools', 'Media', false],
]

const hooks: ReadonlyArray<[string, string, string, boolean]> = [
  ['before-run', 'Validate policy, context and approvals', 'Execution', true],
  ['before-tool', 'Check risk and tool allowlist', 'Security', true],
  ['after-tool', 'Record outcome and artifact references', 'Telemetry', true],
  ['on-error', 'Capture evidence and propose recovery', 'Recovery', true],
  ['after-run', 'Compile summary and handoff package', 'Lifecycle', false],
]

const environments: ReadonlyArray<[string, string, string, string]> = [
  ['Local Desktop', 'Tauri workstation', 'Node 22 · Rust stable', 'Ready'],
  ['Linux Builder', 'Containerized build environment', 'Ubuntu · cached toolchain', 'Preview'],
  ['Agent VM', 'Isolated long-running environment', 'Dockerfile / snapshot', 'Preview'],
]

const integrations: ReadonlyArray<[string, string, string, string]> = [
  ['GitHub', 'Repository + PR', 'Connected', 'Read / write via runtime'],
  ['GitLab', 'Repository', 'Available', 'OAuth preview'],
  ['Azure DevOps', 'Repository + work items', 'Available', 'OAuth preview'],
  ['Linear', 'Issues + projects', 'Preview', 'API not connected'],
]

const mcpServers = [
  ['filesystem', 'Local files', '12 tools', 'Connected'],
  ['browser', 'Browser automation', '7 tools', 'Preview'],
  ['github', 'GitHub operations', '18 tools', 'Connected'],
  ['search', 'Web search', '5 tools', 'Preview'],
  ['database', 'External data source', '8 tools', 'Disabled'],
]

const securityPolicies: ReadonlyArray<[string, string, boolean]> = [
  ['Fail-closed execution', 'Sensitive actions stop until explicitly approved', true],
  ['Workspace sandbox', 'Commands are scoped to the selected workspace', true],
  ['Network approval', 'Outbound network access requires policy permission', true],
  ['Secret redaction', 'Hide API keys and credential-like values from UI', true],
  ['Destructive confirmation', 'Delete, reset and force actions require confirmation', true],
  ['Telemetry minimization', 'Do not persist local preview telemetry', true],
]

export default function PlatformSurface({ mode }: { mode: PlatformMode }) {
  const [query, setQuery] = useState('')
  const [selectedProject, setSelectedProject] = useState(projects[0].id)
  const [selectedJob, setSelectedJob] = useState(backgroundJobs[0][0])
  const [browserUrl, setBrowserUrl] = useState('https://example.local')
  const [browserLog, setBrowserLog] = useState(['session started · isolated preview', 'page loaded · example.local'])
  const [selectedRule, setSelectedRule] = useState(ruleSources[0][0])
  const [ruleText, setRuleText] = useState('Prefer reversible changes. Preserve runtime contracts. Verify every implementation slice before advancing state.')
  const [enabledContext, setEnabledContext] = useState(() => new Set(contextSources.filter((item) => item[3]).map((item) => item[0])))
  const [enabledPolicies, setEnabledPolicies] = useState(() => new Set(securityPolicies.filter((item) => item[2]).map((item) => item[0])))
  const [pausedAutomations, setPausedAutomations] = useState(() => new Set(automations.filter((item) => item[3] === 'Paused').map((item) => item[0])))
  const [selectedMcp, setSelectedMcp] = useState(mcpServers[0][0])
  const [voiceMode, setVoiceMode] = useState(true)
  const [researchBatch, setResearchBatch] = useState(researchBatches[0][0])
  const [batchJob, setBatchJob] = useState(batchJobs[0][0])
  const [selectedPlugin, setSelectedPlugin] = useState(plugins[0][0])
  const [selectedHook, setSelectedHook] = useState(hooks[0][0])
  const [environment, setEnvironment] = useState(environments[0][0])
  const [integration, setIntegration] = useState(integrations[0][0])
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
      {renderHeader('Lifecycle control', 'Hooks & Policies', 'Event-driven middleware for run, tool, error and handoff lifecycle boundaries.', <button className="studio-button" type="button" onClick={() => notify('Hook editor opened in preview')}><Icon name="plus" size={14} /> New hook</button>)}
      <div className="hook-layout"><div className="hook-list">{hooks.map(([name, detail, group, enabled]) => <button type="button" key={name} className={`hook-row ${selectedHook === name ? 'hook-row--active' : ''}`} onClick={() => setSelectedHook(name)}><div><strong>{name}</strong><span>{detail}</span></div><small>{group}</small><span className={`state-pill state-pill--${enabled ? 'active' : 'pending'}`}>{enabled ? 'Enabled' : 'Disabled'}</span></button>)}</div><Panel title={selectedHook}><div className="strategy-stack"><div><span>Order</span><strong>Deterministic</strong></div><div><span>Failure behavior</span><strong>Fail closed</strong></div><div><span>Context</span><strong>Explicit inputs</strong></div><div><span>Persistence</span><strong>Audit reference</strong></div></div><div className="platform-actions"><button className="studio-button" type="button" onClick={() => notify('Hook trace opened in preview')}>Inspect trace</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Hook saved in preview')}><Icon name="check" size={14} /> Save hook</button></div></Panel></div>
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
      {renderHeader('Runtime environments', 'Environments', 'Reusable development environments for local, background and future cloud agents.', <button className="studio-button studio-button--active" type="button" onClick={() => notify('Environment builder opened in preview')}><Icon name="cloud" size={14} /> New environment</button>)}
      <div className="environment-grid">{environments.map(([name, type, stack, state]) => <button type="button" key={name} className={`platform-card environment-card ${environment === name ? 'platform-card--active' : ''}`} onClick={() => setEnvironment(name)}><div><strong>{name}</strong><span>{type}</span><small>{stack}</small></div><span className="state-pill state-pill--pending">{state}</span></button>)}</div>
      <Panel title={environment}><div className="platform-grid platform-grid--2"><Metric label="Setup" value="Dockerfile / script" /><Metric label="Network" value="Allowlist preview" /><Metric label="Secrets" value="External store" /><Metric label="MCP" value="Explicit allowlist" /></div><div className="callout"><Icon name="shield" size={14} /><span>Environment configuration follows the same explicit isolation model as background agents; no credentials are rendered here.</span></div></Panel>
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
      {renderHeader('Prompt context', 'Context', 'Assemble a predictable context pack before an agent run. Values are presentation-only.', <button className="studio-button" type="button" onClick={() => notify('Context pack saved in preview')}><Icon name="check" size={14} /> Save pack</button>)}
      <div className="context-layout"><Panel title="Sources">{contextSources.map(([name, detail, tokens]) => <div className="context-source" key={name}><div><strong>{name}</strong><span>{detail}</span></div><span className="mono-text">{tokens}</span><button className={`switch ${enabledContext.has(name) ? 'switch--on' : ''}`} type="button" role="switch" aria-checked={enabledContext.has(name)} onClick={() => toggle(setEnabledContext, enabledContext, name)}><span /></button></div>)}</Panel><Panel title="Budget"><div className="context-budget"><div className="budget-ring"><strong>{enabledContext.size * 8.1}k</strong><span>estimated</span></div><div className="budget-bar"><span style={{ width: `${Math.min(96, enabledContext.size * 11)}%` }} /></div><div className="budget-rows"><Metric label="Sources" value={String(enabledContext.size)} /><Metric label="Reserved output" value="8k" /><Metric label="Remaining" value="41k" /></div></div><div className="callout"><Icon name="archive" size={14} /><span>Hermes-style context references and Cursor-style codebase context can coexist in one explicit pack.</span></div></Panel></div>
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
      {renderHeader('Quality gate', 'Reviews & Bugbot', 'Automated and human-oriented review surface for diffs, tests, policy findings and fixes.', <><button className="studio-button" type="button" onClick={() => notify('Review scan queued in preview')}><Icon name="history" size={14} /> Scan changes</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Review comment workflow opened in preview')}>Start review</button></>)}
      <div className="review-summary"><Metric label="Open findings" value="4" /><Metric label="High risk" value="1" /><Metric label="Tests requested" value="2" /><Metric label="Files changed" value="7" /></div>
      <div className="review-layout"><div className="review-list">{reviewItems.map(([id, title, severity, location]) => <button key={id} type="button" className="review-row" onClick={() => notify(`${id} selected`)}><span className={`severity severity--${severity.toLowerCase()}`}>{severity}</span><div><strong>{title}</strong><span>{id} · {location}</span></div><Icon name="chevron-right" size={14} /></button>)}</div><Panel title="Selected finding"><div className="finding-card"><span className="severity severity--high">High</span><h2>Possible unguarded state mutation</h2><p>The UI should prefer a local reducer or direct state transition instead of nested updates that can obscure render ordering.</p><pre>StudioSurface.tsx:184</pre><div className="platform-actions"><button className="studio-button" type="button" onClick={() => notify('Finding marked resolved in preview')}>Mark resolved</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Fix task created from review in preview')}><Icon name="spark" size={14} /> Create fix task</button></div></div></Panel></div>
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
      {renderHeader('Schedules & triggers', 'Automations', 'Natural-language or cron-style schedules for recurring agent work.', <button className="studio-button studio-button--active" type="button" onClick={() => notify('Automation builder opened in preview')}><Icon name="calendar" size={14} /> New automation</button>)}
      <div className="automation-table"><div className="automation-head"><span>Name</span><span>Schedule</span><span>Trigger</span><span>Status</span><span /></div>{automations.map(([name, schedule, trigger, state]) => { const paused = pausedAutomations.has(name); return <div className="automation-row" key={name}><div><strong>{name}</strong><span>{paused ? 'paused locally' : 'preview schedule'}</span></div><span>{schedule}</span><span>{trigger}</span><span className={`state-pill state-pill--${paused ? 'pending' : 'active'}`}>{paused ? 'Paused' : state}</span><button className="studio-button" type="button" onClick={() => { toggle(setPausedAutomations, pausedAutomations, name); notify(`${name} toggled in preview`) }}>{paused ? 'Resume' : 'Pause'}</button></div> })}</div>
      <Panel title="Schedule builder"><div className="schedule-builder"><label>Natural language<input className="settings-input" defaultValue="Run a frontend regression scan every 6 hours." /></label><label>Equivalent cron<input className="settings-input" defaultValue="0 */6 * * *" /></label><label>Delivery<select className="settings-input" defaultValue="Workspace notification"><option>Workspace notification</option><option>Channel delivery</option><option>Artifact only</option></select></label></div></Panel>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'channels') return (
    <Shell>
      {renderHeader('Gateway', 'Channels & Gateway', 'One agent session can be exposed to multiple messaging and delivery surfaces.', <button className="studio-button" type="button" onClick={() => notify('Gateway configuration opened in preview')}><Icon name="settings" size={14} /> Configure gateway</button>)}
      <div className="channel-grid">{channels.map(([name, type, state, detail]) => <div className="platform-card channel-card" key={name}><div className="channel-card__icon"><Icon name={name === 'Desktop' ? 'layout' : 'message'} size={17} /></div><div><strong>{name}</strong><span>{type}</span><small>{detail}</small></div><span className={`state-pill state-pill--${state === 'Connected' ? 'active' : 'pending'}`}>{state}</span><button className="studio-button" type="button" onClick={() => notify(`${name} configuration staged in preview`)}>{state === 'Connected' ? 'Manage' : 'Connect'}</button></div>)}</div>
      <Panel title="Gateway capabilities"><div className="capability-grid"><Tag label="session continuity" /><Tag label="voice memo" /><Tag label="scheduled delivery" /><Tag label="mentions" /><Tag label="thread routing" /><Tag label="attachments" /></div></Panel>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'browser') return (
    <Shell>
      {renderHeader('Web control', 'Browser', 'Interactive browser sessions for navigation, scraping, form filling and verification.', <button className="studio-button studio-button--active" type="button" onClick={() => { setBrowserLog((lines) => [...lines, 'new tab opened · isolated preview']); notify('New browser tab opened in preview') }}><Icon name="plus" size={14} /> New tab</button>)}
      <div className="browser-shell"><div className="browser-toolbar"><button className="icon-button" type="button" title="Back" onClick={() => notify('Browser back in preview')}><Icon name="chevron-left" size={15} /></button><button className="icon-button" type="button" title="Forward" onClick={() => notify('Browser forward in preview')}><Icon name="chevron-right" size={15} /></button><button className="icon-button" type="button" title="Refresh" onClick={() => notify('Browser refreshed in preview')}><Icon name="history" size={15} /></button><input value={browserUrl} onChange={(event) => setBrowserUrl(event.target.value)} aria-label="Browser URL" /><button className="studio-button studio-button--active" type="button" onClick={() => { setBrowserLog((lines) => [...lines, `navigate · ${browserUrl}`]); notify('Navigation recorded in preview') }}>Go</button></div><div className="browser-body"><div className="browser-preview"><div className="browser-preview__top"><span>isolated browser</span><span className="mono-text">no live browser connection</span></div><div className="browser-preview__content"><Icon name="globe" size={28} /><strong>Browser session preview</strong><span>Navigation, DOM snapshots, forms and screenshots are represented here until a browser runtime contract is connected.</span></div></div><Panel title="Action log"><List items={browserLog} /><div className="platform-actions"><button className="studio-button" type="button" onClick={() => notify('Screenshot capture staged in preview')}>Capture screenshot</button><button className="studio-button" type="button" onClick={() => notify('DOM snapshot staged in preview')}>Snapshot DOM</button></div></Panel></div></div>
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
      {renderHeader('Research operations', 'Research', 'Batch-oriented research, source collection, trajectory inspection and export.', <button className="studio-button studio-button--active" type="button" onClick={() => notify('New research batch opened in preview')}><Icon name="plus" size={14} /> New batch</button>)}
      <div className="research-layout"><div className="batch-list">{researchBatches.map(([id, title, inputs, state]) => <button type="button" key={id} className={`batch-row ${researchBatch === id ? 'batch-row--active' : ''}`} onClick={() => setResearchBatch(id)}><div><strong>{title}</strong><span>{id} · {inputs}</span></div><span className={`state-pill state-pill--${state === 'Complete' ? 'completed' : 'pending'}`}>{state}</span></button>)}</div><Panel title={researchBatch}><Metric label="Inputs" value="24" /><Metric label="Parallel workers" value="6" /><Metric label="Sources collected" value="128" /><Metric label="Trajectories" value="24" /><div className="platform-actions"><button className="studio-button" type="button" onClick={() => notify('Source browser opened in preview')}>Inspect sources</button><button className="studio-button" type="button" onClick={() => notify('Trajectory viewer opened in preview')}>View trajectories</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Research export prepared in preview')}><Icon name="arrow-down" size={14} /> Export</button></div></Panel></div>
      <Toast message={notice} />
    </Shell>
  )

  if (mode === 'mcp') return (
    <Shell>
      {renderHeader('Tool gateway', 'MCP Servers', 'Connect external tool servers, inspect capabilities and review authentication state.', <button className="studio-button studio-button--active" type="button" onClick={() => notify('MCP server installer opened in preview')}><Icon name="plus" size={14} /> Add MCP server</button>)}
      <div className="mcp-layout"><div className="mcp-list">{mcpServers.map(([name, detail, tools, state]) => <button type="button" key={name} className={`mcp-row ${selectedMcp === name ? 'mcp-row--active' : ''}`} onClick={() => setSelectedMcp(name)}><div className="mcp-icon"><Icon name="tool" size={15} /></div><div><strong>{name}</strong><span>{detail}</span></div><small>{tools}</small><span className={`state-pill state-pill--${state === 'Connected' ? 'active' : 'pending'}`}>{state}</span></button>)}</div><Panel title={selectedMcp}><div className="mcp-detail"><Metric label="Transport" value="stdio / HTTP" /><Metric label="Auth" value="OAuth preview" /><Metric label="Tools" value="12" /><Metric label="Policy" value="Approval required" /></div><div className="platform-actions"><button className="studio-button" type="button" onClick={() => notify('OAuth setup opened in preview')}>Authenticate</button><button className="studio-button" type="button" onClick={() => notify('MCP capability list refreshed')}>Refresh capabilities</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('MCP server enabled in preview')}><Icon name="check" size={14} /> Enable server</button></div><div className="callout"><Icon name="shield" size={14} /><span>MCP servers are treated as external capability providers; credentials remain outside presentation state.</span></div></Panel></div>
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

function Shell({ children }: { children: ReactNode }) {
  return <section className="platform-surface">{children}</section>
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div className="platform-panel"><div className="platform-panel__head"><strong>{title}</strong><span className="mono-text">preview</span></div><div className="platform-panel__body">{children}</div></div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="platform-metric-row"><span>{label}</span><strong>{value}</strong></div>
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="platform-metric-card"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>
}

function List({ items }: { items: string[] }) {
  return <div className="platform-list">{items.map((item, index) => <div key={`${index}-${item}`}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item}</strong></div>)}</div>
}

function Tag({ label }: { label: string }) {
  return <span className="platform-tag">{label}</span>
}

function Toast({ message }: { message: string }) {
  if (!message) return null
  return <div className="platform-toast"><Icon name="check" size={14} /><span>{message}</span></div>
}
