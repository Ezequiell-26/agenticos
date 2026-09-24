import { useEffect, useMemo, useState } from 'react'
import { runtime } from '../../services/runtime'
import Icon from '../../components/Icon'

type RunState = 'Active' | 'Completed' | 'Failed' | 'Cancelled'
type Run = { id: string; title: string; state: RunState; duration: string; agent: string; model: string; tools: number; tokens: string; changes: string }

const runs: Run[] = [
  { id: 'RUN-042', title: 'Frontend modernization', state: 'Active', duration: '14m', agent: 'Builder', model: 'Qwen3 Coder', tools: 18, tokens: '32.8k', changes: '7 files' },
  { id: 'RUN-041', title: 'Provider audit', state: 'Completed', duration: '8m', agent: 'Reviewer', model: 'GPT-OSS 120B', tools: 11, tokens: '21.4k', changes: '3 files' },
  { id: 'RUN-040', title: 'Architecture check', state: 'Completed', duration: '4m', agent: 'Reviewer', model: 'GPT-OSS 120B', tools: 8, tokens: '12.7k', changes: '1 file' },
  { id: 'RUN-039', title: 'Workspace scan', state: 'Failed', duration: '19m', agent: 'Researcher', model: 'DeepSeek', tools: 27, tokens: '46.2k', changes: '0 files' },
  { id: 'RUN-038', title: 'Context regeneration', state: 'Cancelled', duration: '2m', agent: 'Builder', model: 'Qwen3 Coder', tools: 5, tokens: '8.2k', changes: '0 files' },
]

type Filter = 'All' | RunState

export default function RunTimeline({ onAction }: { onAction: (message: string) => void }) {
  const [filter, setFilter] = useState<Filter>('All')
  const [selectedId, setSelectedId] = useState(runs[0].id)
  const [view, setView] = useState<'Timeline' | 'Tools' | 'Changes'>('Timeline')
  const [liveRuns, setLiveRuns] = useState(runs)
  const [runtimeLoading, setRuntimeLoading] = useState(true)

  const refreshRuns = async () => {
    setRuntimeLoading(true)
    try {
      const remoteRuns = await runtime.runs.list()
      if (remoteRuns.length > 0) {
        const mapped = remoteRuns.map((run) => ({
          id: run.run_id,
          title: run.objective ?? run.run_id,
          state: normalizeRunState(run.state),
          duration: 'Runtime',
          agent: 'Runtime',
          model: 'Auto route',
          tools: 0,
          tokens: '—',
          changes: '—',
        }))
        setLiveRuns(mapped)
        setSelectedId((current) => mapped.some((item) => item.id === current) ? current : mapped[0].id)
      }
    } finally {
      setRuntimeLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    void runtime.runs.list().then((remoteRuns) => {
      if (cancelled || remoteRuns.length === 0) return
      const mapped = remoteRuns.map((run) => ({
        id: run.run_id,
        title: run.objective ?? run.run_id,
        state: normalizeRunState(run.state),
        duration: 'Runtime',
        agent: 'Runtime',
        model: 'Auto route',
        tools: 0,
        tokens: '—',
        changes: '—',
      }))
      setLiveRuns(mapped)
      setSelectedId((current) => mapped.some((item) => item.id === current) ? current : mapped[0].id)
    }).catch(() => {
      // Keep the local fixture when the runtime is unavailable.
    }).finally(() => { if (!cancelled) setRuntimeLoading(false) })
    return () => { cancelled = true }
  }, [])
  const selected = liveRuns.find((run) => run.id === selectedId) ?? liveRuns[0]
  const visible = useMemo(() => filter === 'All' ? liveRuns : liveRuns.filter((run) => run.state === filter), [filter, liveRuns])

  return (
    <div className="run-timeline">
      <div className="run-timeline__toolbar">
        <div><span className="eyebrow">Execution control plane</span><h2>Run Timeline</h2><p>Inspect lifecycle, tool activity, changes, approvals and verification for each agent run.</p></div>
        <div className="run-timeline__toolbar-actions"><span className="mono-text">{runtimeLoading ? 'Syncing runtime…' : `${liveRuns.length} runs`}</span><button className="studio-button" type="button" onClick={() => void refreshRuns().then(() => onAction('Runtime runs refreshed')).catch((error) => onAction(error instanceof Error ? error.message : 'Run refresh failed'))} disabled={runtimeLoading}><Icon name="refresh" size={13} /> Refresh</button><button className="studio-button" type="button" onClick={() => onAction('Run export is not exposed by the runtime yet')}><Icon name="download" size={13} /> Export</button><button className="studio-button studio-button--active" type="button" onClick={() => void runtime.runs.create('New AgentiCOS run').then((run) => { const next = { id: run.run_id, title: 'New AgentiCOS run', state: normalizeRunState(run.state), duration: 'Runtime', agent: 'Runtime', model: 'Auto route', tools: 0, tokens: '—', changes: '—' }; setLiveRuns((current) => [next, ...current]); setSelectedId(run.run_id); onAction('New runtime run created') }).catch((error) => onAction(error instanceof Error ? error.message : 'Run creation failed'))}><Icon name="plus" size={13} /> New run</button></div>
      </div>
      <div className="run-timeline__filters"><div className="segmented">{(['All','Active','Completed','Failed','Cancelled'] as Filter[]).map((item) => <button type="button" key={item} className={filter === item ? 'segmented--active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><span className="mono-text">{visible.length} runs</span></div>

      <div className="run-timeline__layout">
        <aside className="run-timeline__list">
          {visible.map((run) => <button type="button" key={run.id} className={selected.id === run.id ? 'run-timeline__run run-timeline__run--active' : 'run-timeline__run'} onClick={() => setSelectedId(run.id)}>
            <span className={run.state === 'Active' ? 'status-dot status-dot--live' : 'status-dot status-dot--offline'} />
            <span><strong>{run.id} · {run.title}</strong><small>{run.agent} · {run.duration} · {run.model}</small></span>
            <span className={`state-pill state-pill--${run.state.toLowerCase()}`}>{run.state}</span>
          </button>)}
        </aside>

        <section className="run-timeline__detail">
          <header className="run-timeline__detail-head"><div><span className="eyebrow">{selected.state}</span><h3>{selected.id}</h3><p>{selected.title} · {selected.agent}</p></div><div><button className="icon-button" type="button" title="Copy run id" aria-label="Copy run id" onClick={() => onAction(selected.id + ' copied')}><Icon name="copy" size={14} /></button>{selected.state === 'Active' && <button className="studio-button" type="button" onClick={() => void runtime.runs.cancel(selected.id).then(() => { setLiveRuns((current) => current.map((run) => run.id === selected.id ? { ...run, state: 'Cancelled' } : run)); onAction(selected.id + ' cancelled in runtime') }).catch((error) => onAction(error instanceof Error ? error.message : 'Run cancellation failed'))}><Icon name="stop" size={13} /> Cancel</button>}<button className="studio-button" type="button" onClick={() => onAction(selected.id + ' re-run is not exposed by the runtime yet')}><Icon name="play" size={13} /> Re-run</button></div></header>
          <div className="run-timeline__stats"><Stat label="Duration" value={selected.duration + ' 32s'} /><Stat label="Tools" value={String(selected.tools)} /><Stat label="Tokens" value={selected.tokens} /><Stat label="Changes" value={selected.changes} /></div>
          <div className="run-timeline__tabs" role="tablist">{(['Timeline','Tools','Changes'] as const).map((item) => <button type="button" key={item} role="tab" aria-selected={view === item} className={view === item ? 'run-timeline__tab run-timeline__tab--active' : 'run-timeline__tab'} onClick={() => setView(item)}>{item}</button>)}</div>
          {view === 'Timeline' && <div className="run-timeline__events">{[
            ['10:41', 'Planning', 'Scope resolved and context sealed', 'done'],
            ['10:43', 'Approval', 'Workspace write policy checked', 'done'],
            ['10:44', 'Execution', selected.tools + ' tool calls across repository operations', selected.state === 'Active' ? 'active' : 'done'],
            ['10:51', 'Verification', 'TypeScript, tests and diff review', selected.state === 'Completed' ? 'done' : selected.state === 'Failed' ? 'failed' : 'pending'],
            ['10:55', 'Handoff', 'Artifacts and execution summary prepared', selected.state === 'Completed' ? 'done' : 'pending'],
          ].map(([time,title,detail,state]) => <div className="run-timeline__event" key={title}><span>{time}</span><span className={`run-timeline__marker run-timeline__marker--${state}`}>{state === 'done' ? <Icon name="check" size={11} /> : state === 'active' ? <Icon name="play" size={10} /> : state === 'failed' ? <Icon name="alert" size={11} /> : null}</span><div><strong>{title}</strong><small>{detail}</small></div></div>)}</div>}
          {view === 'Tools' && <div className="run-timeline__event-table">{['filesystem.read_file','git.diff','provider.route','terminal.check','artifact.write'].map((tool,index)=><div key={tool}><span>{String(index+1).padStart(2,'0')}</span><strong>{tool}</strong><small>{index===3 && selected.state==='Active' ? 'running' : '42 ms'}</small><span>{index < 4 ? 'ok' : 'queued'}</span></div>)}</div>}
          {view === 'Changes' && <div className="run-timeline__change-panel"><div><span className="eyebrow">Working tree</span><strong>{selected.changes}</strong><small>Diff preview · no runtime mutation from this UI.</small></div><pre>@@ src/features/agents/AgentBuilder.tsx
+ profile settings and scoped policies
@@ src/features/subagents/SubagentBuilder.tsx
+ isolation and handoff controls</pre><div className="platform-actions"><button className="studio-button" type="button" onClick={() => onAction('Diff inspector opened in preview')}>Inspect diff</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Checkpoint staged in preview')}><Icon name="git" size={13} /> Checkpoint</button></div></div>}
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="run-timeline__stat"><span>{label}</span><strong>{value}</strong></div> }


function normalizeRunState(state: string): RunState {
  const value = state.toLowerCase()
  if (value.includes('fail')) return 'Failed'
  if (value.includes('cancel')) return 'Cancelled'
  if (value.includes('complet')) return 'Completed'
  return 'Active'
}
