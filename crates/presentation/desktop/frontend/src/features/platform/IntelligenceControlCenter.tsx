import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { MetricCard, Panel, Tag } from './PlatformPrimitives'

type Tab='overview'|'context'|'knowledge'|'memory'|'research'|'prompts'|'evaluations'|'tokens'
const sources=[
 ['Repository map','42.8k tokens','Included','Workspace'],
 ['Open files','8.4k tokens','Included','Session'],
 ['Git diff','5.1k tokens','Included','Change set'],
 ['Project rules','3.2k tokens','Always','Policy'],
 ['Pinned memory','2.7k tokens','Curated','Memory'],
 ['Web sources','11.4k tokens','Conditional','Research'],
]
const memories=[
 ['MEM-118','Fail-closed workflow preference','Project','High','Review first'],
 ['MEM-117','Agent handoff requires evidence','Workspace','High','Pinned'],
 ['MEM-116','Provider fallback must preserve context budget','Project','Medium','Active'],
 ['MEM-115','Frontend changes require changelog entry','Workspace','High','Pinned'],
]
const research=[
 ['BATCH-015','Compare agent orchestration patterns','24 sources','Running'],
 ['BATCH-014','Frontend UX benchmark','12 sources','Complete'],
 ['BATCH-013','Provider free-tier audit','18 sources','Complete'],
]
const prompts=[
 ['architecture-first','Plan before mutation','v0.8','Production draft'],
 ['review-first','Inspect diff and evidence','v0.5','Stable'],
 ['research-grounded','Evidence + provenance','v0.4','Stable'],
 ['token-budgeted','Optimize context before generation','v0.3','Draft'],
]
const evals=[
 ['Code correctness','48 cases','93.8%','Stable'],
 ['Tool discipline','32 cases','96.4%','Stable'],
 ['Research grounding','24 cases','89.1%','Review'],
 ['UI interaction','18 cases','91.7%','Stable'],
]
const tokenStages=[
 ['1','Noise trim','Remove ANSI/log/formatting noise','trimcp-style'],
 ['2','Deduplicate','Cache repeated memory/context','sqz-style'],
 ['3','Structure compact','Compress structural context','gcf-rust / Ogham-style'],
 ['4','Dynamic budget','Trim low-value turns if model limit is reached','runtime budget'],
]

export function IntelligenceControlCenter({onAction}:{onAction:(message:string)=>void}){
 const [tab,setTab]=useState<Tab>('overview'),[source,setSource]=useState(sources[0][0]),[memory,setMemory]=useState(memories[0][0]),[prompt,setPrompt]=useState(prompts[0][0]),[filter,setFilter]=useState('')
 const visibleSources=useMemo(()=>sources.filter(s=>s.join(' ').toLowerCase().includes(filter.toLowerCase())),[filter])
 const activeMemory=memories.find(m=>m[0]===memory)??memories[0]
 const activePrompt=prompts.find(p=>p[0]===prompt)??prompts[0]
 const act=(m:string)=>onAction(m+' staged in preview')
 return <div className="intelligence-control">
  <header className="intelligence-control__hero"><div><span className="eyebrow">Context & knowledge plane</span><h1>Intelligence Control Center</h1><p>Unify context assembly, memory, knowledge retrieval, research, prompts, evaluations and token optimization before generation.</p></div><div className="intelligence-control__actions"><Tag label="Evidence-aware"/><button className="studio-button" type="button" onClick={()=>act('Refresh intelligence index')}><Icon name="refresh" size={13}/>Refresh</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Build context pack')}><Icon name="archive" size={13}/>Build context</button></div></header>
  <div className="platform-metrics"><MetricCard label="Context" value="66.1k" sub="of 128k budget"/><MetricCard label="Knowledge" value="38 sources" sub="Hybrid retrieval"/><MetricCard label="Memory" value="14 pinned" sub="Provenance attached"/><MetricCard label="Optimization" value="4 stages" sub="Budget-aware pipeline"/></div>
  <div className="intelligence-control__tabs">{(['overview','context','knowledge','memory','research','prompts','evaluations','tokens'] as const).map(t=><button type="button" key={t} className={tab===t?'intel-tab intel-tab--active':'intel-tab'} onClick={()=>setTab(t)}>{t}</button>)}</div>

  {tab==='overview'&&<div className="intelligence-control__grid"><Panel title="Context assembly"><div className="intel-list">{sources.slice(0,5).map(s=><div key={s[0]}><span><strong>{s[0]}</strong><small>{s[1]} · {s[3]}</small></span><Tag label={s[2]}/></div>)}</div><div className="intel-budget"><span>Context pressure</span><b>51.6%</b><div><i style={{width:'51.6%'}}/></div></div></Panel><Panel title="Intelligence pipeline"><div className="intel-pipeline">{tokenStages.map((s,i)=><div key={s[0]}><span>{s[0]}</span><span><strong>{s[1]}</strong><small>{s[2]}</small></span><Tag label={i<3?'configured':'runtime'}/></div>)}</div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Preview optimization trace')}>Trace</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Run optimization preview')}>Optimize</button></div></Panel></div>}

  {tab==='context'&&<div className="intelligence-control__grid"><Panel title="Context sources"><div className="intel-search"><Icon name="search" size={12}/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter context sources…" aria-label="Filter context sources"/></div><div className="intel-list">{visibleSources.map(s=><button type="button" key={s[0]} className={source===s[0]?'intel-row intel-row--active':'intel-row'} onClick={()=>setSource(s[0])}><span><strong>{s[0]}</strong><small>{s[1]} · {s[3]}</small></span><Tag label={s[2]}/></button>)}</div></Panel><Panel title={source}><div className="intel-facts"><div><span>Selection</span><strong>Included</strong></div><div><span>Budget</span><strong>8.4k tokens</strong></div><div><span>Scope</span><strong>Current project</strong></div><div><span>Freshness</span><strong>2m</strong></div></div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Inspect context chunks')}>Chunks</button><button className="studio-button" type="button" onClick={()=>act('Rerank context')}>Rerank</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Pack context')}>Pack</button></div></Panel></div>}

  {tab==='knowledge'&&<div className="intelligence-control__grid"><Panel title="Knowledge retrieval"><div className="intel-retrieval"><div><span>Query rewrite</span><Tag label="Enabled"/></div><div><span>Hybrid search</span><Tag label="Vector + lexical"/></div><div><span>Reranker</span><Tag label="Enabled"/></div><div><span>Provenance</span><Tag label="Required"/></div><div><span>Budget aware</span><Tag label="Enabled"/></div></div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Preview retrieval query')}>Query</button><button className="studio-button" type="button" onClick={()=>act('Inspect sources')}>Sources</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Run retrieval preview')}>Retrieve</button></div></Panel><Panel title="Citation preview"><div className="citation-card"><span className="eyebrow">Retrieved source</span><strong>docs/architecture/FRONTEND-ARCHITECTURE-MAP.md</strong><small>score 0.92 · chunk 18 · freshness 2m</small><p>Navigation ownership and presentation/runtime boundaries.</p><Tag label="provenance attached"/></div></Panel></div>}

  {tab==='memory'&&<div className="intelligence-control__grid"><Panel title="Memory index"><div className="intel-list">{memories.map(m=><button type="button" key={m[0]} className={memory===m[0]?'intel-row intel-row--active':'intel-row'} onClick={()=>setMemory(m[0])}><span><strong>{m[1]}</strong><small>{m[0]} · {m[2]} · {m[3]}</small></span><Tag label={m[4]}/></button>)}</div></Panel><Panel title={activeMemory[0]}><span className="eyebrow">Memory record</span><h2>{activeMemory[1]}</h2><div className="intel-facts"><div><span>Scope</span><strong>{activeMemory[2]}</strong></div><div><span>Importance</span><strong>{activeMemory[3]}</strong></div><div><span>Write policy</span><strong>Review first</strong></div><div><span>Provenance</span><strong>3 supporting runs</strong></div></div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Edit memory')}>Edit</button><button className="studio-button" type="button" onClick={()=>act('Open supporting evidence')}>Evidence</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Pin memory')}>Pin</button></div></Panel></div>}

  {tab==='research'&&<Panel title="Research batches"><div className="research-list">{research.map(r=><div key={r[0]}><span><strong>{r[1]}</strong><small>{r[0]} · {r[2]}</small></span><Tag label={r[3]}/><button className="studio-button" type="button" onClick={()=>act('Open '+r[0])}>Open</button></div>)}</div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Create research batch')}>New batch</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Run research batch')}>Run batch</button></div></Panel>}

  {tab==='prompts'&&<div className="intelligence-control__grid"><Panel title="Prompt catalog"><div className="intel-list">{prompts.map(p=><button type="button" key={p[0]} className={prompt===p[0]?'intel-row intel-row--active':'intel-row'} onClick={()=>setPrompt(p[0])}><span><strong>{p[0]}</strong><small>{p[1]} · {p[2]}</small></span><Tag label={p[3]}/></button>)}</div></Panel><Panel title={activePrompt[0]}><span className="eyebrow">Prompt contract</span><h2>{activePrompt[1]}</h2><p className="intel-muted">Variables, scope, model compatibility, evaluation suite and release state are visible before invocation.</p><div className="intel-facts"><div><span>Version</span><strong>{activePrompt[2]}</strong></div><div><span>State</span><strong>{activePrompt[3]}</strong></div><div><span>Scope</span><strong>Workspace</strong></div><div><span>Evaluation</span><strong>Attached</strong></div></div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Open prompt editor')}>Edit</button><button className="studio-button" type="button" onClick={()=>act('Run prompt test')}>Test</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Compare prompt versions')}>Compare</button></div></Panel></div>}

  {tab==='evaluations'&&<Panel title="Evaluation suites"><div className="eval-list">{evals.map(e=><div key={e[0]}><span><strong>{e[0]}</strong><small>{e[1]} · repeatable suite</small></span><b>{e[2]}</b><Tag label={e[3]}/><button className="studio-button" type="button" onClick={()=>act('Run '+e[0]+' suite')}>Run</button></div>)}</div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Compare evaluation runs')}>Compare</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Export evaluation report')}>Export</button></div></Panel>}

  {tab==='tokens'&&<div className="intelligence-control__grid"><Panel title="Token optimization pipeline"><div className="token-pipeline">{tokenStages.map((s,index)=><div key={s[0]}><span className="token-number">{s[0]}</span><span><strong>{s[1]}</strong><small>{s[2]}</small></span><code>{s[3]}</code><Tag label={index===3?'dynamic':'static'}/></div>)}</div></Panel><Panel title="Budget policy"><div className="budget-policy"><div><span>Physical limit</span><strong>128k</strong></div><div><span>Soft target</span><strong>96k</strong></div><div><span>Trim threshold</span><strong>110k</strong></div><div><span>Old-turn policy</span><strong>Dynamic trim</strong></div><div><span>Provenance retention</span><strong>Required</strong></div></div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Inspect token trace')}>Trace</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Run token optimization preview')}>Optimize</button></div></Panel></div>}

  <div className="intelligence-control__guard"><Icon name="shield" size={13}/><span>Context, memory, research and token values shown here are preview metadata. The runtime remains authoritative for actual retrieval, persistence, provider limits and optimization.</span></div>
 </div>
