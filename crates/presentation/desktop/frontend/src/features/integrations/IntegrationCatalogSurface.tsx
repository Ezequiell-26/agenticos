import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import type { PlatformMode } from '../../navigation'

type Item = [string,string,string,string]

const homeItems: Item[] = [
  ['ha-light', 'Lights', 'Control room lighting devices', 'homeassistant'],
  ['ha-climate', 'Climate', 'Inspect and set climate devices', 'homeassistant'],
  ['ha-scene', 'Scenes', 'Trigger predefined home scenes', 'homeassistant'],
  ['ha-status', 'State', 'Read entity state and availability', 'homeassistant'],
]
const socialItems: Item[] = [
  ['x-search', 'X Search', 'Search posts, threads and public discussion', 'social'],
  ['x-thread', 'Thread extraction', 'Collect a thread for research context', 'social'],
  ['x-monitor', 'Topic monitor', 'Prepare a recurring topic watch', 'social'],
  ['x-export', 'Research export', 'Package sources and notes for a run', 'social'],
]

export default function IntegrationCatalogSurface({ mode, onAction }: { mode: Extract<PlatformMode,'homeassistant'|'social'>; onAction: (message:string)=>void }) {
  const items = mode === 'homeassistant' ? homeItems : socialItems
  const [query,setQuery]=useState('')
  const [selected,setSelected]=useState(items[0][0])
  const current=items.find((item)=>item[0]===selected)??items[0]
  const visible=useMemo(()=>items.filter((item)=>item.join(' ').toLowerCase().includes(query.toLowerCase())),[items,query])
  return (
    <div className="integration-catalog">
      <header className="capability-head"><div><span className="eyebrow">{mode === 'homeassistant' ? 'Integration' : 'Research toolset'}</span><h2>{mode === 'homeassistant' ? 'Home Assistant' : 'Social Search'}</h2><p>{mode === 'homeassistant' ? 'Expose Home Assistant tool families with explicit scopes and confirmation state.' : 'Expose social-search workflows without pretending that credentials or external delivery are connected.'}</p></div><span className="state-pill state-pill--pending">Preview</span></header>
      <div className="integration-toolbar"><div className="command-search"><Icon name="search" size={13}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Filter capabilities…" aria-label="Filter capabilities"/></div></div>
      <div className="integration-layout"><aside className="capability-list">{visible.map(([id,title,detail])=><button type="button" key={id} className={selected===id?'capability-row capability-row--active':'capability-row'} onClick={()=>setSelected(id)}><span className="capability-icon"><Icon name={mode==='homeassistant'?'settings':'search'} size={14}/></span><span><strong>{title}</strong><small>{detail}</small></span><Icon name="chevron-right" size={12}/></button>)}</aside><section className="integration-detail"><div className="capability-head"><div><span className="eyebrow">Capability</span><h2>{current[1]}</h2><p>{current[2]}</p></div><button className="studio-button studio-button--active" type="button" onClick={()=>onAction(current[1]+' action staged in preview')}><Icon name="play" size={13}/> Test</button></div><div className="integration-metric-grid"><div className="metric-card"><span>Scope</span><strong>Explicit</strong><small>workspace integration</small></div><div className="metric-card"><span>Approval</span><strong>Policy-based</strong><small>runtime-owned</small></div><div className="metric-card"><span>Credentials</span><strong>External</strong><small>never rendered here</small></div><div className="metric-card"><span>Audit</span><strong>Ready</strong><small>event surface</small></div></div><section className="surface-block"><div className="surface-block__heading"><span>Tool workflow</span><span className="mono-text">{mode}</span></div><div className="integration-steps">{['Discover capability','Select scope','Request action','Review result'].map((step,index)=><div key={step}><span>{String(index+1).padStart(2,'0')}</span><strong>{step}</strong><small>{index<2?'Configured locally':'Runtime contract required'}</small></div>)}</div></section></section></div>
    </div>
  )
}
