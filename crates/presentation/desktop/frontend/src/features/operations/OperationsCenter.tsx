import { useEffect, useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { runtime } from '../../services/runtime'
import type { RuntimeApiRecord, RuntimeHealth, RuntimeReadiness, RuntimeProviderStatus } from '../../types/runtime'

type OpTab = 'Health' | 'Doctor' | 'Backups' | 'Maintenance' | 'Support'

const operations = [
  ['Health check', 'Runtime health, provider availability and worker state', 'Ready'],
  ['Doctor', 'Inspect installation, configuration and environment invariants', 'Preview'],
  ['Security audit', 'Review permissions, secrets boundaries and policy posture', 'Preview'],
  ['Backup', 'Create a recoverable workspace configuration archive', 'Ready'],
  ['Restore', 'Inspect a backup before restoring local configuration', 'Protected'],
  ['Skills update', 'Discover and review available skill package updates', 'Preview'],
] as const

export default function OperationsCenter({ onAction }: { onAction: (message: string) => void }) {
  const [tab, setTab] = useState<OpTab>('Health')
  const [runningOp, setRunningOp] = useState<string | null>(null)
  const [health, setHealth] = useState<RuntimeHealth | null>(null)
  const [ready, setReady] = useState<RuntimeReadiness | null>(null)
  const [providers, setProviders] = useState<RuntimeProviderStatus[]>([])
  const [metrics, setMetrics] = useState<RuntimeApiRecord | null>(null)
  const [sandbox, setSandbox] = useState<RuntimeApiRecord | null>(null)
  const [auditCount, setAuditCount] = useState<number | null>(null)
  const [runtimeSyncing, setRuntimeSyncing] = useState(true)

  const refresh = async () => {
    setRuntimeSyncing(true)
    const [healthResult, readyResult, providerResult, metricsResult, sandboxResult, auditResult] = await Promise.allSettled([
      runtime.health.get(),
      runtime.health.ready(),
      runtime.providers.list(),
      runtime.metrics.get(),
      runtime.sandbox.status(),
      runtime.audit.list(20),
    ])
    if (healthResult.status === 'fulfilled') setHealth(healthResult.value)
    if (readyResult.status === 'fulfilled') setReady(readyResult.value)
    if (providerResult.status === 'fulfilled') setProviders(providerResult.value)
    if (metricsResult.status === 'fulfilled') setMetrics(metricsResult.value)
    if (sandboxResult.status === 'fulfilled') setSandbox(sandboxResult.value)
    if (auditResult.status === 'fulfilled') setAuditCount(auditResult.value.length)
    setRuntimeSyncing(false)
  }

  useEffect(() => { void refresh() }, [])

  const configuredProviders = useMemo(() => providers.filter((provider) => provider.configured).length, [providers])
  const run = (name: string) => { setRunningOp(name); onAction(name + ' uses the runtime contracts available for this operation'); window.setTimeout(() => setRunningOp(null), 1000) }
  return (
    <div className="operations-center">
      <header className="capability-head"><div><span className="eyebrow">Administration</span><h2>Operations Center</h2><p>Maintenance, health, backup, restore and support workflows.</p></div><span className="state-pill state-pill--pending">{runtimeSyncing ? 'Syncing runtime' : 'Runtime-backed'}</span></header>
      <div className="capability-tabs" role="tablist" aria-label="Operations tabs" aria-orientation="horizontal">{(['Health','Doctor','Backups','Maintenance','Support'] as OpTab[]).map((item, index, tabs) => <button type="button" key={item} id={'operations-tab-' + item.toLowerCase()} role="tab" tabIndex={tab === item ? 0 : -1} aria-selected={tab === item} aria-controls="operations-tabpanel" className={tab === item ? 'capability-tab capability-tab--active' : 'capability-tab'} onClick={() => setTab(item)} onKeyDown={(event) => {
        const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
        if (nextIndex >= 0) { event.preventDefault(); const next = tabs[nextIndex]; setTab(next); window.requestAnimationFrame(() => document.getElementById('operations-tab-' + next.toLowerCase())?.focus()) }
      }}>{item}</button>)}</div>
      <div id="operations-tabpanel" className="operations-content" role="tabpanel" aria-labelledby={'operations-tab-' + tab.toLowerCase()} tabIndex={0}>
        {tab === 'Health' && <><div className="operation-metric-grid">{[
  ['Runtime', health?.status ?? '—'],
  ['Ready', ready?.status ?? '—'],
  ['Providers', configuredProviders + ' configured'],
  ['Audit events', auditCount === null ? '—' : String(auditCount)],
].map(([label,value]) => <div className="metric-card" key={label}><span>{label}</span><strong>{value}</strong><small>runtime state</small></div>)}</div><section className="surface-block"><div className="surface-block__heading"><span>Operations</span><span className="mono-text">runtime contracts</span></div>{operations.map(([name,detail,state]) => <div className="operation-row" key={name}><div><strong>{name}</strong><span>{detail}</span></div><span className="state-pill state-pill--pending">{state}</span><button className={runningOp === name ? 'studio-button studio-button--active' : 'studio-button'} type="button" onClick={() => run(name)}>{runningOp === name ? 'Running…' : 'Open'}</button></div>)}</section></>}
        {tab === 'Doctor' && <div className="operation-check-grid">{
  [['Runtime', health?.status ?? 'Unavailable'], ['Readiness', ready?.status ?? 'Unavailable'], ['Providers', configuredProviders + ' configured'], ['Metrics', metrics ? 'Available' : 'Unavailable'], ['Sandbox', typeof sandbox?.status === 'string' ? String(sandbox.status) : 'Unavailable'], ['Audit', auditCount === null ? 'Unavailable' : String(auditCount) + ' recent events']].map(([item,state]) => <div key={item}><Icon name={state === 'Unavailable' ? 'alert' : 'check'} size={14} /><span><strong>{item}</strong><small>{state}</small></span></div>)
}</div>}
        {tab === 'Backups' && <div className="backup-grid"><div className="backup-card"><span className="eyebrow">Latest backup</span><strong>backup-2026-09-24</strong><small>Configuration + workspace metadata · 18.2 MB preview</small><div className="platform-actions"><button className="studio-button studio-button--active" type="button" onClick={() => run('Create backup')}><Icon name="archive" size={13} /> Create backup</button><button className="studio-button" type="button" onClick={() => onAction('Restore inspection opened in preview')}>Inspect</button></div></div><div className="backup-card"><span className="eyebrow">Recovery policy</span><strong>Fail closed</strong><small>Restore requires explicit review before mutation.</small></div></div>}
        {tab === 'Maintenance' && <div className="operation-check-grid">{['Update skills','Prune checkpoints','Rebuild index','Refresh provider catalog','Rotate session metadata','Generate support dump'].map((item)=><button className="operation-action-card" type="button" key={item} onClick={() => run(item)}><Icon name="settings" size={14} /><span>{item}</span><Icon name="chevron-right" size={12} /></button>)}</div>}
        {tab === 'Support' && <div className="support-grid"><div className="backup-card"><span className="eyebrow">System prompt</span><strong>18.6k tokens</strong><small>Breakdown by rules, tools, skills and context.</small><button className="studio-button" type="button" onClick={() => onAction('Prompt size breakdown opened in preview')}>Inspect</button></div><div className="backup-card"><span className="eyebrow">Support dump</span><strong>Redacted bundle</strong><small>No secret values rendered. Export remains runtime-owned.</small><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Support dump prepared in preview')}>Prepare support dump</button></div></div>}
      </div>
    </div>
  )
}
