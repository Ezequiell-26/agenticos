import type { ReactNode } from 'react'
import Icon from '../../components/Icon'

export function Shell({ children }: { children: ReactNode }) {
  return <section className="platform-surface">{children}</section>
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div className="platform-panel"><div className="platform-panel__head"><strong>{title}</strong></div><div className="platform-panel__body">{children}</div></div>
}

export function Metric({ label, value }: { label: string; value: string }) {
  return <div className="platform-metric-row"><span>{label}</span><strong>{value}</strong></div>
}

export function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="platform-metric-card"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>
}

export function List({ items }: { items: string[] }) {
  return <div className="platform-list">{items.map((item, index) => <div key={String(index) + '-' + item}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item}</strong></div>)}</div>
}

/** Etiqueta de riesgo/permiso con el tono del panel de insights:
 *  critical y high al tono de peligro, medium al de aviso, low al de éxito. */
export function tagTone(label: string): string {
  const key = label.trim().toLowerCase()
  if (key === 'critical' || key === 'high' || key === 'blocked' || key === 'failed' || key === 'denied') return ' platform-tag--danger'
  if (key === 'medium' || key === 'approval' || key === 'pending' || key === 'review') return ' platform-tag--warning'
  if (key === 'low' || key === 'allowed' || key === 'enabled' || key === 'passed' || key === 'ok') return ' platform-tag--success'
  return ''
}

export function Tag({ label }: { label: string }) {
  return <span className={'platform-tag' + tagTone(label)}>{label}</span>
}

export function Toast({ message }: { message: string }) {
  if (!message) return null
  return <div className="platform-toast" role="status" aria-live="polite"><Icon name="check" size={14} /><span>{message}</span></div>
}
