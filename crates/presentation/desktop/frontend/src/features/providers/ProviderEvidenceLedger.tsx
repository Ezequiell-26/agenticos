import { useState } from 'react'
import Icon from '../../components/Icon'

type EvidenceStatus = 'Available' | 'Pending' | 'Blocked'
const evidence = [
  ['PV-001', 'Provider registry + model catalog', 'Deterministic test', 'Available', 'provider_plane_integration.rs'],
  ['PV-002', 'Declared failover order', 'Deterministic test', 'Available', 'provider_plane_integration.rs'],
  ['PV-004', 'Health-driven selection', 'Runtime adapter', 'Pending', 'health_check_drives_failover_selection'],
  ['PV-005', 'Retry + quota resilience', 'CI', 'Pending', 'Step 25 acceptance'],
  ['PV-006', 'Provider-scoped credentials', 'Manual review', 'Blocked', 'security gate'],
  ['PV-008', 'Multi-provider orchestration', 'CI', 'Pending', 'Step 25 acceptance'],
] as const

export default function ProviderEvidenceLedger({ onInspect }: { onInspect: (message: string) => void }) {
  const [filter, setFilter] = useState<'All' | EvidenceStatus>('All')
  const visible = filter === 'All' ? evidence : evidence.filter((item) => item[3] === filter)
  return (
    <section className="provider-evidence-ledger" aria-labelledby="provider-evidence-ledger-title">
      <div className="provider-evidence-ledger__head"><div><span className="eyebrow">Provenance</span><h3 id="provider-evidence-ledger-title">Evidence ledger</h3><small>Keep simulated readiness separate from CI, adapter and security evidence.</small></div><div>{(['All', 'Available', 'Pending', 'Blocked'] as const).map((item) => <button key={item} type="button" className={filter === item ? 'soft-button soft-button--active' : 'soft-button'} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
      <div className="provider-evidence-ledger__list">{visible.map(([id, title, kind, status, source]) => <button type="button" className="provider-evidence-row" key={id} onClick={() => onInspect(id + ' evidence source ' + source + ' opened in preview')}><span className="provider-evidence-row__id">{id}</span><span><strong>{title}</strong><small>{kind} · {source}</small></span><span className={'state-pill ' + (status === 'Available' ? 'state-pill--completed' : status === 'Blocked' ? 'state-pill--pending' : 'state-pill--active')}>{status}</span><Icon name="chevron-right" size={12} /></button>)}{visible.length === 0 && <div className="provider-evidence-ledger__empty">No evidence records match this filter.</div>}</div>
    </section>
  )
}
