import Icon from './Icon'

const steps = [
  ['planning', 'Plan generated', 'Scope and constraints resolved', 'done'],
  ['executing', 'Execution', 'Provider + tools active', 'active'],
  ['verifying', 'Verification', 'Waiting for runtime evidence', 'pending'],
] as const

export default function RunTimeline() {
  return (
    <section className="overview-surface">
      <div className="overview-heading">
        <div>
          <span className="eyebrow">Operations</span>
          <h1>Agent runs</h1>
          <p>Follow the lifecycle of a run without collapsing execution into a single loading state.</p>
        </div>
        <span className="runtime-chip"><span className="status-dot status-dot--live" /> live view</span>
      </div>

      <div className="run-card">
        <div className="run-card__header"><span className="mono-text">RUN-LOCAL-001</span><span>Active session</span></div>
        <div className="timeline">
          {steps.map(([state, title, detail, status], index) => (
            <div className="timeline-row" key={state}>
              <div className={`timeline-marker timeline-marker--${status}`}>{status === 'done' ? <Icon name="check" size={13} /> : status === 'active' ? <Icon name="play" size={12} /> : <span />}</div>
              <div className="timeline-copy"><div><strong>{title}</strong><span className="mono-text">{state}</span></div><small>{detail}</small></div>
              {index < steps.length - 1 && <div className="timeline-line" />}
            </div>
          ))}
        </div>
      </div>

      <div className="overview-grid overview-grid--two">
        <div className="overview-card"><span>Guardrails</span><strong>Scoped mutations</strong><small>Approval remains required for destructive actions.</small></div>
        <div className="overview-card"><span>Recovery</span><strong>Checkpoint aware</strong><small>Runtime state stays outside ephemeral UI state.</small></div>
      </div>
    </section>
  )
}
