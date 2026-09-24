import { useEffect, useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { runtime } from '../../services/runtime'
import { Panel, Metric, Tag } from './PlatformPrimitives'

type Memory = { id:string; title:string; type:string; scope:string; importance:string; source:string; ttl:string; status:string }
const initial: Memory[] = [
  {id:'MEM-1042',title:'Agenticos frontend boundary',type:'Semantic',scope:'Workspace',importance:'High',source:'Run R-882',ttl:'Permanent',status:'Pinned'},
  {id:'MEM-1039',title:'Preferred verification workflow',type:'Episodic',scope:'Project',importance:'High',source:'Session S-42',ttl:'90 days',status:'Active'},
  {id:'MEM-1031',title:'Token optimization pipeline',type:'Semantic',scope:'Project',importance:'Medium',source:'Research R-19',ttl:'30 days',status:'Active'},
  {id:'MEM-1028',title:'Provider routing experiment',type:'Episodic',scope:'Session',importance:'Low',source:'Run R-871',ttl:'7 days',status:'Expiring'},
]
export function MemoryStudio({onAction}:{onAction:(message:string)=>void}) {
  const [items,setItems]=useState(initial); const [selected,setSelected]=useState(initial[0].id); const [query,setQuery]=useState(''); const [kind,setKind]=useState('All')
  const [runtimeSyncing,setRuntimeSyncing]=useState(true)

  useEffect(()=>{
    let cancelled=false
    void runtime.memory.list('agenticos', undefined, 100).then((records)=>{
      if(cancelled || records.length===0) return
      const mapped=records.map((record)=>({
        id: record.key,
        title: record.key,
        type: record.tags?.some(tag=>tag.toLowerCase().includes('semantic')) ? 'Semantic' : 'Episodic',
        scope: record.namespace,
        importance: (record.importance ?? 0.5) >= 0.8 ? 'High' : (record.importance ?? 0.5) >= 0.5 ? 'Medium' : 'Low',
        source: record.tags?.find(tag=>tag.toLowerCase().startsWith('source:'))?.slice(7) ?? 'Runtime',
        ttl: record.expires_at ? new Date(record.expires_at * 1000).toLocaleDateString() : 'Permanent',
        status: 'Active',
      }))
      setItems(mapped)
      setSelected((currentId)=>mapped.some(item=>item.id===currentId)?currentId:mapped[0].id)
    }).catch(()=>{}).finally(()=>{if(!cancelled)setRuntimeSyncing(false)})
    return ()=>{cancelled=true}
  },[])
  const filtered=useMemo(()=>items.filter(m=>(kind==='All'||m.type===kind)&&m.title.toLowerCase().includes(query.toLowerCase())),[items,query,kind])
  const current=items.find(m=>m.id===selected) ?? items[0]
  const remove=async()=>{
    const currentItem=items.find(item=>item.id===selected)
    if(!currentItem) return
    try{
      await runtime.memory.remove('agenticos', currentItem.id)
      setItems(v=>v.filter(m=>m.id!==selected))
      setSelected((next)=>next===currentItem.id ? (items.find(item=>item.id!==currentItem.id)?.id ?? '') : next)
      onAction('Memory deleted in runtime')
    }catch(error){onAction(error instanceof Error?error.message:'Runtime memory deletion failed')}
  }
  const create=async()=>{
    const key=window.prompt('Memory key')?.trim()
    const value=window.prompt('Memory value')?.trim()
    if(!key || !value) return
    try{
      await runtime.memory.upsert({namespace:'agenticos',key,value,tags:['source:desktop'],importance:0.7})
      const records=await runtime.memory.list('agenticos',undefined,100)
      const mapped=records.map(record=>({id:record.key,title:record.key,type:record.tags?.some(tag=>tag.toLowerCase().includes('semantic'))?'Semantic':'Episodic',scope:record.namespace,importance:(record.importance??0.5)>=0.8?'High':(record.importance??0.5)>=0.5?'Medium':'Low',source:record.tags?.find(tag=>tag.toLowerCase().startsWith('source:'))?.slice(7)??'Runtime',ttl:record.expires_at?new Date(record.expires_at*1000).toLocaleDateString():'Permanent',status:'Active'}))
      setItems(mapped); setSelected(key); onAction('Memory created in runtime')
    }catch(error){onAction(error instanceof Error?error.message:'Runtime memory creation failed')}
  }
  return <div className="memory-studio">
    <div className="memory-toolbar"><span className="mono-text">{runtimeSyncing?'Syncing runtime memory…':'Runtime memory · agenticos'}</span><input className="global-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search memories, sources, concepts…" /><div className="segmented-control">{['All','Semantic','Episodic'].map(v=><button type="button" key={v} className={kind===v?'is-active':''} onClick={()=>setKind(v)}>{v}</button>)}</div><button className="studio-button studio-button--active" type="button" onClick={()=>void create()}><Icon name="plus" size={13}/> Add memory</button></div>
    <div className="memory-layout">
      <div className="memory-list">{filtered.map(m=><button type="button" key={m.id} className={selected===m.id?'memory-row memory-row--active':'memory-row'} onClick={()=>setSelected(m.id)}><span className="memory-row__icon"><Icon name={m.type==='Semantic'?'database':'history'} size={14}/></span><div><strong>{m.title}</strong><span>{m.id} · {m.scope}</span></div><Tag label={m.importance}/></button>)}</div>
      <Panel title={current?.title ?? 'Memory'}>
        {current&&<><div className="platform-grid platform-grid--2"><Metric label="Type" value={current.type}/><Metric label="Scope" value={current.scope}/><Metric label="Importance" value={current.importance}/><Metric label="TTL" value={current.ttl}/></div>
        <div className="memory-detail-block"><span className="eyebrow">Provenance</span><p>Captured from <strong>{current.source}</strong>. Future runtime integration must retain source references and confidence instead of silently promoting inferred text to durable memory.</p></div>
        <div className="memory-policy-grid"><div><span>Write policy</span><strong>Require confidence ≥ 0.8</strong></div><div><span>Conflict policy</span><strong>Newest verified source wins</strong></div><div><span>Privacy</span><strong>Workspace-local</strong></div><div><span>Embedding</span><strong>Deferred to runtime</strong></div></div>
        <div className="platform-actions"><button className="studio-button" type="button" onClick={()=>onAction('Memory editing is available through runtime upsert')}>Edit</button><button className="studio-button" type="button" onClick={()=>onAction('Merge candidates opened in preview')}>Resolve conflicts</button><button className="studio-button" type="button" onClick={remove}>Delete</button><button className="studio-button studio-button--active" type="button" onClick={()=>onAction('Memory pinned in preview')}><Icon name="archive" size={13}/> Pin</button></div></>}
      </Panel>
    </div>
    <div className="platform-grid platform-grid--2"><Panel title="Memory architecture"><div className="strategy-stack"><div><span>Working memory</span><strong>Current run only</strong></div><div><span>Episodic memory</span><strong>Session outcomes</strong></div><div><span>Semantic memory</span><strong>Verified durable facts</strong></div><div><span>Workspace memory</span><strong>Project-scoped rules</strong></div></div></Panel><Panel title="Write safeguards"><div className="callout"><Icon name="shield" size={14}/><span>Memory writes are presentation-only. Runtime must enforce provenance, consent, scope, retention, conflict resolution and deletion.</span></div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>onAction('Memory policy editor opened in preview')}>Policy editor</button><button className="studio-button studio-button--active" type="button" onClick={()=>onAction('Memory compaction preview generated')}>Compact preview</button></div></Panel></div>
  </div>
}
export default MemoryStudio
