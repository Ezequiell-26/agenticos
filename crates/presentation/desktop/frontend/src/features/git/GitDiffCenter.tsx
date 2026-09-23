import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'

type Change={id:string;path:string;status:'M'|'A'|'D';additions:number;deletions:number;scope:string;selected:boolean}
const seed:Change[]=[
 {id:'c1',path:'src/features/agents/AgentBuilder.tsx',status:'A',additions:471,deletions:0,scope:'frontend',selected:true},
 {id:'c2',path:'src/features/subagents/SubagentBuilder.tsx',status:'A',additions:257,deletions:0,scope:'frontend',selected:false},
 {id:'c3',path:'src/features/platform/PlatformSurface.tsx',status:'M',additions:21,deletions:39,scope:'frontend',selected:true},
 {id:'c4',path:'src/components/StudioSurface.tsx',status:'M',additions:17,deletions:63,scope:'frontend',selected:false},
 {id:'c5',path:'workspace-enhancements.css',status:'M',additions:420,deletions:0,scope:'visual-system',selected:false},
 {id:'c6',path:'docs/architecture/FRONTEND-ARCHITECTURE.md',status:'M',additions:28,deletions:0,scope:'docs',selected:false},
]
const tabs=['Changes','Staged','Review'] as const
export default function GitDiffCenter({onAction}:{onAction:(message:string)=>void}){
 const [changes,setChanges]=useState(seed); const [selected,setSelected]=useState(seed[0].id); const [tab,setTab]=useState<(typeof tabs)[number]>('Changes'); const [query,setQuery]=useState(''); const [showWhitespace,setShowWhitespace]=useState(false)
 const current=changes.find(item=>item.id===selected)??changes[0]
 const visible=useMemo(()=>{const q=query.trim().toLowerCase(); return (q?changes.filter(item=>item.path.toLowerCase().includes(q)):changes).filter(item=>tab==='Staged'?item.selected:true)},[changes,query,tab])
 function toggleStage(id:string){setChanges(items=>items.map(item=>item.id===id?{...item,selected:!item.selected}:item))}
 return <div className="git-diff-center">
  <aside className="git-diff-center__sidebar">
   <div className="git-diff-center__side-head"><div><span className="eyebrow">Source control</span><strong>Diff Center</strong></div><button className="icon-button" type="button" title="Refresh diff" aria-label="Refresh diff" onClick={()=>onAction('Diff refreshed in preview')}><Icon name="refresh" size={15}/></button></div>
   <div className="git-diff-center__search"><Icon name="search" size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Filter changed files…"/></div>
   <nav className="git-diff-center__tabs" role="tablist">{tabs.map(item=><button type="button" key={item} role="tab" aria-selected={tab===item} className={tab===item?'git-diff-center__tab git-diff-center__tab--active':'git-diff-center__tab'} onClick={()=>setTab(item)}>{item}<span>{item==='Staged'?changes.filter(c=>c.selected).length:changes.length}</span></button>)}</nav>
   <div className="git-diff-center__files">{visible.map(item=><button type="button" key={item.id} className={item.id===selected?'git-diff-center__file git-diff-center__file--active':'git-diff-center__file'} onClick={()=>setSelected(item.id)}><span className={'git-diff-center__status git-diff-center__status--'+item.status.toLowerCase()}>{item.status}</span><span><strong>{item.path.split('/').pop()}</strong><small>{item.path}</small></span><span className="git-diff-center__counts"><b>+{item.additions}</b><em>-{item.deletions}</em></span></button>)}</div>
   <div className="git-diff-center__side-foot"><span className="mono-text">{changes.length} files · +{changes.reduce((s,c)=>s+c.additions,0)} / -{changes.reduce((s,c)=>s+c.deletions,0)}</span><button className="studio-button studio-button--active" type="button" onClick={()=>onAction('Stage selected changes in preview')}><Icon name="check" size={13}/> Stage</button></div>
  </aside>
  <section className="git-diff-center__workspace">
   <header className="git-diff-center__header"><div><span className="eyebrow">{current.scope} · {current.status} changed</span><h2>{current.path}</h2><p>Review exact additions, deletions, inline notes and staging state before handoff.</p></div><div className="git-diff-center__actions"><button className={showWhitespace?'studio-button studio-button--active':'studio-button'} type="button" onClick={()=>setShowWhitespace(v=>!v)}>Whitespace</button><button className="studio-button" type="button" onClick={()=>onAction('Review comment opened in preview')}><Icon name="message" size={13}/> Comment</button><button className="studio-button studio-button--active" type="button" onClick={()=>toggleStage(current.id)}><Icon name="check" size={13}/> {current.selected?'Staged':'Stage file'}</button></div></header>
   <div className="git-diff-center__summary"><Stat label="Changes" value={'+'+current.additions+' / -'+current.deletions}/><Stat label="Scope" value={current.scope}/><Stat label="Review" value="Pending"/><Stat label="Safety" value="Checkpoint available"/></div>
   <div className="git-diff-center__diff-toolbar"><span>Unified diff</span><span className="mono-text">{showWhitespace?'showing whitespace':'whitespace ignored'}</span></div>
   <pre className="git-diff-center__diff"><span>@@ {current.path} @@</span>{['export function Surface(){','-  const legacy = true','+  const configured = true','+  const verified = true','+  return <Workspace />',' }'].map((line,index)=><span key={index} className={line.startsWith('+')?'diff-add':line.startsWith('-')?'diff-remove':''}>{line}</span>)}</pre>
   <div className="git-diff-center__review"><div><span className="eyebrow">Review checklist</span><strong>Architecture gate</strong><small>Scope boundary, rollback point and evidence are visible before merge.</small></div><div className="git-diff-center__checks">{['No secrets exposed','Runtime boundary preserved','Destructive action guarded','Verification evidence attached'].map(item=><div key={item}><Icon name="check-circle" size={13}/><span>{item}</span></div>)}</div></div>
   <div className="platform-actions"><button className="studio-button" type="button" onClick={()=>onAction('Checkpoint prepared from current diff in preview')}><Icon name="git" size={13}/> Create checkpoint</button><button className="studio-button" type="button" onClick={()=>onAction('Review request created in preview')}>Request review</button><button className="studio-button studio-button--active" type="button" onClick={()=>onAction('Diff handoff prepared in preview')}>Prepare handoff</button></div>
  </section>
 </div>
}
function Stat({label,value}:{label:string;value:string}){return <div className="git-diff-center__stat"><span>{label}</span><strong>{value}</strong></div>}