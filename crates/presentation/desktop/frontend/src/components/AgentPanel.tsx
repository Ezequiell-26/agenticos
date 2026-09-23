import type { AgentStatusSnapshot } from '../types/runtime'
import Icon from './Icon'

interface AgentPanelProps {
  status: AgentStatusSnapshot
  running: boolean
  onRun: () => void
  onStop: () => void
}

export default function AgentPanel({ status, running, onRun, onStop }: AgentPanelProps) {
  const connected = status.provider !== 'Runtime offline'

  return (
    <aside className="agent-panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Agent</div>
          <h2>{status.agentName}</h2>
        </div>
        <div className="agent-presence" title={connected ? 'Runtime connected' : 'Runtime offline'}>
          <span className={`status-dot ${connected ? 'status-dot--live' : 'status-dot--offline'}`} />
        </div>
      </div>

      <div className="agent-card agent-card--hero">
        <div className="agent-card__topline">
          <span className="live-label"><span className="live-pulse" />{running ? 'Working' : 'Ready'}</span>
          <span className="mono-text">{status.state}</span>
        </div>

        <div className="agent-orb" aria-hidden="true"><span className="orb-core" /></div>

        <div className="agent-card__metrics">
          <div><span>Provider</span><strong>{status.provider}</strong></div>
          <div><span>Model</span><strong>{status.model}</strong></div>
        </div>

        <button className={`run-button ${running ? 'run-button--stop' : ''}`} onClick={running ? onStop : onRun} type="button">
          <Icon name={running ? 'stop' : 'play'} size={15} />
          {running ? 'Stop session' : 'Open run mode'}
        </button>
      </div>

      <div className="panel-section">
        <div className="panel-section__heading"><span>Live context</span><span className="mono-text">7.8k / 32k</span></div>
        <div className="context-meter"><span style={{ width: '24%' }} /></div>
        <div className="context-foot"><span>24% in use</span><span>Budget healthy</span></div>
      </div>

      <div className="panel-section">
        <div className="panel-section__heading"><span>Capabilities</span><Icon name="more" size={16} /></div>
        <div className="capability-grid">
          <span><Icon name="code" size={14} /> Code</span>
          <span><Icon name="terminal" size={14} /> Terminal</span>
          <span><Icon name="tool" size={14} /> Tools</span>
          <span><Icon name="git" size={14} /> Git</span>
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-section__heading"><span>Guardrails</span><Icon name="shield" size={15} /></div>
        <div className="guardrail-list">
          <div><Icon name="check" size={14} /><span>Scoped file changes</span></div>
          <div><Icon name="check" size={14} /><span>Secrets isolated</span></div>
          <div><Icon name="check" size={14} /><span>Destructive actions blocked</span></div>
        </div>
      </div>
    </aside>
  )
}
