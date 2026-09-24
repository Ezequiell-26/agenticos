import { useState } from 'react'
import Icon from '../../components/Icon'
import SubagentBuilder from './SubagentBuilder'

type FleetPolicy = 'Balanced' | 'Latency-first' | 'Evidence-first' | 'Cost-guarded'

const fleetLanes = [
  ['Lane A', 'Code Searcher', 'Research', 'Ready', '24k'],
  ['Lane B', 'Security Reviewer', 'Review', 'Ready', '18k'],
  ['Lane C', 'Test Engineer', 'Execution', 'Running', '32k'],
  ['Lane D', 'Web Researcher', 'Research', 'Idle', '28k'],
] as const

export default function SubagentFleet({ onAction }: { onAction: (message: string) => void }) {
  const [policy, setPolicy] = useState<FleetPolicy>('Balanced')
  const [parallelism, setParallelism] = useState(3)
  const [autoHandoff, setAutoHandoff] = useState(true)

  return (
    <div className="subagent-fleet">
      <header className="subagent-fleet__hero">
        <div>
          <span className="eyebrow">Delegation control plane</span>
          <h1>Subagent Fleet</h1>
          <p>Coordinate specialist agents as isolated workers, tune dispatch policy, and open the detailed builder without collapsing fleet-level operations into one profile.</p>
        </div>
        <div className="subagent-fleet__actions">
          <span className="state-pill state-pill--completed">Runtime boundary</span>
          <button className={autoHandoff ? 'studio-button studio-button--active' : 'studio-button'} type="button" onClick={() => setAutoHandoff((value) => !value)}>
            <Icon name="branch" size={12} /> {autoHandoff ? 'Auto handoff' : 'Manual handoff'}
          </button>
          <button className="studio-button studio-button--active" type="button" onClick={() => onAction('New specialist lane staged in preview')}><Icon name="plus" size={12} /> Add specialist</button>
        </div>
      </header>

      <div className="platform-metrics">
        <div className="platform-metric"><span>Specialists</span><strong>4</strong><small>2 ready · 1 running · 1 idle</small></div>
        <div className="platform-metric"><span>Parallelism</span><strong>{parallelism}</strong><small>of 4 lanes allowed in preview</small></div>
        <div className="platform-metric"><span>Context budget</span><strong>102k</strong><small>across active workers</small></div>
        <div className="platform-metric"><span>Handoff policy</span><strong>{autoHandoff ? 'Automatic' : 'Manual'}</strong><small>Explicit package required</small></div>
      </div>

      <section className="subagent-fleet__control-grid">
        <article className="subagent-fleet__policy">
          <div className="surface-block__heading"><span>Dispatch policy</span><span className="mono-text">presentation preview</span></div>
          <div className="subagent-fleet__policy-options">
            {(['Balanced', 'Latency-first', 'Evidence-first', 'Cost-guarded'] as FleetPolicy[]).map((item) => (
              <button type="button" key={item} className={policy === item ? 'fleet-policy fleet-policy--active' : 'fleet-policy'} onClick={() => setPolicy(item)}>
                <strong>{item}</strong>
                <small>{item === 'Balanced' ? 'Mix quality, latency and cost.' : item === 'Latency-first' ? 'Prefer available fast specialists.' : item === 'Evidence-first' ? 'Require stronger proof packages.' : 'Constrain worker budgets first.'}</small>
              </button>
            ))}
          </div>
          <label className="subagent-fleet__parallel">
            <span>Maximum parallel lanes</span>
            <input type="range" min="1" max="4" value={parallelism} onChange={(event) => setParallelism(Number(event.target.value))} />
            <strong>{parallelism}</strong>
          </label>
          <div className="subagent-fleet__dispatch-note"><Icon name="shield" size={13} /><span>Dispatch does not grant permissions. Each specialist keeps its own context, toolset, memory scope and approval envelope.</span></div>
        </article>

        <article className="subagent-fleet__lanes">
          <div className="surface-block__heading"><span>Live lanes</span><span className="mono-text">4 configured</span></div>
          {fleetLanes.map(([lane, name, role, status, budget]) => (
            <button type="button" className="fleet-lane" key={lane} onClick={() => onAction(name + ' opened in specialist builder preview')}>
              <span className={'fleet-lane__status fleet-lane__status--' + status.toLowerCase()}><Icon name={status === 'Running' ? 'activity' : status === 'Ready' ? 'check' : 'clock'} size={11} /></span>
              <span><strong>{lane} · {name}</strong><small>{role} · {budget} context · {status}</small></span>
              <Icon name="chevron-right" size={12} />
            </button>
          ))}
        </article>
      </section>

      <section className="subagent-fleet__builder-wrap">
        <div className="subagent-fleet__builder-heading">
          <div><span className="eyebrow">Detailed worker configuration</span><strong>Specialist Builder</strong><small>Task, context, delegation, safety and run state remain fully editable below.</small></div>
          <span className="state-pill state-pill--pending">Presentation only</span>
        </div>
        <SubagentBuilder onAction={onAction} />
      </section>
    </div>
  )
}
