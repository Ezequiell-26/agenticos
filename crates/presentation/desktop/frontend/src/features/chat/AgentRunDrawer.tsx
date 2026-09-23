import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'

type RunTab = 'Overview' | 'Plan' | 'Tools' | 'Changes' | 'Context'

interface AgentRunDrawerProps {
  open: boolean
  running: boolean
  onClose: () => void
  onAction: (message: string) => void
}

const steps = [
  ['01', 'Interpret objective', 'completed', '48 ms'],
  ['02', 'Assemble context', 'completed', '112 ms'],
  ['03', 'Plan changes', 'completed', '238 ms'],
  ['04', 'Execute tools', 'running', '1.8 s'],
  ['05', 'Verify result', 'queued', '—'],
  ['06', 'Prepare handoff', 'queued', '—'],
] as const

const tools = [
  ['filesystem', 'read_file', 'completed', '42 ms'],
  ['codebase', 'semantic_search', 'completed', '118 ms'],
  ['terminal', 'cargo_check', 'running', '1.6 s'],
  ['git', 'diff', 'queued', '—'],
] as const

const changes = [
  ['src/components/ChatSurface.tsx', 'modified', '+32 / -4'],
  ['src/features/chat/AgentRunDrawer.tsx', 'added', '+214'],
  ['docs/architecture/FRONTEND-PLATFORM-ARCHITECTURE.md', 'modified', '+18 / -0'],
] as const

const context = [
  ['Workspace files', '42.8k', 'included'],
  ['Open files', '8.4k', 'included'],
  ['Project rules', '3.2k', 'included'],
  ['Pinned memory', '2.7k', 'included'],
  ['Git diff', '5.1k', 'optional'],
] as const

export default function AgentRunDrawer({ open, running, onClose, onAction }: AgentRunDrawerProps) {
  const [tab, setTab] = useState<RunTab>('Overview')

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <aside className="agent-run-drawer" aria-label="Agent run trace">
      <div className="agent-run-drawer__head">
        <div>
          <span className="eyebrow">Execution trace</span>
          <strong>RUN-LOCAL-001</strong>
          <small>{running ? 'Working through the current objective' : 'Preview run · runtime details appear when connected'}</small>
        </div>
        <div className="agent-run-drawer__head-actions">
          <span className={running ? 'state-pill state-pill--active' : 'state-pill state-pill--pending'}>{running ? 'Running' : 'Preview'}</span>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close run trace"><Icon name="x" size={15} /></button>
        </div>
      </div>

      <div className="agent-run-drawer__metrics">
        <Metric label="Steps" value="6" />
        <Metric label="Tools" value="4" />
        <Metric label="Context" value="62.2k" />
        <Metric label="Changes" value="3" />
      </div>

      <div className="agent-run-tabs" role="tablist" aria-label="Run trace views">
        {(['Overview', 'Plan', 'Tools', 'Changes', 'Context'] as RunTab[]).map((item) => (
          <button type="button" key={item} role="tab" aria-selected={tab === item} aria-controls={'agent-run-panel-' + item.toLowerCase()} id={'agent-run-tab-' + item.toLowerCase()} className={tab === item ? 'agent-run-tab agent-run-tab--active' : 'agent-run-tab'} onClick={() => setTab(item)}>{item}</button>
        ))}
      </div>

      <div className="agent-run-drawer__body">
        {tab === 'Overview' && <>
          <div id="agent-run-panel-overview" role="tabpanel" aria-labelledby="agent-run-tab-overview" tabIndex={0}>
          <SectionHeading title="Lifecycle" detail="deterministic order" />
          <div className="run-trace-list">{steps.map(([index, title, state, duration]) => <div className="run-trace-step" key={index}>
            <span className="run-trace-step__index">{index}</span>
            <span className={`run-trace-step__marker run-trace-step__marker--${state}`}>{state === 'completed' ? <Icon name="check" size={11} /> : state === 'running' ? <span /> : ''}</span>
            <div><strong>{title}</strong><small>{state} · {duration}</small></div>
          </div>)}</div>
          <SectionHeading title="Current objective" detail="session scope" />
          <div className="trace-objective"><strong>Complete the current frontend slice without breaking existing contracts.</strong><span>Planning, mutation, verification and handoff remain visible as separate states.</span></div>
        </div></>}
        {tab === 'Plan' && <div className="run-plan-list" id="agent-run-panel-plan" role="tabpanel" aria-labelledby="agent-run-tab-plan" tabIndex={0}>{['Inspect workspace and active rules', 'Assemble relevant context pack', 'Implement the smallest reversible slice', 'Run frontend verification', 'Inspect regressions and changed files', 'Prepare evidence and handoff'].map((item, index) => <div key={item} className="run-plan-item"><span>0{index + 1}</span><div><strong>{item}</strong><small>{index < 4 ? 'defined in preview' : 'queued'}</small></div><Icon name={index < 4 ? 'check' : 'clock'} size={12} /></div>)}</div>}
        {tab === 'Tools' && <div className="run-tool-list" id="agent-run-panel-tools" role="tabpanel" aria-labelledby="agent-run-tab-tools" tabIndex={0}>{tools.map(([group, name, state, duration]) => <div className="run-tool-row" key={name}><div className="tool-icon"><Icon name={group === 'terminal' ? 'terminal' : group === 'git' ? 'git' : 'tool'} size={13} /></div><div><strong>{name}</strong><small>{group} · {duration}</small></div><span className={state === 'completed' ? 'state-pill state-pill--completed' : state === 'running' ? 'state-pill state-pill--active' : 'state-pill state-pill--pending'}>{state}</span></div>)}</div>}
        {tab === 'Changes' && <div className="run-change-list" id="agent-run-panel-changes" role="tabpanel" aria-labelledby="agent-run-tab-changes" tabIndex={0}>{changes.map(([file, state, delta]) => <button type="button" key={file} onClick={() => onAction(`Opened ${file} diff in preview`)}><Icon name="code" size={14} /><div><strong>{file}</strong><small>{state} · {delta}</small></div><Icon name="chevron-right" size={13} /></button>)}</div>}
        {tab === 'Context' && <div className="run-context-list" id="agent-run-panel-context" role="tabpanel" aria-labelledby="agent-run-tab-context" tabIndex={0}>{context.map(([name, tokens, state]) => <div key={name} className="run-context-row"><div><strong>{name}</strong><small>{state}</small></div><span className="mono-text">{tokens}</span><Icon name={state === 'included' ? 'check' : 'more'} size={12} /></div>)}</div>}
      </div>

      <div className="agent-run-drawer__foot">
        <button className="studio-button" type="button" onClick={() => onAction('Checkpoint capture opened in preview')}><Icon name="git" size={13} /> Checkpoint</button>
        <button className="studio-button" type="button" onClick={() => onAction('Run restart staged in preview')}><Icon name="history" size={13} /> Restart</button>
        <button className="studio-button studio-button--active" type="button" onClick={() => onAction('Run handoff opened in preview')}>Open handoff</button>
      </div>
    </aside>
  )
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return <div className="run-section-heading"><strong>{title}</strong><span>{detail}</span></div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="run-metric"><span>{label}</span><strong>{value}</strong></div>
}