import { useEffect, useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { MetricCard, Panel, Tag } from './PlatformPrimitives'
import { runtime } from '../../services/runtime'

const files = [
  ['src/agents/runtime.rs','Rust','modified'], ['src/kernel/router.rs','Rust','modified'], ['src/domain/contracts.rs','Rust','clean'],
  ['frontend/src/navigation.ts','TypeScript','modified'], ['docs/architecture/BACKEND-ARCHITECTURE-MAP.md','Markdown','clean']
]
const symbols = ['ReactAgent','ModelProvider','ToolRegistry','RuntimeState','NavigationItem']

export function DeveloperWorkspace({ onAction }:{onAction:(m:string)=>void}) {
 const [active,setActive]=useState(files[0][0]); const [query,setQuery]=useState(''); const [tab,setTab]=useState<'explorer'|'search'|'symbols'>('explorer')
 const [runtimeFiles,setRuntimeFiles]=useState<Array<{path:string;directory:boolean;file:boolean;size_bytes?:number|null}>>([])
 const [activeContent,setActiveContent]=useState<string>('')
 const [runtimeState,setRuntimeState]=useState<'idle'|'loading'|'connected'|'unavailable'>('idle')
 const grantId=(import.meta.env.VITE_AGENTICOS_WORKSPACE_GRANT_ID as string|undefined)?.trim() ?? ''
 useEffect(()=>{if(!grantId){setRuntimeState('unavailable');return}let cancelled=false;setRuntimeState('loading');void runtime.workspace.list('.',grantId).then(entries=>{if(cancelled)return;setRuntimeFiles(entries.filter(entry=>entry.file).slice(0,200));setRuntimeState('connected');const first=entries.find(entry=>entry.file);if(first){setActive(first.path);return runtime.workspace.readFile(first.path,grantId).then(file=>{if(!cancelled)setActiveContent(file.content)}).catch(()=>{})}}).catch(()=>{if(!cancelled)setRuntimeState('unavailable')});return()=>{cancelled=true}},[grantId])
 const runtimeFileNames=useMemo(()=>runtimeFiles.map(file=>[file.path,'Runtime',`${file.size_bytes??0} bytes`] as const),[runtimeFiles])
 const visibleFiles=runtimeFiles.length?runtimeFileNames:files
 const filtered=useMemo(()=>visibleFiles.filter(f=>f[0].toLowerCase().includes(query.toLowerCase())),[query,visibleFiles])
 async function openFile(path:string){setActive(path);if(!grantId)return;try{const file=await runtime.workspace.readFile(path,grantId);setActiveContent(file.content);onAction('Opened runtime workspace file '+path)}catch(error){onAction(error instanceof Error?error.message:'Workspace file read failed')}}
 return <div className="studio-shell">
  <header className="platform-header"><div><span className="eyebrow">Developer plane</span><h1>Developer Workspace</h1><p>Inspect code, search symbols, review changes and prepare safe agent-assisted edits from one workspace.</p></div><div className="platform-header__actions"><Tag label={runtimeState==="connected"?"Runtime workspace":runtimeState==="loading"?"Syncing":"Preview"} /><button className="studio-button" onClick={()=>onAction('New terminal task staged in preview')}><Icon name="terminal" size={14}/> Terminal</button><button className="studio-button studio-button--active" onClick={()=>onAction('Agent edit request staged in preview')}><Icon name="spark" size={14}/> Ask agent</button></div></header>
  <div className="platform-metrics"><MetricCard label="Open files" value="5" sub="2 modified"/><MetricCard label="Diagnostics" value="0" sub="workspace clean"/><MetricCard label="Changed lines" value="+86 / −21" sub="current branch"/><MetricCard label="Agent context" value="68%" sub="budget available"/></div>
  <div className="developer-toolbar"><input className="global-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search files, symbols or paths…" /><button className="studio-button" onClick={()=>onAction('Command palette opened in preview')}>⌘K</button><button className="studio-button" onClick={()=>onAction('Git diff opened in preview')}>Review diff</button><button className="studio-button" onClick={()=>onAction('Checkpoint staged in preview')}>Checkpoint</button></div>
  <div className="developer-grid">
   <Panel title="Workspace"><div className="developer-tabs">{(['explorer','search','symbols'] as const).map(t=><button key={t} className={tab===t?'knowledge-tab knowledge-tab--active':'knowledge-tab'} onClick={()=>setTab(t)}>{t}</button>)}</div>
    {tab==='explorer' && <div className="developer-file-list">{filtered.map(f=><button key={f[0]} className={active===f[0]?'developer-file developer-file--active':'developer-file'} onClick={()=>void openFile(f[0])}><Icon name="file-code" size={14}/><span>{f[0]}</span><small>{f[2]}</small></button>)}</div>}
    {tab==='search' && <div className="developer-results"><strong>Search results</strong><span>ReactAgent · 12 matches</span><span>ModelProvider · 8 matches</span><span>RuntimeState · 6 matches</span></div>}
    {tab==='symbols' && <div className="developer-results">{symbols.map(s=><button key={s} className="developer-symbol" onClick={()=>onAction('Symbol '+s+' selected')}>{s}<small>definition · references</small></button>)}</div>}
   </Panel>
   <Panel title={active}><div className="editor-toolbar"><span>{runtimeState==="connected"?"runtime workspace":"main · clean checkout"}</span><span>{activeContent?"Live file":"Rust / TypeScript"}</span></div><pre className="code-preview">{activeContent || '// Agent-assisted preview\n// Grant workspace access to inspect a live file here.\n\nfn execute_turn(message: &str) -> Result<AgentResponse> {\n    let context = context_budget.pack(message)?;\n    let response = provider.complete(context)?;\n    event_store.append(response.events())?;\n    Ok(response)\n}'}</pre><div className="platform-actions"><button className="studio-button" onClick={()=>onAction('Inline edit opened in preview')}>Edit selection</button><button className="studio-button" onClick={()=>onAction('Explain code opened in preview')}>Explain</button><button className="studio-button studio-button--active" onClick={()=>onAction('Agent patch review opened in preview')}>Generate patch</button></div></Panel>
  </div>
  <div className="developer-status"><span><i/> Branch: main</span><span>{runtimeFiles.length?`${runtimeFiles.length} runtime files`:'Preview file catalog'}</span><span>Safe edit mode: enabled</span><span>{runtimeState==="connected"?"Workspace backend: connected":"Workspace backend: grant required"}</span></div>
 </div>
}