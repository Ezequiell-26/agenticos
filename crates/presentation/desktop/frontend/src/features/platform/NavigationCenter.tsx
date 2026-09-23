import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { navigationItems, primaryRailIds, type RailMode } from '../../navigation'
import { getNavigationSection, navigationSections } from '../../navigation-taxonomy'
import { MetricCard, Panel, Tag } from './PlatformPrimitives'

const favoriteKey = 'agenticos.navigation.favorites'
const recentKey = 'agenticos.navigation.recent'

function readIds(key: string): RailMode[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value.filter((id): id is RailMode => navigationItems.some((item) => item.id === id)) : []
  } catch { return [] }
}
function writeIds(key: string, ids: RailMode[]) {
  try { window.localStorage.setItem(key, JSON.stringify(ids.slice(0, 12))) } catch { /* optional storage */ }
}

export function NavigationCenter({ active, onChange }: { active: RailMode; onChange: (mode: RailMode) => void }) {
  const [query, setQuery] = useState('')
  const [section, setSection] = useState('all')
  const [favorites, setFavorites] = useState<RailMode[]>(() => readIds(favoriteKey))
  const [recent, setRecent] = useState<RailMode[]>(() => readIds(recentKey))
  const visible = useMemo(() => navigationItems.filter((item) => (section === 'all' || getNavigationSection(item.id) === section) && (!query || (item.label + ' ' + item.detail).toLowerCase().includes(query.toLowerCase()))), [query, section])
  const favoriteItems = favorites.map((id) => navigationItems.find((item) => item.id === id)).filter(Boolean)
  const recentItems = recent.map((id) => navigationItems.find((item) => item.id === id)).filter(Boolean)
  const open = (id: RailMode) => { const next = [id, ...recent.filter((item) => item !== id)]; setRecent(next); writeIds(recentKey, next); onChange(id) }
  const toggleFavorite = (id: RailMode) => { const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [id, ...favorites]; setFavorites(next); writeIds(favoriteKey, next) }
  return <div className="navigation-center">
    <header className="navigation-center__hero"><div><span className="eyebrow">Information architecture</span><h1>Workspace Navigator</h1><p>Organize the full AgentiCOS surface catalog without overcrowding the primary rail.</p></div><div className="navigation-center__actions"><Tag label={navigationItems.length + ' surfaces'} /><Tag label={primaryRailIds.size + ' primary'} /></div></header>
    <div className="platform-metrics"><MetricCard label="Sections" value={String(navigationSections.length)} sub="Workspace → System" /><MetricCard label="Favorites" value={String(favorites.length)} sub="Stored locally" /><MetricCard label="Recent" value={String(recent.length)} sub="Last opened" /><MetricCard label="Primary rail" value={String(primaryRailIds.size)} sub="Curated core" /></div>
    <div className="navigation-center__toolbar"><div className="nav-center-search"><Icon name="search" size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all features…" aria-label="Search all features" /></div><button type="button" className={section === 'all' ? 'studio-button studio-button--active' : 'studio-button'} onClick={() => setSection('all')}>All</button>{navigationSections.map((item) => <button type="button" key={item.id} className={section === item.id ? 'studio-button studio-button--active' : 'studio-button'} onClick={() => setSection(item.id)}>{item.label}</button>)}</div>
    <div className="navigation-center__grid"><Panel title="Favorites"><div className="nav-center-list">{favoriteItems.length ? favoriteItems.map((item) => item && <NavRow key={item.id} item={item} favorite onFavorite={toggleFavorite} onOpen={open} active={active} />) : <div className="nav-center-empty">Favorite the features you use most.</div>}</div></Panel><Panel title="Recent"><div className="nav-center-list">{recentItems.length ? recentItems.map((item) => item && <NavRow key={item.id} item={item} favorite={favorites.includes(item.id)} onFavorite={toggleFavorite} onOpen={open} active={active} />) : <div className="nav-center-empty">Recently opened features appear here.</div>}</div></Panel></div>
    <Panel title={section === 'all' ? 'All features' : navigationSections.find((item) => item.id === section)?.label ?? 'Features'}><div className="nav-center-catalog">{visible.map((item) => <NavRow key={item.id} item={item} favorite={favorites.includes(item.id)} onFavorite={toggleFavorite} onOpen={open} active={active} />)}{visible.length === 0 && <div className="nav-center-empty">No features match the current filter.</div>}</div></Panel>
    <div className="navigation-center__section-cards">{navigationSections.map((item) => { const count = navigationItems.filter((nav) => getNavigationSection(nav.id) === item.id).length; return <button type="button" key={item.id} className="nav-section-card" onClick={() => setSection(item.id)}><span><strong>{item.label}</strong><small>{item.detail}</small></span><b>{count}</b></button> })}</div>
  </div>
}

function NavRow({ item, favorite, onFavorite, onOpen, active }: { item: (typeof navigationItems)[number]; favorite: boolean; onFavorite: (id: RailMode) => void; onOpen: (id: RailMode) => void; active: RailMode }) {
  return <div className={active === item.id ? 'nav-center-row nav-center-row--active' : 'nav-center-row'}><button type="button" className="nav-center-row__main" onClick={() => onOpen(item.id)}><span className="nav-center-row__icon"><Icon name={item.icon} size={13} /></span><span><strong>{item.label}</strong><small>{getNavigationSection(item.id)} · {item.detail}</small></span></button><button type="button" className={favorite ? 'nav-center-row__star nav-center-row__star--active' : 'nav-center-row__star'} aria-label={favorite ? 'Remove favorite ' + item.label : 'Favorite ' + item.label} onClick={() => onFavorite(item.id)}><Icon name={favorite ? 'check' : 'plus'} size={12} /></button></div>
}
