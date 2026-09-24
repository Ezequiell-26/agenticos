import type { AgentStatusSnapshot } from '../types/runtime'
import Icon from './Icon'

interface StatusBarProps {
  status: AgentStatusSnapshot
  messageCount: number
}

export default function StatusBar({ status, messageCount }: StatusBarProps) {
  const connected = status.provider !== 'Runtime offline'

  return (
    <footer className="status-bar status-bar--hermes">
      <div className="status-bar__left">
        <span className="status-item status-item--brand"><Icon name="spark" size={11} /> AGENTICOS</span>
        <span className="status-item status-item--action">Add a task →</span>
        <span className="status-item"><span className={`status-dot ${connected ? 'status-dot--live' : 'status-dot--offline'}`} />{connected ? 'Runtime ready' : 'Runtime offline'}</span>
      </div>
      <div className="status-bar__right">
        <span className="status-item"><Icon name="bot" size={12} /> Agents</span>
        <span className="status-item"><Icon name="clock" size={12} /> Cron</span>
        <span className="status-item"><Icon name="globe" size={12} /> Webhooks</span>
        <span className="status-item"><Icon name="message" size={12} /> Session {messageCount}</span>
        <span className="status-item"><Icon name="lock" size={12} /> Guardrails</span>
        <span className="status-item"><Icon name="code" size={12} /> TypeScript</span>
        <span className="status-item status-item--version"># v0.1.0 · {status.state}</span>
      </div>
    </footer>
  )
}
