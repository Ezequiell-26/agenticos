import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icon'
import { navigationItems, type RailMode } from '../navigation'
import { navigationSections, getNavigationSection } from '../navigation-taxonomy'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface NavigationLauncherProps {
  active: RailMode
  onChange: (mode: RailMode) => void
  onClose: () => void
}

const sectionOrder = navigationSections.map((section) => section.id)
const launcherRecentKey = 'agenticos.ui.navigation.recent'
const launcherFavoritesKey = 'agenticos.ui.navigation.favorites'

function readIdList(key: string) {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}

function writeIdList(key: string, values: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(values))
  } catch {
    // UI discovery persistence is optional.
  }
}

export default function NavigationLauncher({ active, onChange, onClose }: NavigationLauncherProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [filter, setFilter] = useState<'All' | 'Recent' | 'Pinned'>('All')
  const [recent, setRecent] = useState<string[]>(() => readIdList(launcherRecentKey))
  const [favorites, setFavorites] = useState<string[]>(() => readIdList(launcherFavoritesKey))
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const dialogRef = useRef<HTMLElement>(null)
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const source = filter === 'Recent'
      ? recent.map((id) => navigationItems.find((item) => item.id === id)).filter((item): item is (typeof navigationItems)[number] => Boolean(item))
      : filter === 'Pinned'
        ? navigationItems.filter((item) => favorites.includes(item.id))
        : navigationItems
    return normalized
      ? source.filter((item) => (item.label + ' ' + item.detail).toLowerCase().includes(normalized))
      : source
  }, [favorites, filter, query, recent])

  useFocusTrap(true, dialogRef)
  useEffect(() => { setSelectedIndex(0); itemRefs.current = [] }, [filter, query])
  useEffect(() => { itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' }) }, [selectedIndex])

  function openFeature(mode: RailMode) {
    const nextRecent = [mode, ...recent.filter((id) => id !== mode)].slice(0, 8)
    setRecent(nextRecent)
    writeIdList(launcherRecentKey, nextRecent)
    onChange(mode)
  }

  function toggleFavorite() {
    const nextFavorites = favorites.includes(active)
      ? favorites.filter((id) => id !== active)
      : [active, ...favorites].slice(0, 16)
    setFavorites(nextFavorites)
    writeIdList(launcherFavoritesKey, nextFavorites)
  }

  return (
    <div ref={dialogRef} className="navigation-launcher" role="dialog" aria-label="All AgentiCOS features">
      <div className="navigation-launcher__head">
        <div><span className="eyebrow">AgentiCOS</span><strong>All features</strong></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close feature launcher"><Icon name="x" size={14} /></button>
      </div>
      <div className="navigation-launcher__filters" role="tablist" aria-label="Feature launcher filters" aria-orientation="horizontal">
        {(['All', 'Recent', 'Pinned'] as const).map((item) => (
          <button key={item} id={'launcher-filter-' + item.toLowerCase()} type="button" role="tab" tabIndex={filter === item ? 0 : -1} aria-selected={filter === item} onClick={() => setFilter(item)} onKeyDown={(event) => {
            const options = ['All', 'Recent', 'Pinned'] as const
            const index = options.indexOf(item)
            const nextIndex = event.key === 'ArrowRight' ? (index + 1) % options.length : event.key === 'ArrowLeft' ? (index - 1 + options.length) % options.length : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : -1
            if (nextIndex >= 0) {
              event.preventDefault()
              const next = options[nextIndex]
              setFilter(next)
              window.requestAnimationFrame(() => document.getElementById('launcher-filter-' + next.toLowerCase())?.focus())
            }
          }}>
            {item}{item === 'Recent' && recent.length > 0 ? ' ' + recent.length : item === 'Pinned' && favorites.length > 0 ? ' ' + favorites.length : ''}
          </button>
        ))}
        <button className="icon-button navigation-launcher__favorite" type="button" aria-label={favorites.includes(active) ? 'Unpin active feature' : 'Pin active feature'} aria-pressed={favorites.includes(active)} title={favorites.includes(active) ? 'Unpin active feature' : 'Pin active feature'} onClick={toggleFavorite}>
          <Icon name="archive" size={14} />
        </button>
      </div>
      <div className="navigation-launcher__search">
        <Icon name="search" size={14} />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key.toLowerCase() === 'p' && !event.metaKey && !event.ctrlKey && !event.altKey) {
              event.preventDefault()
              toggleFavorite()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              onClose()
            } else if (event.key === 'ArrowDown' && filtered.length > 0) {
              event.preventDefault()
              setSelectedIndex((index) => (index + 1) % filtered.length)
            } else if (event.key === 'ArrowUp' && filtered.length > 0) {
              event.preventDefault()
              setSelectedIndex((index) => (index - 1 + filtered.length) % filtered.length)
            } else if (event.key === 'Enter' && filtered[selectedIndex]) {
              event.preventDefault()
              openFeature(filtered[selectedIndex].id)
            }
          }}
          placeholder="Search features…"
          aria-label="Search features"
          role="combobox"
          aria-controls="agenticos-feature-results"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-activedescendant={filtered[selectedIndex] ? 'feature-' + filtered[selectedIndex].id : undefined}
        />
      </div>
      <div id="agenticos-feature-results" className="navigation-launcher__body" role="listbox" aria-label="AgentiCOS feature results">
        {sectionOrder.map((sectionId) => {
          const meta = navigationSections.find((item) => item.id === sectionId)
          const items = filtered.filter((item) => getNavigationSection(item.id) === sectionId)
          if (!meta || items.length === 0) return null
          return (
            <section key={sectionId} className="navigation-launcher__group">
              <div className="navigation-launcher__group-title"><strong>{meta.label}</strong><small>{meta.detail}</small></div>
              {items.map((item) => (
                <button id={'feature-' + item.id} key={item.id} role="option" aria-selected={active === item.id || filtered[selectedIndex]?.id === item.id} type="button" className={(active === item.id ? 'navigation-launcher__item navigation-launcher__item--active' : 'navigation-launcher__item') + (filtered[selectedIndex]?.id === item.id ? ' navigation-launcher__item--keyboard-active' : '')} onClick={() => openFeature(item.id)} ref={(element) => {
                  const index = filtered.findIndex((candidate) => candidate.id === item.id)
                  if (index >= 0) itemRefs.current[index] = element
                }}>
                  <span className="navigation-launcher__item-icon"><Icon name={item.icon} size={14} /></span>
                  <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                  {active === item.id && <span className="status-dot status-dot--live" />}
                </button>
              ))}
            </section>
          )
        })}
        {filtered.length === 0 && <div className="navigation-launcher__empty">No feature matches “{query}”.</div>}
      </div>
      <div className="navigation-launcher__foot"><span><kbd>Click</kbd> open feature</span><span><kbd>P</kbd> pin active</span><span><kbd>⌘K</kbd> command palette</span></div>
    </div>
  )
}
