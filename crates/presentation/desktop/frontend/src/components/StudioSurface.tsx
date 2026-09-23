import { useMemo, useState, type ReactNode } from 'react'
import type { RailMode } from './ActivityRail'
import Icon from './Icon'
import ChangeReviewPanel from '../features/editor/ChangeReviewPanel'
import ArtifactViewer from '../features/artifacts/ArtifactViewer'
import WorkflowBuilder from '../features/workflows/WorkflowBuilder'
import ProviderStudio from '../features/providers/ProviderStudio'
import MemoryStudio from '../features/memory/MemoryStudio'
import SkillsStudio from '../features/skills/SkillsStudio'
import ToolsStudio from '../features/tools/ToolsStudio'
import SettingsSurface from './SettingsSurface'

type Toast = { id: number; message: string }

const files = [
  { path: 'crates/presentation/desktop/frontend/src/App.tsx', label: 'App.tsx', kind: 'tsx', group: 'frontend' },
  { path: 'crates/presentation/desktop/frontend/src/components/StudioSurface.tsx', label: 'StudioSurface.tsx', kind: 'tsx', group: 'frontend' },
  { path: 'crates/presentation/desktop/frontend/src/components/Icon.tsx', label: 'Icon.tsx', kind: 'tsx', group: 'frontend' },
  { path: 'crates/infrastructure/providers/src/lib.rs', label: 'lib.rs', kind: 'rust', group: 'runtime' },
  { path: 'crates/infrastructure/providers/tests/provider_plane_integration.rs', label: 'provider_plane_integration.rs', kind: 'rust', group: 'tests' },
  { path: 'docs/architecture/FRONTEND-ARCHITECTURE.md', label: 'FRONTEND-ARCHITECTURE.md', kind: 'md', group: 'docs' },
]

const codeByFile: Record<string, string> = {
  'App.tsx': `function App() {
  const [mode, setMode] = useState<RailMode>('chat')
  const [running, setRunning] = useState(false)

  return (
    <div className="app-shell">
      <ActivityRail active={mode} onChange={setMode} />
      <main className="workspace-main">
        {mode === 'chat' ? <ChatSurface /> : <WorkspaceOverview mode={mode} />}
      </main>
    </div>
  )
}`,
  'StudioSurface.tsx': `export default function StudioSurface({ mode }: StudioSurfaceProps) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState('')

  return (
    <section className="studio-surface">
      {/* UI state stays local until a real runtime contract is available. */}
    </section>
  )
}`,
  'Icon.tsx': `export type IconName =
  | 'activity'
  | 'archive'
  | 'bot'
  | 'code'
  | 'folder'
  | 'history'
  | 'message'
  | 'settings'
  | 'spark'
  | 'terminal'
  | 'tool'`,
  'lib.rs': `pub struct FallbackManager {
    // Provider orchestration stays in the Rust runtime.
}`,
  'provider_plane_integration.rs': `#[test]
fn multi_provider_orchestration_selects_healthy_provider_and_executes_transport() {
    // deterministic integration coverage
}`,
  'FRONTEND-ARCHITECTURE.md': `# Frontend Architecture

Desktop surface: Tauri 2 + React + TypeScript + Vite

Rules:
- visual state may be local
- secrets stay outside the UI
- runtime contracts remain explicit
- destructive actions require confirmation
`,
}

const artifacts = [
  ['agenticos-command-center.png', 'Image', '2.8 MB'],
  ['architecture-report.md', 'Document', '18 KB'],
  ['provider-test.log', 'Log', '74 KB'],
  ['implementation-plan.json', 'Structured', '12 KB'],
]

const terminalWelcome = [
  '$ agenticos status',
  'AgentiCOS desktop shell',
  'runtime: offline preview',
  'guardrails: enabled',
  'workspace: clean preview',
  '',
  '$ help',
  'status   show runtime preview',
  'clear    clear terminal',
  'ls       list workspace',
  'run      simulate an agent run',
]

export default function StudioSurface({ mode }: { mode: Exclude<RailMode, 'chat'> }) {
  const [search, setSearch] = useState('')
  const [selectedFile, setSelectedFile] = useState(files[0].path)
  const [openTabs, setOpenTabs] = useState([files[0].path])
  const [showDiff, setShowDiff] = useState(false)
  const [reviewPanelOpen, setReviewPanelOpen] = useState(false)
  const [editorValue, setEditorValue] = useState(codeByFile[files[0].label])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [terminalLines, setTerminalLines] = useState(terminalWelcome)
  const [terminalInput, setTerminalInput] = useState('')
  const [runFilter, setRunFilter] = useState<'All' | 'Active' | 'Completed'>('All')
  const [selectedRun, setSelectedRun] = useState('RUN-042')
  const [artifactSelected, setArtifactSelected] = useState(artifacts[0][0])

  function notify(message: string) {
    const id = Date.now()
    setToasts((current) => [...current.slice(-2), { id, message }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 2600)
  }

  function selectFile(path: string) {
    const file = files.find((item) => item.path === path)
    if (!file) return
    setSelectedFile(path)
    setEditorValue(codeByFile[file.label] ?? '// Preview content\n')
    setOpenTabs((current) => current.includes(path) ? current : [...current, path])
  }

  function closeTab(path: string) {
    if (openTabs.length <= 1) return
    const next = openTabs.filter((item) => item !== path)
    setOpenTabs(next)
    if (path === selectedFile) {
      const nextPath = next[next.length - 1]
      const nextFile = files.find((file) => file.path === nextPath)
      if (nextPath && nextFile) {
        setSelectedFile(nextPath)
        setEditorValue(codeByFile[nextFile.label] ?? '// Preview content\n')
      }
    }
  }

  function runTerminalCommand() {
    const command = terminalInput.trim()
    if (!command) return
    const response = command === 'help'
      ? ['status   show runtime preview', 'clear    clear terminal', 'ls       list workspace', 'run      simulate an agent run']
      : command === 'clear'
        ? []
        : command === 'ls'
          ? files.map((file) => file.path)
          : command === 'status'
            ? ['runtime: offline preview', 'guardrails: enabled', 'active tools: 4', 'workspace state: local']
            : command === 'run'
              ? ['run queued: RUN-LOCAL-001', 'planning...', 'execution simulated', 'verification pending']
              : [`command not implemented in preview: ${command}`]
    setTerminalLines((current) => command === 'clear' ? [] : [...current, `$ ${command}`, ...response])
    setTerminalInput('')
    notify(`Terminal: ${command}`)
  }

  const filteredFiles = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    return normalized ? files.filter((file) => file.path.toLowerCase().includes(normalized)) : files
  }, [search])

  if (mode === 'files') return (
    <section className="studio-surface">
      <StudioHeader eyebrow="Workspace" title="Files & Editor" subtitle="Explorer, code editor, diff inspector, tabs and local editor state." actions={
        <>
          <button className="studio-button" type="button" onClick={() => notify('New file dialog opened in preview')}><Icon name="plus" size={14} /> New file</button>
          <button className={`studio-button ${showDiff ? 'studio-button--active' : ''}`} type="button" onClick={() => setShowDiff((value) => !value)}><Icon name="git" size={14} /> Diff</button>
          <button className={`studio-button ${reviewPanelOpen ? 'studio-button--active' : ''}`} type="button" onClick={() => setReviewPanelOpen((value) => !value)}><Icon name="shield" size={14} /> Review</button>
          <button className="studio-button" type="button" onClick={() => notify('Saved to local preview state')}><Icon name="check" size={14} /> Save</button>
        </>
      } />
      <div className="file-workbench">
        <div className="studio-pane file-tree-pane">
          <div className="pane-toolbar"><strong>Explorer</strong><button className="icon-button" type="button" onClick={() => setSearch('')}><Icon name="search" size={14} /></button></div>
          <input className="mini-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter files…" />
          <div className="file-tree">
            {filteredFiles.map((file) => (
              <button key={file.path} type="button" className={`file-tree-row ${selectedFile === file.path ? 'file-tree-row--active' : ''}`} onClick={() => selectFile(file.path)}>
                <Icon name={file.kind === 'md' ? 'archive' : file.kind === 'rust' ? 'terminal' : 'code'} size={14} />
                <span>{file.label}</span><small>{file.group}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="studio-pane editor-pane">
          <div className="editor-tabs">
            {openTabs.map((tab) => {
              const label = tab.split('/').pop() ?? tab
              return <button type="button" className={`editor-tab ${selectedFile === tab ? 'editor-tab--active' : ''}`} key={tab} onClick={() => selectFile(tab)}>{label}<span onClick={(event) => { event.stopPropagation(); closeTab(tab) }}>×</span></button>
            })}
          </div>
          <div className="editor-meta"><span>{selectedFile}</span><span className="mono-text">UTF-8 · 2 spaces · local draft</span></div>
          <div className={`code-editor ${showDiff ? 'code-editor--diff' : ''}`}>
            <div className="line-numbers">{editorValue.split('\n').map((_, index) => <span key={index}>{index + 1}</span>)}</div>
            <textarea value={editorValue} onChange={(event) => setEditorValue(event.target.value)} spellCheck={false} aria-label="Code editor preview" />
          </div>
          <div className="editor-status"><span>Ln 1, Col 1</span><span>{editorValue.length} chars</span><span>{showDiff ? 'Diff inspector enabled' : 'Editing preview'}</span></div>
        </div>
        <div className="studio-pane inspector-pane">
          <div className="pane-toolbar"><strong>Inspector</strong><span className="mono-text">{showDiff ? 'DIFF' : 'FILE'}</span></div>
          <div className="inspector-section"><span>Language</span><strong>{selectedFile.endsWith('.rs') ? 'Rust' : selectedFile.endsWith('.md') ? 'Markdown' : 'TypeScript React'}</strong></div>
          <div className="inspector-section"><span>State</span><strong>Local draft</strong></div>
          <div className="inspector-section"><span>Safety</span><strong>Safe edit mode</strong></div>
          {showDiff && <div className="diff-card"><div className="diff-minus">- const oldSurface = true</div><div className="diff-plus">+ const premiumSurface = true</div><div className="diff-plus">+ const featuresVisible = true</div></div>}
          <button className="wide-dark-button" type="button" onClick={() => notify('Review requested for current file')}><Icon name="shield" size={14} /> Request review</button>
        </div>
      </div>
      {toasts.map((toast) => <Toast key={toast.id} message={toast.message} />)}
    </section>
  )

  if (mode === 'runs') {
    const runs = [
      ['RUN-042', 'Frontend modernization', 'Active', '14 min'],
      ['RUN-041', 'Provider audit', 'Completed', '8 min'],
      ['RUN-040', 'Architecture check', 'Completed', '4 min'],
      ['RUN-039', 'Workspace scan', 'Completed', '19 min'],
    ]
    const visibleRuns = runs.filter((run) => runFilter === 'All' || run[2] === runFilter)
    return (
      <section className="studio-surface">
        <StudioHeader eyebrow="Operations" title="Agent Runs" subtitle="Execution history, approvals, tool calls, verification and recovery checkpoints." actions={<button className="studio-button" type="button" onClick={() => notify('New run prepared in preview')}><Icon name="plus" size={14} /> New run</button>} />
        <div className="split-surface">
          <div className="list-pane">
            <div className="segmented">{(['All', 'Active', 'Completed'] as const).map((filter) => <button type="button" className={runFilter === filter ? 'segmented--active' : ''} key={filter} onClick={() => setRunFilter(filter)}>{filter}</button>)}</div>
            <div className="entity-list">{visibleRuns.map((run) => <button type="button" key={run[0]} className={`entity-row ${selectedRun === run[0] ? 'entity-row--active' : ''}`} onClick={() => setSelectedRun(run[0])}><div className="entity-row__main"><strong>{run[0]}</strong><span>{run[1]}</span></div><div className="entity-row__meta"><span className={`state-pill state-pill--${run[2].toLowerCase()}`}>{run[2]}</span><small>{run[3]}</small></div></button>)}</div>
          </div>
          <div className="detail-pane">
            <div className="detail-header"><div><span className="eyebrow">Run detail</span><h2>{selectedRun}</h2></div><div className="detail-actions"><button className="icon-button" type="button" title="Copy run id" onClick={() => notify('Run id copied')}><Icon name="copy" size={15} /></button><button className="studio-button" type="button" onClick={() => notify('Run queued again in preview')}><Icon name="play" size={14} /> Re-run</button></div></div>
            <div className="run-stat-grid"><div><span>Duration</span><strong>14m 32s</strong></div><div><span>Tools</span><strong>18</strong></div><div><span>Tokens</span><strong>32.8k</strong></div><div><span>Changes</span><strong>7 files</strong></div></div>
            <div className="run-progress"><div><span>Execution progress</span><span>68%</span></div><div className="progress"><span style={{ width: '68%' }} /></div></div>
            <div className="timeline">{[['Planning', 'Scope resolved · 10:41', 'done'], ['Approval', 'User policy check · 10:43', 'done'], ['Execution', '18 tool calls · 10:44', 'active'], ['Verification', 'Tests + diff review · pending', 'pending']].map(([title, detail, state]) => <div className="timeline-row" key={title}><div className={`timeline-marker timeline-marker--${state}`}>{state === 'done' ? <Icon name="check" size={13} /> : state === 'active' ? <Icon name="play" size={11} /> : <span />}</div><div className="timeline-copy"><strong>{title}</strong><span>{detail}</span></div></div>)}</div>
          </div>
        </div>
        {toasts.map((toast) => <Toast key={toast.id} message={toast.message} />)}
      </section>
    )
  }

  if (mode === 'providers') return (
    <section className="studio-surface">
      <StudioHeader eyebrow="Model plane" title="Providers & Models" subtitle="Inspect provider health, models, routing strategy, quotas and fallback behavior in one workspace." actions={<button className="studio-button" type="button" onClick={() => notify('Provider catalog refreshed in preview')}><Icon name="history" size={14} /> Refresh</button>} />
      <ProviderStudio onAction={notify} />
      {toasts.map((toast) => <Toast key={toast.id} message={toast.message} />)}
    </section>
  )

  if (mode === 'tools') return (
    <section className="studio-surface">
      <StudioHeader eyebrow="Tool plane" title="Tool Registry" subtitle="Inspect capabilities, risk, permissions, schemas and execution behavior." actions={<button className="studio-button studio-button--active" type="button" onClick={() => notify('Tool registry scanned in preview')}><Icon name="history" size={14} /> Scan registry</button>} />
      <ToolsStudio onAction={notify} />
      {toasts.map((toast) => <Toast key={toast.id} message={toast.message} />)}
    </section>
  )

  if (mode === 'skills') return (
    <section className="studio-surface">
      <StudioHeader eyebrow="Capability plane" title="Skills" subtitle="Discover, inspect, configure and enable reusable agent capabilities." actions={<button className="studio-button studio-button--active" type="button" onClick={() => notify('Skill marketplace opened in preview')}><Icon name="spark" size={14} /> Browse marketplace</button>} />
      <SkillsStudio onAction={notify} />
      {toasts.map((toast) => <Toast key={toast.id} message={toast.message} />)}
    </section>
  )

  if (mode === 'memory') return (
    <section className="studio-surface">
      <StudioHeader eyebrow="Context plane" title="Memory" subtitle="Search, inspect and curate reusable knowledge before it enters an agent context pack." actions={<button className="studio-button studio-button--active" type="button" onClick={() => notify('New memory item created in preview')}><Icon name="plus" size={14} /> Add memory</button>} />
      <MemoryStudio onAction={notify} />
      {toasts.map((toast) => <Toast key={toast.id} message={toast.message} />)}
    </section>
  )

  if (mode === 'workflows') return (
    <section className="studio-surface">
      <StudioHeader eyebrow="Automation plane" title="Workflows" subtitle="Design repeatable agent processes with triggers, steps, approvals and handoff stages." actions={<button className="studio-button studio-button--active" type="button" onClick={() => notify('New workflow draft created in preview')}><Icon name="plus" size={14} /> New workflow</button>} />
      <WorkflowBuilder onAction={notify} />
      {toasts.map((toast) => <Toast key={toast.id} message={toast.message} />)}
    </section>
  )

  if (mode === 'artifacts') return (
    <section className="studio-surface">
      <StudioHeader eyebrow="Output plane" title="Artifacts" subtitle="Inspect generated files, provenance, previews, versions and handoff actions." actions={<button className="studio-button" type="button" onClick={() => notify('Artifact index refreshed')}><Icon name="history" size={14} /> Refresh</button>} />
      <ArtifactViewer onAction={notify} selected={artifactSelected} onSelect={setArtifactSelected} />
      {toasts.map((toast) => <Toast key={toast.id} message={toast.message} />)}
    </section>
  )

  if (mode === 'terminal') return (
    <section className="studio-surface">
      <StudioHeader eyebrow="Developer tools" title="Integrated Terminal" subtitle="Interactive local shell preview with command history and task output." actions={<button className="studio-button" type="button" onClick={() => setTerminalLines(terminalWelcome)}><Icon name="history" size={14} /> Reset</button>} />
      <div className="terminal-shell"><div className="terminal-top"><span><span className="terminal-dot" /><span className="terminal-dot" /><span className="terminal-dot" /></span><span>agentiCOS / workspace</span><span className="mono-text">shell preview</span></div><div className="terminal-output">{terminalLines.map((line, index) => <div className={line.startsWith('$') ? 'terminal-command' : ''} key={`${index}-${line}`}>{line || ' '}</div>)}</div><form className="terminal-input-row" onSubmit={(event) => { event.preventDefault(); runTerminalCommand() }}><span>$</span><input value={terminalInput} onChange={(event) => setTerminalInput(event.target.value)} placeholder="Type a command…" /><kbd>Enter</kbd></form></div>
      {toasts.map((toast) => <Toast key={toast.id} message={toast.message} />)}
    </section>
  )

  if (mode === 'approvals') {
    const approvalItems = [
      ['APP-018', 'Write frontend architecture docs', 'Low risk', 'Pending'],
      ['APP-017', 'Modify provider routing', 'High risk', 'Pending'],
      ['APP-016', 'Run terminal command', 'Critical', 'Approved'],
      ['APP-015', 'Create generated artifact', 'Medium risk', 'Approved'],
    ]
    return (
      <section className="studio-surface">
        <StudioHeader eyebrow="Control plane" title="Approvals" subtitle="Review queued actions, policy context and execution permissions before they become real runtime operations." actions={<button className="studio-button" type="button" onClick={() => notify('Approval queue refreshed')}><Icon name="history" size={14} /> Refresh</button>} />
        <div className="approval-layout">
          <div className="approval-list">
            {approvalItems.map(([id, title, risk, state]) => (
              <button type="button" key={id} className={`approval-row ${state === 'Pending' ? 'approval-row--pending' : ''}`} onClick={() => notify(`${id} selected`)}>
                <div className="approval-icon"><Icon name={risk === 'Critical' ? 'shield' : 'tool'} size={15} /></div>
                <div className="approval-copy"><strong>{title}</strong><span>{id} · {risk}</span></div>
                <span className={`state-pill state-pill--${state.toLowerCase()}`}>{state}</span>
              </button>
            ))}
          </div>
          <div className="approval-detail">
            <div className="detail-header"><div><span className="eyebrow">Request preview</span><h2>APP-018</h2></div><span className="state-pill state-pill--active">Pending</span></div>
            <div className="approval-summary"><span>Requested action</span><strong>Write frontend architecture docs</strong><small>Changes 2 files · estimated 1 mutation · no secrets</small></div>
            <div className="approval-context"><div><span>Scope</span><strong>Frontend docs</strong></div><div><span>Risk</span><strong>Low</strong></div><div><span>Rollback</span><strong>Available</strong></div></div>
            <div className="approval-actions"><button className="studio-button" type="button" onClick={() => notify('Request rejected in preview')}>Reject</button><button className="studio-button studio-button--active" type="button" onClick={() => notify('Request approved in preview')}><Icon name="check" size={14} /> Approve</button></div>
          </div>
        </div>
        {toasts.map((toast) => <Toast key={toast.id} message={toast.message} />)}
      </section>
    )
  }

  if (mode === 'observability') {
    const events = ['tool.call · filesystem · 42 ms', 'provider.route · primary · 118 ms', 'run.step · verification · queued', 'memory.read · project · 8 ms', 'guardrail.check · passed · 2 ms']
    return (
      <section className="studio-surface">
        <StudioHeader eyebrow="Telemetry" title="Observability" subtitle="Runtime-inspired dashboards for latency, events, token flow and agent activity." actions={<><button className="studio-button" type="button" onClick={() => notify('Telemetry window paused in preview')}><Icon name="stop" size={14} /> Pause</button><button className="studio-button" type="button" onClick={() => notify('Telemetry refreshed')}><Icon name="history" size={14} /> Refresh</button></>} />
        <div className="telemetry-grid">
          <div className="telemetry-card"><span>Requests / min</span><strong>48</strong><div className="spark-bars">{[35,52,41,69,58,84,66,77,55,91,73,88].map((height, index) => <i style={{ height: `${height}%` }} key={index} />)}</div></div>
          <div className="telemetry-card"><span>P95 latency</span><strong>428 ms</strong><div className="latency-track"><span style={{ width:'64%' }} /></div><small>vs. 612 ms previous window</small></div>
          <div className="telemetry-card"><span>Token flow</span><strong>92.4k</strong><div className="telemetry-mini-row"><span>Input</span><strong>61.8k</strong></div><div className="telemetry-mini-row"><span>Output</span><strong>30.6k</strong></div></div>
          <div className="telemetry-card"><span>Tool success</span><strong>98.7%</strong><div className="latency-track"><span style={{ width:'98.7%' }} /></div><small>18 calls · 0 retries</small></div>
        </div>
        <div className="event-stream"><div className="surface-block__heading"><span>Event stream</span><span className="mono-text">live preview</span></div>{events.map((event, index) => <div className="event-row" key={event}><span className="event-index">0{index+1}</span><span>{event}</span><span className="status-dot status-dot--live" /></div>)}</div>
        {toasts.map((toast) => <Toast key={toast.id} message={toast.message} />)}
      </section>
    )
  }

  if (mode === 'agents') {
    const profiles: ReadonlyArray<[string, string, string, string, boolean]> = [
      ['Builder', 'Implementation specialist', 'Qwen3 Coder', '18 tools', true],
      ['Reviewer', 'Quality and regression analyst', 'GPT-OSS 120B', '11 tools', false],
      ['Researcher', 'Evidence and source specialist', 'DeepSeek', '9 tools', false],
    ]
    return (
      <section className="studio-surface">
        <StudioHeader eyebrow="Agent control" title="Agent Profiles" subtitle="Design multiple specialist agents with distinct models, capabilities, behavior and operating modes." actions={<button className="studio-button" type="button" onClick={() => notify('New agent profile opened in preview')}><Icon name="plus" size={14} /> New agent</button>} />
        <div className="agent-profile-grid">{profiles.map(([name, detail, model, toolsCount, active]) => <button type="button" key={name} className={`agent-profile-card ${active ? 'agent-profile-card--active' : ''}`} onClick={() => notify(`${name} selected`)}><div className="agent-profile-card__top"><div className="agent-profile-avatar"><Icon name="bot" size={18} /></div><div><strong>{name}</strong><span>{detail}</span></div><span className={`status-dot ${active ? 'status-dot--live' : 'status-dot--offline'}`} /></div><div className="agent-profile-card__meta"><span>{model}</span><span>{toolsCount}</span></div><div className="agent-profile-card__tags"><small>Planning</small><small>Tools</small><small>Verification</small></div></button>)}</div>
        <div className="profile-editor"><div><span className="eyebrow">Active profile</span><h2>Builder</h2><p>Focused implementation mode with guarded mutations and verification-first execution.</p></div><div className="profile-controls"><label>Creativity <input type="range" min="0" max="100" defaultValue="35" /></label><label>Tool budget <input type="range" min="0" max="100" defaultValue="72" /></label><label>Autonomy <input type="range" min="0" max="100" defaultValue="58" /></label></div></div>
      </section>
    )
  }

  if (mode === 'prompts') {
    const promptGroups: ReadonlyArray<[string, string, string]> = [
      ['Code review', 'Analyze a diff for correctness, regressions and missing tests.', 'Engineering'],
      ['Architecture', 'Design the next implementation slice with no rework.', 'Planning'],
      ['Research', 'Compare options using evidence and explicit uncertainty.', 'Research'],
      ['UI critique', 'Audit a screen for hierarchy, density and interaction quality.', 'Design'],
      ['Debug', 'Find the narrowest reproducible cause and propose a verified fix.', 'Engineering'],
      ['Release', 'Prepare a release checklist with build, test and rollback evidence.', 'DevOps'],
    ]
    return (
      <section className="studio-surface">
        <StudioHeader eyebrow="Prompt engineering" title="Prompt Lab" subtitle="Reusable prompts, variables, versioning and preview execution." actions={<button className="studio-button" type="button" onClick={() => notify('New prompt created in preview')}><Icon name="plus" size={14} /> New prompt</button>} />
        <div className="prompt-layout"><div className="prompt-list">{promptGroups.map(([name, text, category]) => <button type="button" className="prompt-row" key={name} onClick={() => notify(`${name} loaded`)}><div className="prompt-row__icon"><Icon name="spark" size={14} /></div><div><strong>{name}</strong><span>{text}</span></div><small>{category}</small></button>)}</div><div className="prompt-editor"><div className="prompt-toolbar"><span className="mono-text">prompt://code-review/v4</span><span className="state-pill state-pill--completed">Saved</span></div><textarea defaultValue={'Review the current change set.\\n\\nGoals:\\n- identify regressions\\n- verify tests\\n- produce actionable fixes\\n\\nContext: {{workspace}}\\nDiff: {{diff}}'} aria-label="Prompt editor" /><div className="variable-row"><span>{'{{workspace}}'}</span><span>{'{{diff}}'}</span><span>{'{{constraints}}'}</span><button className="studio-button" type="button" onClick={() => notify('Prompt preview executed')}>Preview</button></div></div></div>
        {toasts.map((toast) => <Toast key={toast.id} message={toast.message} />)}
      </section>
    )
  }

  return <SettingsSurface notify={notify} />

}

function StudioHeader({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle: string; actions?: ReactNode }) {
  return <header className="studio-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div><div className="studio-header__actions">{actions}</div></header>
}

function Toast({ message }: { message: string }) {
  return <div className="studio-toast"><Icon name="check" size={14} /><span>{message}</span></div>
}
