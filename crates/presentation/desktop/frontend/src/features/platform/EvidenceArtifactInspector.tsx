import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { MetricCard, Panel, Tag } from './PlatformPrimitives'

type Kind='Screenshot'|'Video'|'Log'|'Diff'|'Test report'|'Handoff'
const artifacts:Array<[string,Kind,string,string,string]>=[
 ['artifact-22','Screenshot','frontend-main.png','812 KB','Visual verification'],
 ['artifact-23','Video','agent-run.mp4','18.4 MB','Computer-use demo'],
 ['artifact-24','Log','tool-trace.jsonl','124 KB','Execution evidence'],
 ['artifact-25','Diff','provider-routing.patch','18 KB','Code change'],
 ['artifact-26','Test report','verification.json','6 KB','Automated checks'],
 ['artifact-27','Handoff','review-package.md','4 KB','Agent handoff'],
]
export function EvidenceArtifactInspector({onAction}:{onAction:(message:string)=>void}){
 const [kind,setKind]=useState<Kind|'All'>('All'),[selected,setSelected]=useState(artifacts[0][0]),[search,setSearch]=useState('')
 const filtered=useMemo(()=>artifacts.filter(a=>(kind==='All'||a[1]===kind)&&a.join(' ').toLowerCase().includes(search.toLowerCase())),[kind,search])
 const current=artifacts.find(a=>a[0]===selected)??filtered[0]??artifacts[0]
 const act=(m:string)=>onAction(m+' staged in preview')
 return <div className="evidence-inspector">
  <header className="evidence-inspector__hero"><div><span className="eyebrow">Proof layer</span><h1>Evidence & Artifact Inspector</h1><p>Inspect screenshots, recordings, logs, diffs, reports and handoff packages with provenance and verification state.</p></div><div className="evidence-inspector__actions"><Tag label="Evidence chain"/><button className="studio-button" type="button" onClick={()=>act('Export evidence package')}><Icon name="download" size={13}/> Export package</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Attach evidence')}><Icon name="plus" size={13}/> Attach</button></div></header>
  <div className="platform-metrics"><MetricCard label="Artifacts" value="14" sub="6 types"/><MetricCard label="Verified" value="11" sub="3 awaiting checks"/><MetricCard label="Sources" value="7" sub="Files, runs, browser and Git"/><MetricCard label="Integrity" value="SHA linked" sub="Provenance preserved"/></div>
  <div className="evidence-inspector__filters"><div className="evidence-search"><Icon name="search" size={12}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search artifacts…" aria-label="Search artifacts"/></div>{(['All','Screenshot','Video','Log','Diff','Test report','Handoff'] as const).map(item=><button type="button" className={kind===item?'studio-button studio-button--active':'studio-button'} key={item} onClick={()=>setKind(item)}>{item}</button>)}</div>
  <div className="evidence-inspector__layout"><Panel title="Artifact index"><div className="artifact-list">{filtered.map(a=><button type="button" key={a[0]} className={selected===a[0]?'artifact-row artifact-row--active':'artifact-row'} onClick={()=>setSelected(a[0])}><span className="artifact-row__icon"><Icon name={a[1]==='Screenshot'?'layout':a[1]==='Video'?'play':a[1]==='Log'?'activity':a[1]==='Diff'?'git':a[1]==='Test report'?'check-circle':'archive'} size={14}/></span><span><strong>{a[2]}</strong><small>{a[0]} · {a[4]}</small></span><small>{a[3]}</small></button>)}</div></Panel>
   <Panel title="Inspector"><div className="artifact-preview"><div className="artifact-preview__visual"><Icon name={current[1]==='Screenshot'?'layout':current[1]==='Video'?'play':'archive'} size={32}/><strong>{current[2]}</strong><span>{current[1]} · {current[3]}</span></div><div className="artifact-facts"><div><span>Origin</span><strong>RUN-042</strong></div><div><span>Generated at</span><strong>09:11:32</strong></div><div><span>Source path</span><strong>artifacts/{current[2]}</strong></div><div><span>Integrity</span><strong>SHA-256 linked</strong></div><div><span>Verification</span><strong>Evidence attached</strong></div><div><span>Retention</span><strong>Workspace policy</strong></div></div><div className="artifact-provenance"><span className="eyebrow">Provenance chain</span><p>Mission → Run → Event → Artifact → Verification</p><div><Tag label="Mission"/><Tag label="RUN-042"/><Tag label="event:artifact"/><Tag label="verified"/></div></div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Open artifact')}>Open</button><button className="studio-button" type="button" onClick={()=>act('Compare artifact versions')}>Compare</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Inspect source event')}>Source event</button></div></Panel>
  </div>
  <div className="evidence-inspector__footer"><span><Icon name="shield" size={12}/> Evidence metadata does not expose secrets.</span><span>Artifact download, mutation and external publication require runtime authorization.</span></div>
 </div>
}