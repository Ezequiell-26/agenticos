import { useState } from 'react'
import Icon from '../../components/Icon'

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
  const run = (name: string) => { setRunningOp(name); onAction(name + ' started in preview'); window.setTimeout(() => setRunningOp(null), 1000) }
  return (
    <div className="operations-center">
      <header className="capability-head"><div><span className="eyebrow">Administration</span><h2>Operations Center</h2><p>Maintenance, health, backup, restore and support workflows.</p></div><span className="state-pill state-pill--pending">Preview</span></header>
      <div className="capability-tabs" role="tablist" aria-label="Operations tabs">{(['Health','Doctor','Backups','Maintenance','Support'] as OpTab[]).map((item) => <button type="button" key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'capability-tab capability-tab--active' : 'capability-tab'} onClick={() => setTab(item)}>{item}</button>)}</div>
      <div className="operations-content">
        {tab === 'Health' && <><div className="operation-metric-grid">{[['Runtime','Ready'],['Providers','4 configured'],['Gateway','Stopped'],['Memory','Bounded']].map(([label,value]) => <div className="metric-card" key={label}><span>{label}</span><strong>{value}</strong><small>presentation state</small></div>)}</div><section className="surface-block"><div className="surface-block__heading"><span>Operations</span><span className="mono-text">safe actions</span></div>{operations.map(([name,detail,state]) => <div className="operation-row" key={name}><div><strong>{name}</strong><span>{detail}</span></div><span className="state-pill state-pill--pending">{state}</span><button className={runningOp === name ? 'studio-button studio-button--active' : 'studio-button'} type="button" onClick={() => run(name)}>{runningOp === name ? 'Running…' : 'Open'}</button></div>)}</section></>}
        {tab === 'Doctor' && <div className="operation-check-grid">{['Runtime configuration','Provider registry','Frontend contract','Workspace permissions','Cache integrity','Dependency tree','Gateway configuration','MCP registry'].map((item,index) => <div key={item}><Icon name={index < 6 ? 'check' : 'activity'} size={14} /><span><strong>{item}</strong><small>{index < 6 ? 'Pass in preview' : 'Not executed'}</small></span></div>)}</div>}
        {tab === 'Backups' && <div className="backup-grid"><div className="backup-card"><span className="eyebrow">Latest backup</span><strong>backup-2026-09-24</strong><small>Configuration + workspace metadata · 18.2 MB preview</small><div className="platform-actions"><button className="studio-button studio-button--active" type="button" onClick={() => run('Create backup')}><Icon name="archive" size={13} /> Create backup</button><button className="studio-button" type="button" onClick={() => onAction('Restore inspection opened in preview')}>Inspect</button></div></div><div className="backup-card"><span className="eyebrow">Recovery policy</span><strong>Fail closed</strong><small>Restore requires explicit review before mutation.</small></div></div>}
        {tab === 'Maintenance' && <div className="operation-check-grid">{['Update skills','Prune checkpoints','Rebuild index','Refresh provider catalog','Rotate session metadata','Generate support dump'].map((item)=><button className="operation-action-card" type="button" key={item} onClick={() => run(item)}><Icon name="settings" size={14} /><span>{item}</span><Icon name="chevron-right" size={12} /></button>)}</div>}
        {tab === 'Support' && <div className="support-grid"><div className="backup-card"><span className="eyebrow">System prompt</span><strong>18.6k tokens</strong><small>Breakdown by rules, tools, skills and context.</small><button className="studio-button" type="button" onClick={() => onAction('Prompt size breakdown opened in preview')}>Inspect</button></div><div className="backup-card"><span className="eyebrow">Support dump</span><strong>Redacted bundle</strong><small>No secret values rendered. Export remains runtime-owned.</small><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Support dump prepared in preview')}>Prepare support dump</button></div></div>}
      </div>
    </div>
  )
}
