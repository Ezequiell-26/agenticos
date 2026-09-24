import { useMemo, useState, type ReactNode } from 'react'
import { runtime } from '../services/runtime'
import type { RailMode } from './ActivityRail'
import Icon from './Icon'
import ArtifactViewer from '../features/artifacts/ArtifactViewer'
import WorkflowBuilder from '../features/workflows/WorkflowBuilder'
import ProviderStudio from '../features/providers/ProviderStudio'
import MemoryStudio from '../features/memory/MemoryStudio'
import SkillsStudio from '../features/skills/SkillsStudio'
import ToolsStudio from '../features/tools/ToolsStudio'
import AgentBuilder from '../features/agents/AgentBuilder'
import PromptStudio from '../features/prompts/PromptStudio'
import SettingsSurface from './SettingsSurface'
import CodeEditorSurface from '../features/editor/CodeEditorSurface'
import RunTimeline from '../features/runs/RunTimeline'

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

export default function StudioSurface({ mode, onNavigate }: { mode: Exclude<RailMode, 'chat'>; onNavigate?: (mode: RailMode) => void }) {
  const [search, setSearch] = useState('')
  const [selectedFile, setSelectedFile] = useState(files[0].path)
  const [openTabs, setOpenTabs] = useState([files[0].path])
  const [showDiff, setShowDiff] = useState(false)
  const [reviewPanelOpen, setReviewPanelOpen] = useState(false)
  const [editorValue, setEditorValue] = useState(codeByFile[files[0].label])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [terminalLines, setTerminalLines] = useState(terminalWelcome)
  const [terminalInput, setTerminalInput] = useState('')
  const [terminalId, setTerminalId] = useState<string | null>(null)
  const [terminalGrantId, setTerminalGrantId] = useState<string | null>(null)
  const [terminalBusy, setTerminalBusy] = useState(false)
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

  async function runTerminalCommand() {
    const command = terminalInput.trim()
    if (!command || terminalBusy) return
    if (command === 'clear') {
      setTerminalLines([])
      setTerminalInput('')
      return
    }

    let grantId = terminalGrantId
    if (!grantId) {
      grantId = window.prompt('Capability grant_id for terminal execution', '')?.trim() || null
      if (!grantId) {
        notify('Terminal execution requires a capability grant')
        return
      }
      setTerminalGrantId(grantId)
    }

    setTerminalBusy(true)
    try {
      let activeTerminalId = terminalId
      if (!activeTerminalId) {
        const created = await runtime.terminal.create({ command, grant_id: grantId })
        activeTerminalId = typeof created.terminal_id === 'string' ? created.terminal_id : null
        if (!activeTerminalId) throw new Error('Runtime did not return a terminal_id')
        setTerminalId(activeTerminalId)
        setTerminalLines((current) => [...current, `$ ${command}`, 'terminal process started'])
      } else {
        await runtime.terminal.input(activeTerminalId, command + '\\n', grantId)
        setTerminalLines((current) => [...current, `$ ${command}`])
      }

      const output = await runtime.terminal.output(activeTerminalId, grantId, undefined, 200)
      const lines = typeof output.output === 'string' ? output.output.split('\\n') : Array.isArray(output.lines) ? output.lines.map(String) : []
      if (lines.length > 0) setTerminalLines((current) => [...current, ...lines])
      notify(`Terminal command sent to runtime`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Terminal operation failed')
    } finally {
      setTerminalBusy(false)
      setTerminalInput('')
    }
  }

  async function closeRuntimeTerminal() {
    if (!terminalId || !terminalGrantId) return
    try {
      await runtime.terminal.close(terminalId, terminalGrantId)
      setTerminalLines((current) => [...current, '[terminal closed]'])
      setTerminalId(null)
      notify('Runtime terminal closed')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Terminal close failed')
    }
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
          <CodeEditorSurface
            value={editorValue}
            onChange={setEditorValue}
            filePath={selectedFile}
            showDiff={showDiff}
            onSave={() => notify('Saved editor draft')}
          />
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

  if (mode === 'runs') return (
    <section className="studio-surface">
      <RunTimeline onAction={notify} />
      {toasts.map((toast) => <Toast key={toast.id} message={toast.message} />)}
    </section>
  )

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
      <StudioHeader eyebrow="Developer tools" title="Integrated Terminal" subtitle="Interactive runtime shell with bounded output and explicit capability authorization." actions={<><button className="studio-button" type="button" onClick={() => setTerminalLines(terminalWelcome)}><Icon name="history" size={14} /> Reset view</button>{terminalId && <button className="studio-button" type="button" onClick={() => void closeRuntimeTerminal()}><Icon name="stop" size={14} /> Close runtime</button>}</>} />
      <div className="terminal-shell"><div className="terminal-top"><span><span className="terminal-dot" /><span className="terminal-dot" /><span className="terminal-dot" /></span><span>agentiCOS / workspace</span><span className="mono-text">{terminalBusy ? 'executing' : terminalId ? `runtime ${terminalId.slice(0, 12)}` : 'runtime idle'}</span></div><div className="terminal-output">{terminalLines.map((line, index) => <div className={line.startsWith('$') ? 'terminal-command' : ''} key={`${index}-${line}`}>{line || ' '}</div>)}</div><form className="terminal-input-row" onSubmit={(event) => { event.preventDefault(); runTerminalCommand() }}><span>$</span><input value={terminalInput} onChange={(event) => setTerminalInput(event.target.value)} placeholder="Type a command…" disabled={terminalBusy} /><kbd>{terminalBusy ? '…' : 'Enter'}</kbd></form></div>
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

  if (mode === 'agents') return (
    <section className="studio-surface">
      <StudioHeader eyebrow="Agent control" title="Agent Profiles" subtitle="Build specialist agents with explicit models, capabilities, tools, behavior and verification policy." actions={<button className="studio-button studio-button--active" type="button" onClick={() => notify('New agent profile created in preview')}><Icon name="plus" size={14} /> New agent</button>} />
      <AgentBuilder onAction={notify} />
      {toasts.map((toast) => <Toast key={toast.id} message={toast.message} />)}
    </section>
  )

  if (mode === 'prompts') return (
    <section className="studio-surface">
      <StudioHeader eyebrow="Prompt engineering" title="Prompt Lab" subtitle="Version prompts, define variables, test outputs and keep reusable instruction packs organized." actions={<button className="studio-button studio-button--active" type="button" onClick={() => notify('New prompt draft created in preview')}><Icon name="plus" size={14} /> New prompt</button>} />
      <PromptStudio onAction={notify} />
      {toasts.map((toast) => <Toast key={toast.id} message={toast.message} />)}
    </section>
  )

  return <SettingsSurface notify={notify} onClose={() => onNavigate?.('chat')} onNavigate={onNavigate} />

}

function StudioHeader({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle: string; actions?: ReactNode }) {
  return <header className="studio-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div><div className="studio-header__actions">{actions}</div></header>
}

function Toast({ message }: { message: string }) {
  return <div className="studio-toast"><Icon name="check" size={14} /><span>{message}</span></div>
}
