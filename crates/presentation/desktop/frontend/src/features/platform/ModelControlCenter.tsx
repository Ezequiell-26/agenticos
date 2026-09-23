import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { MetricCard, Panel, Tag } from './PlatformPrimitives'

type Tab='models'|'routing'|'capabilities'|'usage'
const providers=[
 ['OpenAI-compatible','14 models','Connected','128k max','primary'],
 ['Anthropic-compatible','8 models','Preview','200k max','fallback'],
 ['Google-compatible','11 models','Preview','1M max','fallback'],
 ['DeepSeek-compatible','6 models','Preview','128k max','research'],
 ['Local / Ollama','9 local models','Detected','32k max','local'],
]
const models=[
 ['coder-1','Coding model','128k','Low','primary','98%'],
 ['reasoner-1','Reasoning model','128k','High','fallback','94%'],
 ['vision-1','Multimodal model','64k','Medium','vision','91%'],
 ['fast-1','Latency-first model','64k','Low','fast','89%'],
 ['local-coder','Local/private model','32k','None','local','86%'],
]
const routeRows=[
 ['Planning','reasoner-1','High quality','Bounded'],
 ['Coding','coder-1','Code tools','Primary'],
 ['Vision','vision-1','Image input','Conditional'],
 ['Quick turn','fast-1','Low latency','Fast lane'],
 ['Offline','local-coder','No network','Fallback'],
]
const capabilities=['Text','Code','Vision','Tools','JSON','Reasoning','Long context','Streaming']

export function ModelControlCenter({onAction}:{onAction:(message:string)=>void}){
 const [tab,setTab]=useState<Tab>('models'),[provider,setProvider]=useState(providers[0][0]),[selected,setSelected]=useState(models[0][0]),[filter,setFilter]=useState(''),[fallback,setFallback]=useState(true)
 const visibleModels=useMemo(()=>models.filter(m=>m.join(' ').toLowerCase().includes(filter.toLowerCase())),[filter])
 const active=models.find(m=>m[0]===selected)??models[0]
 const act=(m:string)=>onAction(m+' staged in preview')
 return <div className="model-control">
  <header className="model-control__hero"><div><span className="eyebrow">Model plane</span><h1>Provider & Model Control Center</h1><p>Centralize provider accounts, model inventory, routing policy, fallback behavior, capabilities and usage so the agent never depends on one hidden model path.</p></div><div className="model-control__actions"><Tag label="Multi-provider"/><button className={fallback?'studio-button studio-button--active':'studio-button'} type="button" onClick={()=>setFallback(v=>!v)}><Icon name="shield" size={13}/>{fallback?'Fallback armed':'Fallback off'}</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Refresh provider catalog')}>Refresh</button></div></header>
  <div className="platform-metrics"><MetricCard label="Providers" value="5" sub="1 connected · 3 preview · 1 local"/><MetricCard label="Models" value="48" sub="Catalogued"/><MetricCard label="Routes" value="5" sub={fallback?'Fallback active':'Fallback disabled'}/><MetricCard label="Context" value="1M" sub="Highest available preview"/></div>
  <div className="model-control__tabs">{(['models','routing','capabilities','usage'] as const).map(t=><button key={t} className={tab===t?'model-tab model-tab--active':'model-tab'} type="button" onClick={()=>setTab(t)}>{t}</button>)}</div>

  {tab==='models'&&<div className="model-control__layout"><Panel title="Providers"><div className="provider-list">{providers.map(p=><button key={p[0]} type="button" className={provider===p[0]?'provider-row provider-row--active':'provider-row'} onClick={()=>setProvider(p[0])}><span className="provider-dot"><Icon name={p[2]==='Connected'?'check':p[2]==='Detected'?'home':'network'} size={12}/></span><span><strong>{p[0]}</strong><small>{p[1]} · {p[4]}</small></span><Tag label={p[2]}/></button>)}</div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Add provider')}>Add provider</button><button className="studio-button" type="button" onClick={()=>act('Provider credentials')}>Credentials</button></div></Panel><Panel title={provider}><div className="model-search"><Icon name="search" size={12}/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter models…" aria-label="Filter models"/></div><div className="model-list">{visibleModels.map(m=><button key={m[0]} type="button" className={selected===m[0]?'model-row model-row--active':'model-row'} onClick={()=>setSelected(m[0])}><span><strong>{m[0]}</strong><small>{m[1]} · {m[2]} context</small></span><span>{m[4]}</span><Tag label={m[5]}/></button>)}</div></Panel></div>}

  {tab==='routing'&&<div className="model-control__routing"><Panel title="Route policy"><div className="route-table">{routeRows.map(r=><div key={r[0]}><span><strong>{r[0]}</strong><small>{r[2]}</small></span><code>{r[1]}</code><Tag label={r[3]}/><button className="studio-button" type="button" onClick={()=>act('Edit '+r[0]+' route')}>Edit</button></div>)}</div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Add route rule')}>Add rule</button><button className="studio-button" type="button" onClick={()=>act('Simulate routing')}>Simulate</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Preview failover')}>Preview failover</button></div></Panel><Panel title="Fallback strategy"><div className="fallback-stack"><div><span>Primary unavailable</span><strong>{fallback?'Select compatible fallback':'Stop execution'}</strong></div><div><span>Rate limited</span><strong>{fallback?'Cooldown → alternate provider':'Stop execution'}</strong></div><div><span>Context too large</span><strong>Compact → retry route</strong></div><div><span>Tool incompatibility</span><strong>Capability match → alternate</strong></div><div><span>Provider error</span><strong>Preserve evidence → bounded retry</strong></div></div></Panel></div>}

  {tab==='capabilities'&&<div className="model-control__layout"><Panel title={active[0]}><div className="model-identity"><span className="eyebrow">{active[1]}</span><h2>{active[0]}</h2><p>Selected model capability contract. Actual capabilities must be reported by the provider adapter.</p></div><div className="capability-grid">{capabilities.map((c,i)=><div key={c}><span>{c}</span><strong>{i===2||i===5?'Supported':'Configured'}</strong></div>)}</div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Inspect model metadata')}>Metadata</button><button className="studio-button" type="button" onClick={()=>act('Open model playground')}>Playground</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Compare model')}>Compare</button></div></Panel><Panel title="Selection policy"><div className="selection-policy">{['Task intent','Context limit','Tool compatibility','Vision requirement','Latency budget','Cost/quota','Provider health'].map(item=><div key={item}><Icon name="check" size={11}/><span>{item}</span><Tag label="evaluated"/></div>)}</div></Panel></div>}

  {tab==='usage'&&<div className="model-control__usage"><Panel title="Provider usage"><div className="usage-rows">{providers.map((p,i)=><div key={p[0]}><span><strong>{p[0]}</strong><small>{i===0?'Today · 1,284 requests':'Preview quota'}</small></span><b>{i===0?'2.84M':'—'}</b><div className="usage-bar"><i style={{width:(20+i*13)+'%'}}/></div></div>)}</div></Panel><Panel title="Budget guards"><div className="budget-guards"><div><span>Daily token budget</span><strong>72%</strong></div><div><span>Monthly spend</span><strong>38%</strong></div><div><span>Free-tier quota</span><strong>61%</strong></div><div><span>Fallback reserve</span><strong>20%</strong></div></div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Edit budget guard')}>Edit guards</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Export model usage')}>Export</button></div></Panel></div>}

  <div className="model-control__guard"><Icon name="shield" size={13}/><span>Provider keys and credentials never live in this presentation surface. Model health, quotas and capabilities shown here remain preview metadata until runtime adapters supply authoritative values.</span></div>
 </div>
}