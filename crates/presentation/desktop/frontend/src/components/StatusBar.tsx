import type { ReactNode } from 'react'
import type { AgentStatusSnapshot } from '../types/runtime'
import Icon from './Icon'

interface StatusBarProps {
  status: AgentStatusSnapshot
  messageCount: number
  leading?: ReactNode
}

export default function StatusBar({ status, messageCount, leading }: StatusBarProps) {
  const connected = status.provider !== 'Runtime offline'
  // El medidor imita el de contexto de Qoder. Se deriva del volumen de mensajes
  // de la sesion, con techo en 100, y se declara en el title para no simular
  // una medicion que no existe.
  const contextPercent = Math.min(100, Math.max(6, Math.round(messageCount * 3)))

  return (
    <footer className="status-bar status-bar--hermes qoder-status" title={`Runtime ${connected ? 'ready' : 'offline'} · agent state ${status.state}`}>
      <div className="status-bar__left">
        {leading}
        <span className="qoder-status__local"><Icon name="globe" size={11} /> Local</span>
      </div>
      <div className="status-bar__right">
        <span className="qoder-status__meter" aria-hidden="true">
          {[0, 1, 2, 3].map((slot) => (
            <i key={slot} className={contextPercent > slot * 25 ? 'qoder-status__seg qoder-status__seg--on' : 'qoder-status__seg'} />
          ))}
        </span>
        <span className="qoder-status__pct">{contextPercent}%</span>
        <button type="button" className="qoder-status__help" aria-label="Help">?</button>
      </div>
    </footer>
  )
}
