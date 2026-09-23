import type { AgentStatusSnapshot } from '../types/runtime'
import Icon from './Icon'

interface StatusBarProps {
  status: AgentStatusSnapshot
  messageCount: number
}

export default function StatusBar({ status, messageCount }: StatusBarProps) {
  const connected = status.provider !== 'Runtime offline'

  return (
    <footer className="status-bar">
      <div className="status-bar__left">
        <span className="status-item"><span className={`status-dot ${connected ? 'status-dot--live' : 'status-dot--offline'}`} />{status.provider}</span>
        <span className="status-item"><Icon name="branch" size={13} /> main</span>
      </div>
      <div className="status-bar__right">
        <span className="status-item"><Icon name="message" size={13} /> {messageCount} messages</span>
        <span className="status-item"><Icon name="shield" size={13} /> Guardrails active</span>
        <span className="status-item"><Icon name="code" size={13} /> TypeScript</span>
      </div>
    </footer>
  )
}
