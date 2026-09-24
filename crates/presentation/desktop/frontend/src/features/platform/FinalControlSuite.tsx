import { useEffect, useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { Panel, Metric, MetricCard, Tag } from './PlatformPrimitives'
import { runtime } from '../../services/runtime'

type Suite = { id:string; title:string; summary:string; metrics:[string,string][]; items:string[] }
const suites: Record<string, Suite> = {
  teams:{id:'teams',title:'Agent Teams',summary:'Diseña equipos multiagente con roles, handoffs, paralelismo, ownership y límites explícitos.',metrics:[['Agents','6'],['Parallel lanes','3'],['Shared artifacts','12'],['Human gates','2']],items:['Planner → Builder → Reviewer','Researcher → Evidence → Reviewer','Release Bot → QA → Publisher','Failure path → Recovery Agent']},
  context:{id:'context',title:'Advanced Context',summary:'Controla qué entra al contexto, por qué entra, cuánto cuesta y cómo se compacta.',metrics:[['Context budget','128k'],['Used','61.4k'],['Sources','38'],['Headroom','52%']],items:['Repository map + relevant files','Rules and policy hierarchy','Task + recent turns','Memory with provenance','Tool schemas only when required','Trim static noise → dedupe → structural compaction → dynamic trim']},
  usage:{id:'usage',title:'Cost & Usage',summary:'Superficie de consumo para tokens, modelos, proveedores, tareas y límites de presupuesto.',metrics:[['Tokens today','2.84M'],['Estimated spend','$4.82'],['Requests','1,284'],['Budget used','38%']],items:['Per-provider token accounting','Per-agent and per-project allocation','Input/output/cache breakdown','Daily and monthly budget guards','Free-tier quota visibility','Exportable usage report']},
  observability:{id:'observability',title:'Observability',summary:'Traza ejecuciones desde el prompt hasta herramientas, modelos, eventos, latencia y artefactos.',metrics:[['Active runs','4'],['Events/min','186'],['p95 latency','2.8s'],['Errors','0.7%']],items:['Run timeline and event stream','Model/provider latency','Tool success and failure rate','Token and context pressure','Correlation IDs','Trace-to-artifact navigation']},
  release:{id:'release',title:'Release Center',summary:'Prepara releases de agentes, prompts, skills y workflows con gates, evidence y rollback.',metrics:[['Candidate','v0.9.0'],['Checks','18/20'],['Blockers','1'],['Rollback','Ready']],items:['Change manifest','Visual regression gate','Accessibility gate','Prompt/evaluation gate','Security and permission gate','Evidence package + rollback plan']},
  customization:{id:'customization',title:'Customization',summary:'Centraliza apariencia, keymaps, layouts, profiles y preferencias por workspace.',metrics:[['Themes','8'],['Keymaps','4'],['Profiles','5'],['Presets','7']],items:['Theme and density presets','Keyboard shortcut editor','Workspace layout profiles','Agent UI profiles','Notification and sound policy','Import/export preferences']},
  help:{id:'help',title:'Help & Documentation',summary:'Centro contextual para entender cada control sin salir del workspace.',metrics:[['Guides','42'],['Shortcuts','36'],['Policies','18'],['Troubleshooting','27']],items:['Contextual help by surface','Command and shortcut reference','Agent lifecycle guide','Security and permissions guide','Provider configuration guide','Troubleshooting and recovery']},
  recovery:{id:'recovery',title:'Offline & Recovery',summary:'Diseña estados degradados para que el frontend siga siendo comprensible cuando servicios fallan.',metrics:[['Offline states','14'],['Recoverable','12'],['Draft protection','On'],['Last sync','2m']],items:['Offline banner and queue','Unsaved draft recovery','Retry with backoff preview','Partial provider outage state','Session restore','Export local evidence before recovery']},
}
const tabs=Object.keys(suites)
export type FinalControlMode=keyof typeof suites

export function FinalControlSuite({mode,onAction}:{mode:FinalControlMode;onAction:(message:string)=>void}){
  const [active,setActive]=useState(mode),[filter,setFilter]=useState(''),[armed,setArmed]=useState(false)
  const [liveMetrics,setLiveMetrics]=useState<Record<string, unknown>>({})
  const [liveUsage,setLiveUsage]=useState<Record<string, unknown>>({})
  const [liveAuditCount,setLiveAuditCount]=useState<number | null>(null)
  const [syncing,setSyncing]=useState(true)
  const suite=suites[active]??suites.teams
  const filtered=useMemo(()=>suite.items.filter(item=>item.toLowerCase().includes(filter.toLowerCase())),[suite.items,filter])

  async function refreshRuntime() {
    setSyncing(true)
    try {
      if (active === 'observability') {
        setLiveMetrics(await runtime.metrics.get())
      } else if (active === 'usage') {
        setLiveUsage(await runtime.usage.summary())
      } else if (active === 'teams') {
        const agents = await runtime.subagents.list()
        setLiveMetrics({ agents: agents.length })
      } else if (active === 'recovery') {
        setLiveMetrics(await runtime.health.get())
      } else {
        setLiveMetrics({})
        setLiveUsage({})
      }
      const audit = await runtime.audit.list(100)
      setLiveAuditCount(audit.length)
    } catch (error) {
      onAction(error instanceof Error ? error.message : 'Runtime telemetry refresh failed')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => { void refreshRuntime() }, [active])

  function liveMetric(label:string, fallback:string) {
    const source = active === 'usage' ? liveUsage : liveMetrics
    const aliases: Record<string,string[]> = {
      'Tokens today': ['tokens_today','total_tokens','tokens'],
      'Estimated spend': ['estimated_spend','cost','total_cost'],
      'Requests': ['requests','request_count','total_requests'],
      'Active runs': ['active_runs','running_runs'],
      'Events/min': ['events_per_minute','events_minute'],
      'p95 latency': ['p95_latency_ms','p95_latency'],
      'Agents': ['agents','count'],
    }
    const keys = aliases[label] ?? [label.toLowerCase().replace(/[^a-z0-9]+/g,'_')]
    for (const key of keys) {
      if (source[key] !== undefined) return typeof source[key] === 'number' ? String(source[key]) : String(source[key])
    }
    return fallback
  }

  return <div className="final-suite">
    <div className="final-suite__hero"><div><span className="eyebrow">Runtime control plane · {syncing ? 'syncing' : 'synced'}</span><h1>{suite.title}</h1><p>{suite.summary}</p></div><div className="final-suite__actions"><Tag label="Runtime-backed"/><button className="studio-button" type="button" onClick={() => void refreshRuntime()}><Icon name="refresh" size={13} /> Refresh</button><button className={armed?'studio-button studio-button--active':'studio-button'} type="button" onClick={()=>{setArmed(v=>!v);onAction(armed?'Local UI controls disarmed':'Local UI controls armed')}}><Icon name={armed?'lock':'shield'} size={14}/> {armed?'Disarm':'Arm preview'}</button></div></div>
    <div className="final-suite__tabs" role="tablist" aria-label="Frontend control surfaces" aria-orientation="horizontal">{tabs.map((id,index)=> <button key={id} id={'final-suite-tab-' + id.toLowerCase()} role="tab" tabIndex={active===id?0:-1} aria-selected={active===id} aria-controls="final-suite-tabpanel" className={active===id?'final-suite__tab final-suite__tab--active':'final-suite__tab'} onClick={()=>{setActive(id);setFilter('')}} onKeyDown={(event)=>{const nextIndex=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index-1+tabs.length)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:-1;if(nextIndex>=0){event.preventDefault();const next=tabs[nextIndex];setActive(next);window.requestAnimationFrame(()=>document.getElementById('final-suite-tab-'+next.toLowerCase())?.focus())}}} type="button">{suites[id].title}</button>)}</div>
    <div id="final-suite-tabpanel" className="final-suite__metrics" role="tabpanel" aria-labelledby={'final-suite-tab-' + active.toLowerCase()} tabIndex={0}>{suite.metrics.map(([label,value])=><MetricCard key={label} label={label} value={value} sub="UI preview"/>)}</div>
    <div className="final-suite__grid"><Panel title="Surface checklist"><div className="final-suite__search"><Icon name="search" size={14}/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter controls…" aria-label="Filter controls"/></div><div className="final-suite__checklist">{filtered.map(item=><button key={item} type="button" onClick={()=>onAction(`Preview: ${item}`)} className="final-suite__check"><span className="final-suite__checkmark"><Icon name="check" size={12}/></span><span><strong>{item}</strong><small>Ready for backend contract</small></span><Icon name="chevron-right" size={13}/></button>)}{!filtered.length&&<div className="final-suite__empty">No controls match the current filter.</div>}</div></Panel>
      <Panel title="Control contract"><div className="final-suite__contract"><Metric label="UI state" value="Local / typed"/><Metric label="Runtime calls" value="None"/><Metric label="Secrets" value="Masked"/><Metric label="Failure mode" value="Fail-closed"/><Metric label="Verification" value="Required"/></div><div className="final-suite__contract-note"><Icon name="info" size={14}/><span>Esta superficie no inventa backend. Cada acción queda preparada para conectarse después a un servicio tipado Tauri/Rust.</span></div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>onAction('Contract preview opened')}>Inspect contract</button><button className="studio-button studio-button--active" type="button" onClick={()=>onAction('Evidence package staged')}>Stage evidence</button></div></Panel>
    </div>
  </div>
}
