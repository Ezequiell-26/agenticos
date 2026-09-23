import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'

type NodeState = 'done' | 'running' | 'queued' | 'blocked'
type RuntimeNode = { id: string; kind: string; title: string; detail: string; state: NodeState; duration: string }

const initialNodes: RuntimeNode[] = [
  { id: 'n1', kind: 'Plan', title: 'Resolve scope', detail: 'Workspace, task and policy context sealed', state: 'done', duration: '18s' },
  { id: 'n2', kind: 'Agent', title: 'Builder agent', detail: 'Implement frontend control surface', state: 'running', duration: '6m 42s' },
  { id: 'n3', kind: 'Subagent', title: 'Reviewer', detail: 'Independent diff and regression inspection', state: 'running', duration: '3m 08s' },
  { id: 'n4', kind: 'Tool', title: 'TypeScript verification', detail: 'Build and targeted checks', state: 'queued', duration: '—' },
  { id: 'n5', kind: 'Gate', title: 'Human approval', detail: 'Required before release mutation', state: 'blocked', duration: '—' },
]

const stateLabel: Record<NodeState, string> = { done: 'Completed', running: 'Running', queued: 'Queued', blocked: 'Blocked' }

export default function RunControlCenter({ onAction }: { onAction: (message: string) => void }) {
  const [nodes, setNodes] = useState(initialNodes)
  const [selected, setSelected] = useState(initialNodes[1].id)
  const [paused, setPaused] = useState(false)
  const [autoCheckpoint, setAutoCheckpoint] = useState(true)
  const [retryBudget, setRetryBudget] = useState(2)
  const [tab, setTab] = useState<'Execution' | 'Checkpoints' | 'Handoffs' | 'Artifacts'>('Execution')

  const active = nodes.find((node) => node.id === selected) ?? nodes[0]
  const running = useMemo(() => nodes.filter((node) => node.state === 'running').length, [nodes])

  function control(action: string) {
    onAction(action + ' staged in preview')
  }

  function retry(nodeId: string) {
    setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, state: 'running', duration: 'retrying' } : node))
    control('Retry')
  }

  return (
    <div className="run-control">
      <div className="run-control__topbar">
        <div>
          <span className="eyebrow">Runtime orchestration</span>
          <h2>Run Control Center</h2>
          <p>Inspect execution trees, live agent state, checkpoints, handoffs and recovery controls before runtime integration.</p>
        </div>
        <div className="run-control__actions">
          <span className={paused ? 'state-pill state-pill--pending' : 'state-pill state-pill--active'}>{paused ? 'Paused' : running + ' active'}</span>
          <button className="studio-button" type="button" onClick={() => setPaused((value) => !value)}><Icon name={paused ? 'play' : 'stop'} size={13} /> {paused ? 'Resume' : 'Pause'}</button>
          <button className="studio-button" type="button" onClick={() => control('Stop run')}>Stop</button>
          <button className="studio-button studio-button--active" type="button" onClick={() => control('Create checkpoint')}>Checkpoint</button>
        </div>
      </div>

      <div className="run-control__metrics">
        <div><span>Run</span><strong>RUN-042</strong><small>Frontend modernization</small></div>
        <div><span>Model route</span><strong>Auto / Qwen3 Coder</strong><small>Fallback policy armed</small></div>
        <div><span>Context</span><strong>32.8k / 128k</strong><small>25.6% pressure</small></div>
        <div><span>Recovery</span><strong>{retryBudget} retries</strong><small>Fail-closed policy</small></div>
      </div>

      <div className="run-control__tabs" role="tablist">
        {(['Execution','Checkpoints','Handoffs','Artifacts'] as const).map((item) => <button type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'run-control__tab run-control__tab--active' : 'run-control__tab'} key={item} onClick={() => setTab(item)}>{item}</button>)}
      </div>

      {tab === 'Execution' && <div className="run-control__layout">
        <section className="run-control__tree">
          <div className="surface-block__heading"><span>Execution graph</span><span className="mono-text">event stream · preview</span></div>
          <div className="run-control__nodes">
            {nodes.map((node, index) => <div className="run-control__node-wrap" key={node.id}>
              <button type="button" className={selected === node.id ? 'run-control__node run-control__node--active' : 'run-control__node'} onClick={() => setSelected(node.id)}>
                <span className={'run-control__node-icon run-control__node-icon--' + node.state}><Icon name={node.state === 'done' ? 'check' : node.state === 'blocked' ? 'lock' : node.kind === 'Agent' || node.kind === 'Subagent' ? 'bot' : 'activity'} size={13} /></span>
                <span><strong>{node.title}</strong><small>{node.kind} · {node.detail}</small></span>
                <span><b>{stateLabel[node.state]}</b><small>{node.duration}</small></span>
              </button>
              {index < nodes.length - 1 && <div className="run-control__connector" aria-hidden="true">↓</div>}
            </div>)}
          </div>
        </section>

        <aside className="run-control__inspector">
          <div className="surface-block__heading"><span>Node inspector</span><span className="mono-text">{active.id}</span></div>
          <div className="run-control__inspector-title"><span className="eyebrow">{active.kind}</span><h3>{active.title}</h3><p>{active.detail}</p></div>
          <div className="run-control__facts"><div><span>State</span><strong>{stateLabel[active.state]}</strong></div><div><span>Duration</span><strong>{active.duration}</strong></div><div><span>Retry policy</span><strong>{active.state === 'blocked' ? 'No retry' : 'Bounded'}</strong></div><div><span>Approval</span><strong>{active.state === 'blocked' ? 'Required' : 'Policy based'}</strong></div></div>
          <div className="platform-actions"><button className="studio-button" type="button" onClick={() => control('Inspect node trace')}>Trace</button><button className="studio-button" type="button" onClick={() => retry(active.id)}>Retry node</button><button className="studio-button studio-button--active" type="button" onClick={() => control('Open node diff')}>Inspect diff</button></div>
        </aside>
      </div>}

      {tab === 'Checkpoints' && <div className="run-control__cards"><ControlCard title="Auto checkpoints" detail="Capture reversible execution state before high-impact mutations." value={autoCheckpoint ? 'Enabled' : 'Disabled'} action={autoCheckpoint ? 'Disable' : 'Enable'} onAction={() => setAutoCheckpoint((value) => !value)} /><ControlCard title="Checkpoint #17" detail="Before provider route mutation · 4 files · 18.2k tokens" value="Restorable" action="Preview restore" onAction={() => control('Restore checkpoint')} /><ControlCard title="Checkpoint #16" detail="After verification · clean diff · policy snapshot attached" value="Archived" action="Compare" onAction={() => control('Compare checkpoints')} /></div>}

      {tab === 'Handoffs' && <div className="run-control__handoff"><div><span className="eyebrow">Agent handoff</span><h3>Builder → Reviewer</h3><p>Pass the exact task scope, changed files, verification evidence and unresolved risks without copying the entire context window.</p></div><div className="run-control__handoff-grid"><div><span>Context package</span><strong>Scoped · 8.4k tokens</strong></div><div><span>Artifacts</span><strong>3 attached</strong></div><div><span>Open risks</span><strong>1 pending</strong></div><div><span>Approval</span><strong>Not required</strong></div></div><div className="platform-actions"><button className="studio-button" type="button" onClick={() => control('Preview handoff package')}>Preview package</button><button className="studio-button studio-button--active" type="button" onClick={() => control('Send handoff')}>Send handoff</button></div></div>}

      {tab === 'Artifacts' && <div className="run-control__artifact-list">{[['artifact-17','frontend-diff.patch','Patch · 18 KB'],['artifact-18','verification-report.json','Evidence · 6 KB'],['artifact-19','agent-handoff.md','Handoff · 4 KB'],['artifact-20','screenshot-desktop.png','Visual QA · 812 KB']].map(([id,name,meta]) => <div className="run-control__artifact" key={id}><Icon name="archive" size={15} /><div><strong>{name}</strong><span>{id} · {meta}</span></div><button className="studio-button" type="button" onClick={() => control('Open ' + name)}>Open</button></div>)}</div>}

      <div className="run-control__footer">
        <label><span>Retry budget</span><input type="range" min="0" max="5" value={retryBudget} onChange={(event) => setRetryBudget(Number(event.target.value))} /><b>{retryBudget}</b></label>
        <span className="run-control__boundary"><Icon name="shield" size={13} /> Presentation-only controls. Pause, stop, retry and checkpoint actions do not execute until connected to the runtime contracts.</span>
      </div>
    </div>
  )
}

function ControlCard({ title, detail, value, action, onAction }: { title: string; detail: string; value: string; action: string; onAction: () => void }) {
  return <article className="run-control__card"><div><span className="eyebrow">{value}</span><h3>{title}</h3><p>{detail}</p></div><button className="studio-button" type="button" onClick={onAction}>{action}</button></article>
}
