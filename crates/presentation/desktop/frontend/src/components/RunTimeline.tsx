import Icon from './Icon'

const steps = [
  ['planning', 'Planning', 'Resolve scope, constraints and required approvals'],
  ['executing', 'Execution', 'Run approved tools through the runtime'],
  ['verifying', 'Verification', 'Record evidence before a step can advance'],
] as const

export default function RunTimeline() {
  return (
    <section className="overview-surface">
      <div className="overview-heading">
        <div>
          <span className="eyebrow">Operations</span>
          <h1>Agent runs</h1>
          <p>Lifecycle view for controlled agent execution. This surface is a design preview until a live run contract is exposed by the runtime.</p>
        </div>
        <span className="runtime-chip"><span className="status-dot status-dot--offline" /> preview</span>
      </div>

      <div className="run-card">
        <div className="run-card__header"><span className="mono-text">RUN PREVIEW</span><span>No live run selected</span></div>
        <div className="timeline">
          {steps.map(([state, title, detail], index) => (
            <div className="timeline-row" key={state}>
              <div className="timeline-marker timeline-marker--pending">{index === 0 ? <Icon name="play" size={12} /> : <span />}</div>
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
