import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'

type MarketTab = 'All' | 'Plugins' | 'Skills' | 'MCP' | 'Commands'

const catalog: ReadonlyArray<readonly [string, string, string, string, boolean]> = [
  ['Cursor-style Core', 'Plugin', 'rules · skills · subagents · commands · hooks', 'Workspace', true],
  ['GitHub Engineering', 'Plugin', 'MCP · issues · reviews · source integration', 'Community', false],
  ['Web Research Pack', 'Skill', 'search · extract · browser workflows', 'Community', true],
  ['Safe Execution', 'Skill', 'bounded shell · policy checks · verification', 'Workspace', true],
  ['Linear Tools', 'MCP', 'issues · projects · comments', 'Team', false],
  ['Release Commands', 'Command', 'review · release · evidence', 'Workspace', false],
] as const

export default function MarketplaceStudio({ onAction }: { onAction: (message: string) => void }) {
  const [tab, setTab] = useState<MarketTab>('All')
  const [query, setQuery] = useState('')
  const [installed, setInstalled] = useState<Set<string>>(() => new Set(catalog.filter((item) => item[4]).map((item) => item[0])))
  const visible = useMemo(() => catalog.filter(([name,type,description,scope]) => (tab === 'All' || (tab === 'Plugins' && type === 'Plugin') || (tab === 'Skills' && type === 'Skill') || (tab === 'MCP' && type === 'MCP') || (tab === 'Commands' && type === 'Command')) && (name + type + description + scope).toLowerCase().includes(query.toLowerCase())), [query, tab])
  const toggle = (name: string) => setInstalled((state) => { const next = new Set(state); next.has(name) ? next.delete(name) : next.add(name); return next })
  return (
    <div className="marketplace-studio"><header className="capability-head"><div><span className="eyebrow">Customize</span><h2>Marketplace</h2><p>Unified discovery for plugins, skills, MCP servers and commands.</p></div><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Marketplace package setup opened in preview')}><Icon name="plus" size={13} /> Add package</button></header><div className="marketplace-toolbar"><div className="command-search"><Icon name="search" size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search extensions…" aria-label="Search extensions" /></div><div className="capability-tabs" role="tablist" aria-label="Marketplace filters">{(['All','Plugins','Skills','MCP','Commands'] as MarketTab[]).map((item) => <button type="button" key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'capability-tab capability-tab--active' : 'capability-tab'} onClick={() => setTab(item)}>{item}</button>)}</div></div><div className="marketplace-grid">{visible.map(([name,type,description,scope])=><article className="marketplace-card" key={name}><div className="marketplace-card__top"><div className="capability-icon"><Icon name={type === 'Plugin' ? 'layers' : type === 'MCP' ? 'tool' : type === 'Skill' ? 'spark' : 'command'} size={14} /></div><span className="state-pill state-pill--pending">{type}</span></div><strong>{name}</strong><p>{description}</p><small>{scope} scope</small><button className={installed.has(name) ? 'studio-button' : 'studio-button studio-button--active'} type="button" onClick={() => { const wasInstalled=installed.has(name); toggle(name); onAction(name + (wasInstalled ? ' disabled in preview' : ' enabled in preview')) }}>{installed.has(name) ? 'Manage' : 'Add'}</button></article>)}</div></div>
  )
}
