import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { auditNavigationRegistry } from '../../navigation-audit'
import { Panel, MetricCard, Tag } from './PlatformPrimitives'
import './FrontendQAHarness.css'

type CheckState = 'pass' | 'warning' | 'pending'
type Check = { id:string; area:string; title:string; detail:string; state:CheckState }

const navigationAudit = auditNavigationRegistry()

const checks: Check[] = [
  {id:'routes',area:'Navigation',title:'Route coverage',detail:`Navigation registry: ${navigationAudit.navigationCount} items / ${navigationAudit.platformCount} platform modes / ${navigationAudit.primaryRailCount} primary rail entries. ${navigationAudit.ok ? 'No structural registry drift detected.' : `${navigationAudit.issues.length} structural issue(s) detected.`}`,state:navigationAudit.ok ? 'pass' : 'warning'},
  {id:'lazy',area:'Performance',title:'Lazy loading',detail:'Heavy platform surfaces are loaded on demand instead of inflating the initial bundle.',state:'pass'},
  {id:'states',area:'UX states',title:'Loading / empty / error / offline',detail:'Critical surfaces expose a predictable state model before runtime services are connected.',state:'warning'},
  {id:'a11y',area:'Accessibility',title:'Keyboard and semantics',detail:'Interactive controls require labels, focus visibility, tab semantics and sensible keyboard order.',state:'warning'},
  {id:'responsive',area:'Layout',title:'Responsive desktop shell',detail:'Dense control-plane views must remain usable at reduced window widths.',state:'warning'},
  {id:'boundary',area:'Architecture',title:'Runtime boundary',detail:'Presentation code must not fabricate network, secrets, execution or provider calls.',state:'pass'},
  {id:'typed',area:'Contracts',title:'Typed action boundary',detail:'UI actions should emit typed intent messages that can later map to Tauri/Rust commands.',state:'pass'},
  {id:'visual',area:'Visual consistency',title:'Shared primitives',detail:'Panels, metrics, tags, buttons and status treatments should reuse the platform design language.',state:'pass'},
  {id:'regression',area:'Regression',title:'Duplicate route audit',detail:'No mode should be shadowed by an earlier conditional branch with a different surface.',state:'warning'},
  {id:'verification',area:'Verification',title:'Build and browser verification',detail:'Local TypeScript/Vite and browser/Tauri verification remain explicit release gates.',state:'pending'},
]

const statusLabel: Record<CheckState,string> = {pass:'Ready',warning:'Needs hardening',pending:'Not verified'}

export function FrontendQAHarness({onAction}:{onAction:(message:string)=>void}){
  const [filter,setFilter]=useState(''),[selected,setSelected]=useState('routes')
  const [states,setStates]=useState<Record<string,CheckState>>(()=>Object.fromEntries(checks.map(c=>[c.id,c.state])))
  const filtered=useMemo(()=>checks.filter(c=>[c.area,c.title,c.detail].join(' ').toLowerCase().includes(filter.toLowerCase())),[filter])
  const counts=useMemo(()=>Object.values(states).reduce((a,s)=>({...a,[s]:a[s]+1}),{pass:0,warning:0,pending:0} as Record<CheckState,number>),[states])
  const active=checks.find(c=>c.id===selected) ?? checks[0]
  const mark=(id:string,state:CheckState)=>{setStates(s=>({...s,[id]:state}));onAction(`QA state: ${id} → ${state}`)}

  return <div className="qa-harness">
    <header className="qa-harness__hero">
      <div><span className="eyebrow">Frontend verification plane</span><h1>QA & Hardening</h1><p>Unifica los gates que deben pasar antes de conectar el frontend con Rust/Tauri. Este panel no ejecuta servicios ni modifica runtime.</p></div>
      <div className="qa-harness__badges"><Tag label="Presentation-only"/><span className="state-pill state-pill--pending">Verification required</span></div>
    </header>
    <div className="qa-harness__metrics">
      <MetricCard label="Ready" value={String(counts.pass)} sub="contract / structure"/>
      <MetricCard label="Needs hardening" value={String(counts.warning)} sub="UX / regression"/>
      <MetricCard label="Not verified" value={String(counts.pending)} sub="build / browser"/>
      <MetricCard label="Total gates" value={String(checks.length)} sub="release checklist"/>
    </div>
    <div className="qa-harness__toolbar">
      <div className="qa-harness__search"><Icon name="search" size={14}/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search QA gates…" aria-label="Search QA gates"/></div>
      <button className="studio-button" type="button" onClick={()=>onAction('QA evidence export staged in preview')}><Icon name="arrow-down" size={13}/> Export evidence</button>
      <button className="studio-button studio-button--active" type="button" onClick={()=>onAction('Full frontend QA run staged in preview')}><Icon name="play" size={13}/> Run checklist</button>
    </div>
    <div className="qa-harness__grid">
      <Panel title="Release gates">
        <div className="qa-harness__list">{filtered.map(check=><button type="button" key={check.id} className={selected===check.id?'qa-gate qa-gate--active':'qa-gate'} onClick={()=>setSelected(check.id)}>
          <span className={`qa-gate__dot qa-gate__dot--${states[check.id]}`}/><span><strong>{check.title}</strong><small>{check.area} · {statusLabel[states[check.id]]}</small></span><Icon name="chevron-right" size={13}/>
        </button>)}</div>
      </Panel>
      <Panel title={active.title}>
        <div className="qa-harness__detail"><span className="eyebrow">{active.area}</span><h2>{active.title}</h2><p>{active.detail}</p>
          <div className="qa-harness__detail-grid"><MetricCard label="Current state" value={statusLabel[states[active.id]]} sub="local UI state"/><MetricCard label="Evidence" value={states[active.id]==='pass'?'Available':'Required'} sub="preview only"/></div>
          <div className="qa-harness__actions">
            <button className="studio-button" type="button" onClick={()=>mark(active.id,'pending')}>Mark pending</button>
            <button className="studio-button" type="button" onClick={()=>mark(active.id,'warning')}>Needs hardening</button>
            <button className="studio-button studio-button--active" type="button" onClick={()=>mark(active.id,'pass')}><Icon name="check" size={13}/> Mark ready</button>
          </div>
        </div>
        <div className="callout"><Icon name="shield" size={14}/><span>Regla: si una verificación real todavía no fue ejecutada, no se presenta como aprobada. El frontend conserva el estado pendiente hasta obtener evidencia.</span></div>
      </Panel>
    </div>
  </div>
}
