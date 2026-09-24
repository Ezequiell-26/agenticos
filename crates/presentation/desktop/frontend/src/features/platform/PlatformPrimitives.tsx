import type { ReactNode } from 'react'
import Icon from '../../components/Icon'

export function Shell({ children }: { children: ReactNode }) {
  return <section className="platform-surface">{children}</section>
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div className="platform-panel"><div className="platform-panel__head"><strong>{title}</strong><span className="mono-text">preview</span></div><div className="platform-panel__body">{children}</div></div>
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

export function Tag({ label }: { label: string }) {
  return <span className="platform-tag">{label}</span>
}

export function Toast({ message }: { message: string }) {
  if (!message) return null
  return <div className="platform-toast" role="status" aria-live="polite"><Icon name="check" size={14} /><span>{message}</span></div>
}
