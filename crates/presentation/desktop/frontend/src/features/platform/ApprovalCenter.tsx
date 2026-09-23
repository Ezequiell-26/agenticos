import React from 'react'
import Icon from '../../components/Icon'
import { Panel, Shell, Toast } from './PlatformPrimitives'

type Approval = { id:string; title:string; actor:string; action:string; risk:string; scope:string; detail:string }
const approvals: Approval[] = [
 {id:'APR-042',title:'Modify provider routing',actor:'Builder',action:'Edit routing policy',risk:'High',scope:'workspace / providers',detail:'Changes primary and fallback model selection rules.'},
 {id:'APR-041',title:'Enable network research',actor:'Researcher',action:'Network access',risk:'Medium',scope:'session / research',detail:'Allows outbound web requests for the current research task.'},
 {id:'APR-040',title:'Write release artifact',actor:'Release Bot',action:'Create artifact',risk:'Low',scope:'workspace / artifacts',detail:'Prepares a release evidence package without changing source files.'},
]
export function ApprovalCenter({onAction}:{onAction:(message:string)=>void}) {
 const [selected,setSelected]=React.useState(approvals[0].id)
 const [decision,setDecision]=React.useState<Record<string,string>>({})
 const current=approvals.find(x=>x.id===selected) ?? approvals[0]
 return <Shell>
  <header className="platform-header"><div><span className="eyebrow">Human control gate</span><h1>Approval Center</h1><p>Review sensitive agent actions before execution. The UI never grants a real permission by itself.</p></div><span className="state-pill state-pill--pending">{approvals.filter(x=>!decision[x.id]).length} pending</span></header>
  <div className="approval-layout">
   <div className="approval-list">{approvals.map(item=><button key={item.id} type="button" className={selected===item.id?'approval-row approval-row--active':'approval-row'} onClick={()=>setSelected(item.id)}><span className={`approval-risk approval-risk--${item.risk.toLowerCase()}`}>{item.risk}</span><div><strong>{item.title}</strong><span>{item.id} · {item.actor}</span></div><small>{decision[item.id] ?? 'Pending'}</small></button>)}</div>
   <Panel title={current.id}>
    <div className="approval-detail"><span className="eyebrow">{current.risk} risk · {current.action}</span><h2>{current.title}</h2><p>{current.detail}</p>
     <div className="approval-facts"><div><span>Actor</span><strong>{current.actor}</strong></div><div><span>Scope</span><strong>{current.scope}</strong></div><div><span>Policy</span><strong>Fail-closed</strong></div><div><span>Decision</span><strong>{decision[current.id] ?? 'Pending'}</strong></div></div>
     <div className="callout"><Icon name="shield" size={14}/><span>Approval should be evaluated against policy, requested scope, affected resources and an auditable decision reason.</span></div>
     <label className="approval-reason">Decision note<textarea placeholder="Optional reason for the decision…" /></label>
     <div className="platform-actions"><button className="studio-button" type="button" onClick={()=>{setDecision(d=>({...d,[current.id]:'Denied'}));onAction(current.id+' denied in preview')}}>Deny</button><button className="studio-button studio-button--active" type="button" onClick={()=>{setDecision(d=>({...d,[current.id]:'Approved'}));onAction(current.id+' approved in preview')}}><Icon name="check" size={14}/> Approve preview</button></div>
    </div>
   </Panel>
  </div><Toast message="" />
 </Shell>
}
