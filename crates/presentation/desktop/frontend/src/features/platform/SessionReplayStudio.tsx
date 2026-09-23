import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { MetricCard, Panel, Tag } from './PlatformPrimitives'

type EventKind = 'prompt' | 'tool' | 'model' | 'approval' | 'artifact' | 'checkpoint'
const events:Array<[string,EventKind,string,string]>=[
 ['09:01:12','prompt','User request','Implement provider routing with fail-closed verification.'],
 ['09:01:18','tool','filesystem.read','12 files inspected'],
 ['09:02:04','model','Plan','3 implementation slices proposed'],
 ['09:05:41','checkpoint','CP-031','Saved before provider route mutation'],
 ['09:06:08','approval','Policy gate','Write operation approved for scoped workspace'],
 ['09:11:32','artifact','artifact-22','verification-report.json generated'],
]
const branches=[['main','Stable baseline','0 mutations'],['mission/provider-routing','Builder attempt','8 mutations'],['mission/provider-routing-review','Reviewer fork','read-only']]

export function SessionReplayStudio({onAction}:{onAction:(message:string)=>void}){
 const [selected,setSelected]=useState(2),[branch,setBranch]=useState(branches[1][0]),[playing,setPlaying]=useState(false),[filter,setFilter]=useState<EventKind|'all'>('all')
 const visible=useMemo(()=>events.filter(e=>filter==='all'||e[1]===filter),[filter])
 const event=visible[Math.min(selected,visible.length-1)]??events[0]
 const act=(m:string)=>onAction(m+' staged in preview')
 return <div className="session-replay">
  <header className="session-replay__hero"><div><span className="eyebrow">Session continuity</span><h1>Session Replay Studio</h1><p>Branch, inspect and replay agent trajectories without losing the original evidence chain.</p></div><div className="session-replay__actions"><Tag label="Preview"/><button className="studio-button" type="button" onClick={()=>setPlaying(v=>!v)}><Icon name={playing?'stop':'play'} size={13}/> {playing?'Pause replay':'Replay timeline'}</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Fork session')}>Fork session</button></div></header>
  <div className="platform-metrics"><MetricCard label="Events" value="128" sub="Full trajectory retained"/><MetricCard label="Branches" value="3" sub="1 active · 1 review · 1 baseline"/><MetricCard label="Checkpoints" value="7" sub="All restore-preview capable"/><MetricCard label="Artifacts" value="14" sub="Linked to timeline events"/></div>
  <div className="session-replay__layout">
   <Panel title="Session branches"><div className="session-replay__branches">{branches.map(([id,title,detail])=><button key={id} type="button" className={branch===id?'replay-branch replay-branch--active':'replay-branch'} onClick={()=>setBranch(id)}><Icon name="branch" size={14}/><span><strong>{id}</strong><small>{title} · {detail}</small></span><Icon name="chevron-right" size={12}/></button>)}</div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Compare branches')}>Compare</button><button className="studio-button" type="button" onClick={()=>act('Rename branch')}>Rename</button></div></Panel>
   <Panel title="Current event"><div className="session-replay__event-head"><span className="eyebrow">{event[1]}</span><code>{event[0]}</code></div><h2>{event[2]}</h2><p>{event[3]}</p><div className="session-replay__event-facts"><div><span>Branch</span><strong>{branch}</strong></div><div><span>Replay position</span><strong>{selected+1} / {visible.length}</strong></div><div><span>Context delta</span><strong>+2.4k tokens</strong></div><div><span>Evidence</span><strong>2 linked items</strong></div></div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Open event context')}>Context</button><button className="studio-button" type="button" onClick={()=>act('Open linked artifact')}>Artifacts</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Restore event preview')}>Restore preview</button></div></Panel>
  </div>
  <Panel title="Trajectory timeline"><div className="session-replay__filters">{(['all','prompt','tool','model','approval','artifact','checkpoint'] as const).map(item=><button className={filter===item?'studio-button studio-button--active':'studio-button'} key={item} onClick={()=>{setFilter(item as typeof filter);setSelected(0)}} type="button">{item}</button>)}</div><div className="session-replay__timeline">{visible.map((item,index)=><button key={item[0]+item[2]} type="button" className={index===selected?'replay-event replay-event--active':'replay-event'} onClick={()=>setSelected(index)}><span className="replay-event__dot"><Icon name={item[1]==='tool'?'tool':item[1]==='checkpoint'?'git':item[1]==='approval'?'lock':item[1]==='artifact'?'archive':item[1]==='model'?'bot':'message'} size={11}/></span><span><strong>{item[2]}</strong><small>{item[0]} · {item[3]}</small></span></button>)}</div></Panel>
  <div className="session-replay__footer"><span><Icon name="shield" size={12}/> Original session remains immutable in preview mode.</span><span>Replay, fork and restore execute only after session-runtime contracts are connected.</span></div>
 </div>
}