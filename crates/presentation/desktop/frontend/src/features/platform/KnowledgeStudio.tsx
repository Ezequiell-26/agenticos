import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { Metric, MetricCard, Panel, Tag } from './PlatformPrimitives'

type Source = { id:string; title:string; type:string; scope:string; status:string; chunks:number; freshness:string }
const sources: Source[] = [
 {id:'src-001',title:'AGENTS.md',type:'Rules',scope:'workspace',status:'Indexed',chunks:42,freshness:'2m ago'},
 {id:'src-002',title:'Architecture docs',type:'Docs',scope:'project',status:'Indexed',chunks:318,freshness:'8m ago'},
 {id:'src-003',title:'Git history',type:'Git',scope:'project',status:'Syncing',chunks:1240,freshness:'live'},
 {id:'src-004',title:'Research notes',type:'Research',scope:'workspace',status:'Indexed',chunks:86,freshness:'1h ago'},
]
const memories = [
 ['Agenticos architecture', 'Decision', 'High', 'Project'],
 ['Provider routing constraints', 'Fact', 'High', 'Workspace'],
 ['Frontend verification policy', 'Rule', 'Critical', 'Project'],
 ['Token optimization pipeline', 'Reference', 'Medium', 'Workspace'],
]
const citations = [
 ['Architecture map', 'docs/architecture/FRONTEND-ARCHITECTURE-MAP.md', '94%'],
 ['Backend map', 'docs/architecture/BACKEND-ARCHITECTURE-MAP.md', '91%'],
 ['Frontend changelog', 'docs/architecture/FRONTEND-CHANGELOG.md', '88%'],
]

export function KnowledgeStudio({ onAction }: { onAction: (message:string)=>void }) {
 const [query,setQuery]=useState('')
 const [selected,setSelected]=useState(sources[0].id)
 const [activeTab,setActiveTab]=useState<'sources'|'memory'|'retrieval'>('sources')
 const [autoIndex,setAutoIndex]=useState(true)
 const [rerank,setRerank]=useState(true)
 const filtered=useMemo(()=>sources.filter(s=>(s.title+' '+s.type+' '+s.scope).toLowerCase().includes(query.toLowerCase())),[query])
 const current=sources.find(s=>s.id===selected) ?? sources[0]
 return <div className="studio-shell">
  <header className="platform-header"><div><span className="eyebrow">Knowledge plane</span><h1>Knowledge Studio</h1><p>Index sources, govern retrieval, inspect provenance and prepare grounded context for agents.</p></div><div className="platform-header__actions"><Tag label="Preview" /><button className="studio-button studio-button--active" type="button" onClick={()=>onAction('Knowledge ingestion staged in preview')}><Icon name="upload" size={14}/> Add source</button></div></header>
  <div className="platform-metrics">
   <MetricCard label="Indexed sources" value="42" sub="4 active in this workspace"/>
   <MetricCard label="Indexed chunks" value="18,642" sub="semantic + lexical"/>
   <MetricCard label="Retrieval hit rate" value="94.2%" sub="last 100 preview queries"/>
   <MetricCard label="Stale sources" value="3" sub="refresh recommended"/>
  </div>
  <div className="knowledge-tabs">{(['sources','memory','retrieval'] as const).map(tab=><button key={tab} type="button" className={activeTab===tab?'knowledge-tab knowledge-tab--active':'knowledge-tab'} onClick={()=>setActiveTab(tab)}>{tab}</button>)}</div>
  {activeTab==='sources' && <div className="knowledge-layout">
   <Panel title="Knowledge sources"><input className="global-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search sources, scopes, types…" /><div className="knowledge-source-list">{filtered.map(s=><button key={s.id} type="button" className={selected===s.id?'knowledge-source knowledge-source--active':'knowledge-source'} onClick={()=>setSelected(s.id)}><div><strong>{s.title}</strong><span>{s.type} · {s.scope}</span></div><small>{s.chunks.toLocaleString()} chunks · {s.freshness}</small><span className={s.status==='Indexed'?'state-pill state-pill--completed':'state-pill state-pill--pending'}>{s.status}</span></button>)}</div></Panel>
   <Panel title={current.title}><div className="platform-grid platform-grid--2"><Metric label="Chunks" value={current.chunks.toLocaleString()}/><Metric label="Scope" value={current.scope}/><Metric label="Freshness" value={current.freshness}/><Metric label="Embeddings" value="Ready"/></div><div className="strategy-stack"><div><span>Chunking</span><strong>Structure-aware</strong></div><div><span>Metadata</span><strong>Path · source · timestamp</strong></div><div><span>Access</span><strong>Workspace policy</strong></div><div><span>Deletion</span><strong>Reversible preview</strong></div></div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>onAction('Source refresh staged in preview')}>Refresh source</button><button className="studio-button" type="button" onClick={()=>onAction('Source inspection opened in preview')}>Inspect chunks</button><button className="studio-button studio-button--active" type="button" onClick={()=>onAction('Source removal confirmation opened in preview')}>Remove</button></div></Panel>
  </div>}
  {activeTab==='memory' && <div className="knowledge-layout"><Panel title="Memory governance"><div className="platform-grid platform-grid--2">{memories.map(([name,type,importance,scope])=><button className="platform-card" type="button" key={name} onClick={()=>onAction(name+' selected')}><strong>{name}</strong><span>{type} · {scope}</span><small>Importance: {importance}</small></button>)}</div></Panel><Panel title="Write policy"><div className="strategy-stack"><div><span>Automatic writes</span><strong>Guarded</strong></div><div><span>Provenance</span><strong>Required</strong></div><div><span>Conflict policy</span><strong>Human review</strong></div><div><span>Retention</span><strong>Workspace default</strong></div></div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>onAction('Memory policy opened in preview')}>Edit policy</button><button className="studio-button studio-button--active" type="button" onClick={()=>onAction('Memory cleanup staged in preview')}>Review stale memories</button></div></Panel></div>}
  {activeTab==='retrieval' && <div className="knowledge-layout"><Panel title="Retrieval pipeline"><div className="strategy-stack"><div><span>Query rewrite</span><strong>Enabled</strong></div><div><span>Hybrid search</span><strong>Vector + lexical</strong></div><div><span>Reranking</span><strong>{rerank?'Enabled':'Disabled'}</strong></div><div><span>Context packing</span><strong>Budget aware</strong></div></div><div className="platform-actions"><button className={rerank?'studio-button studio-button--active':'studio-button'} type="button" onClick={()=>setRerank(v=>!v)}>Toggle reranker</button><button className="studio-button" type="button" onClick={()=>onAction('Retrieval test opened in preview')}>Test retrieval</button></div></Panel><Panel title="Provenance"><div className="knowledge-citations">{citations.map(([title,path,score])=><button type="button" className="citation-row" key={path} onClick={()=>onAction('Citation '+title+' opened in preview')}><div><strong>{title}</strong><span>{path}</span></div><b>{score}</b></button>)}</div><div className="callout"><Icon name="shield" size={14}/><span>Grounded responses should preserve source IDs and retrieval scores so the backend can attach verifiable citations later.</span></div></Panel></div>}
  <div className="knowledge-footer"><label><span>Automatic indexing</span><button type="button" className={autoIndex?'switch switch--on':'switch'} role="switch" aria-checked={autoIndex} onClick={()=>setAutoIndex(v=>!v)}><span/></button></label><span>Frontend-only configuration until the ingestion runtime is connected.</span></div>
 </div>
}
