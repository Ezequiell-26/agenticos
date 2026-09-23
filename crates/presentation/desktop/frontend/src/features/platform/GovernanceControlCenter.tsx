import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { MetricCard, Panel, Tag } from './PlatformPrimitives'

type Tab='overview'|'permissions'|'approvals'|'security'|'hooks'|'audit'|'release'
const policies=[
 ['Workspace writes','Current project only','Allow'],
 ['Network access','Approved endpoints only','Gate'],
 ['Secrets','Never exposed to model UI','Block'],
 ['Destructive Git','Human approval + checkpoint','Gate'],
 ['External publication','Explicit approval required','Gate'],
 ['Command execution','Sandbox + allowlist','Gate'],
]
const approvals=[
 ['APP-024','Publish release candidate','High','Pending'],
 ['APP-023','Enable network access for research','Medium','Pending'],
 ['APP-022','Write generated artifact','Low','Approved'],
 ['APP-021','Run targeted test command','Low','Approved'],
]
const hooks=[
 ['before-run','Resolve scope + policy','Enabled'],
 ['before-tool','Check risk + allowlist','Enabled'],
 ['after-tool','Capture result + artifact','Enabled'],
 ['on-error','Preserve evidence + recovery','Enabled'],
 ['after-run','Compile handoff package','Draft'],
]
const audit=[
 ['10:42:11','policy.check','Destructive Git blocked pending approval'],
 ['10:41:52','approval.request','APP-024 created'],
 ['10:40:03','checkpoint.create','CP-031 saved'],
 ['10:39:18','tool.call','filesystem.read approved'],
 ['10:37:51','session.fork','Review branch created'],
]
const gates=[
 ['Scope resolved','Task, project and target environment sealed','Ready'],
 ['Policy checks','Permissions and dangerous-action rules','Ready'],
 ['Tests','Changed-path verification','Pending'],
 ['Accessibility','Keyboard + responsive evidence','Pending'],
 ['Evidence','Artifacts + logs + provenance','Pending'],
 ['Rollback','Checkpoint + release recovery path','Ready'],
]

export function GovernanceControlCenter({onAction}:{onAction:(message:string)=>void}){
 const [tab,setTab]=useState<Tab>('overview'),[search,setSearch]=useState(''),[armed,setArmed]=useState(true),[selected,setSelected]=useState('APP-024')
 const visibleApprovals=useMemo(()=>approvals.filter(a=>a.join(' ').toLowerCase().includes(search.toLowerCase())),[search])
 const selectedApproval=approvals.find(a=>a[0]===selected)??approvals[0]
 const act=(m:string)=>onAction(m+' staged in preview')
 return <div className="governance-control">
  <header className="governance-control__hero"><div><span className="eyebrow">Safety & release plane</span><h1>Governance Control Center</h1><p>One place to inspect permissions, approvals, security rules, lifecycle hooks, audit evidence and release gates before high-impact actions occur.</p></div><div className="governance-control__actions"><Tag label={armed?'Fail-closed armed':'Preview policy'} /><button className={armed?'studio-button studio-button--active':'studio-button'} type="button" onClick={()=>setArmed(v=>!v)}><Icon name="shield" size={13}/>{armed?'Policy armed':'Policy preview'}</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Run governance preflight')}><Icon name="check-circle" size={13}/>Preflight</button></div></header>
  <div className="platform-metrics"><MetricCard label="Policy rules" value="18" sub="6 critical rules shown"/><MetricCard label="Pending approvals" value="2" sub="High + medium risk"/><MetricCard label="Audit events" value="1,284" sub="Chronological evidence"/><MetricCard label="Release gates" value="3/6" sub="Evidence still required"/></div>
  <div className="governance-control__tabs">{(['overview','permissions','approvals','security','hooks','audit','release'] as const).map(t=><button type="button" key={t} className={tab===t?'governance-tab governance-tab--active':'governance-tab'} onClick={()=>setTab(t)}>{t}</button>)}</div>
  {tab==='overview'&&<div className="governance-control__grid"><Panel title="Critical policy"><div className="policy-list">{policies.map(p=><div key={p[0]}><span><strong>{p[0]}</strong><small>{p[1]}</small></span><Tag label={p[2]}/></div>)}</div></Panel><Panel title="Release readiness"><div className="gate-list">{gates.map(g=><div key={g[0]}><span className={g[2]==='Ready'?'gate-dot gate-dot--ready':'gate-dot'}><Icon name={g[2]==='Ready'?'check':'clock'} size={11}/></span><span><strong>{g[0]}</strong><small>{g[1]}</small></span><Tag label={g[2]}/></div>)}</div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Open release evidence')}>Evidence</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Open release candidate')}>Candidate</button></div></Panel></div>}
  {tab==='permissions'&&<Panel title="Permissions Matrix"><div className="permission-grid">{policies.map(p=><div key={p[0]}><span><strong>{p[0]}</strong><small>{p[1]}</small></span><div><Tag label="Agent"/><Tag label={p[2]}/></div><button className="studio-button" type="button" onClick={()=>act('Edit '+p[0]+' policy')}>Edit</button></div>)}</div></Panel>}
  {tab==='approvals'&&<div className="governance-control__grid"><Panel title="Approval queue"><div className="approval-search"><Icon name="search" size={12}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find approval…" aria-label="Find approval"/></div><div className="approval-list">{visibleApprovals.map(a=><button type="button" key={a[0]} className={selected===a[0]?'approval-row approval-row--active':'approval-row'} onClick={()=>setSelected(a[0])}><span className="approval-code">{a[0]}</span><span><strong>{a[1]}</strong><small>{a[2]} risk</small></span><Tag label={a[3]}/></button>)}</div></Panel><Panel title={selectedApproval[0]}><div className="approval-detail-card"><span className="eyebrow">{selectedApproval[2]} risk</span><h2>{selectedApproval[1]}</h2><p>Approval request carries explicit scope, policy context, rollback reference and evidence requirements.</p><div className="approval-facts"><div><span>Scope</span><strong>Release candidate</strong></div><div><span>Rollback</span><strong>CP-031</strong></div><div><span>Evidence</span><strong>3 attachments</strong></div><div><span>Expiry</span><strong>15 min</strong></div></div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Reject '+selectedApproval[0])}>Reject</button><button className="studio-button" type="button" onClick={()=>act('Request clarification')}>Clarify</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Approve '+selectedApproval[0])}>Approve</button></div></div></Panel></div>}
  {tab==='security'&&<div className="governance-control__grid"><Panel title="Security posture"><div className="security-checks">{['Sandbox boundary','Network policy','Secret isolation','File scope','External publication','Destructive action gate'].map((x,i)=><div key={x}><Icon name="shield" size={13}/><span><strong>{x}</strong><small>{i===4?'Approval required':'Enforced in preview policy'}</small></span><Tag label={i===4?'Gate':'Protected'}/></div>)}</div></Panel><Panel title="Incident response"><div className="incident-stack"><div><span>Open incidents</span><strong>0</strong></div><div><span>Last policy change</span><strong>09:18</strong></div><div><span>Recovery checkpoint</span><strong>CP-031</strong></div><div><span>Evidence retention</span><strong>Workspace policy</strong></div></div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Open security diagnostics')}>Diagnostics</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Export audit evidence')}>Export evidence</button></div></Panel></div>}
  {tab==='hooks'&&<Panel title="Lifecycle hooks"><div className="hook-list">{hooks.map(h=><div key={h[0]}><span><strong>{h[0]}</strong><small>{h[1]}</small></span><Tag label={h[2]}/><button className="studio-button" type="button" onClick={()=>act('Configure '+h[0])}>Configure</button></div>)}</div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Test hook chain')}>Test chain</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Add lifecycle hook')}>Add hook</button></div></Panel>}
  {tab==='audit'&&<Panel title="Audit timeline"><div className="audit-list">{audit.map(a=><div key={a[0]}><code>{a[0]}</code><Tag label={a[1]}/><span>{a[2]}</span><Icon name="chevron-right" size={12}/></div>)}</div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Filter audit events')}>Filter</button><button className="studio-button" type="button" onClick={()=>act('Open correlated run')}>Correlate</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Export audit log')}>Export</button></div></Panel>}
  {tab==='release'&&<Panel title="Release gate"><div className="release-summary"><div><span className="eyebrow">Candidate</span><h2>v0.9.0</h2><p>Candidate cannot be published while required evidence gates remain pending.</p></div><Tag label="Blocked by evidence"/></div><div className="gate-list">{gates.map(g=><div key={g[0]}><span className={g[2]==='Ready'?'gate-dot gate-dot--ready':'gate-dot'}><Icon name={g[2]==='Ready'?'check':'clock'} size={11}/></span><span><strong>{g[0]}</strong><small>{g[1]}</small></span><Tag label={g[2]}/></div>)}</div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Open failed release gates')}>Open blockers</button><button className="studio-button" type="button" onClick={()=>act('Generate release package')}>Evidence package</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Publish release candidate')}>Publish preview</button></div></Panel>}
  <div className="governance-control__guard"><Icon name="shield" size={13}/><span>Governance UI is fail-closed by design. Preview approvals and policy states do not authorize runtime mutation until the backend supplies authoritative scope and evidence.</span></div>
 </div>
