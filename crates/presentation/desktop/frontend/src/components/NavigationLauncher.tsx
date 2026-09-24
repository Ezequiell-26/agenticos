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

export default function NavigationLauncher({ active, onChange, onClose }: NavigationLauncherProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const dialogRef = useRef<HTMLElement>(null)
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return normalized
      ? navigationItems.filter((item) => (item.label + ' ' + item.detail).toLowerCase().includes(normalized))
      : navigationItems
  }, [query])

  useFocusTrap(true, dialogRef)
  useEffect(() => { setSelectedIndex(0); itemRefs.current = [] }, [query])
  useEffect(() => { itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' }) }, [selectedIndex])

  return (
    <div ref={dialogRef} className="navigation-launcher" role="dialog" aria-label="All AgentiCOS features">
      <div className="navigation-launcher__head">
        <div><span className="eyebrow">AgentiCOS</span><strong>All features</strong></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close feature launcher"><Icon name="x" size={14} /></button>
      </div>
      <div className="navigation-launcher__search">
        <Icon name="search" size={14} />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
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
              onChange(filtered[selectedIndex].id)
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
                <button id={'feature-' + item.id} key={item.id} role="option" aria-selected={active === item.id || filtered[selectedIndex]?.id === item.id} type="button" className={(active === item.id ? 'navigation-launcher__item navigation-launcher__item--active' : 'navigation-launcher__item') + (filtered[selectedIndex]?.id === item.id ? ' navigation-launcher__item--keyboard-active' : '')} onClick={() => onChange(item.id)} ref={(element) => {
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
      <div className="navigation-launcher__foot"><span><kbd>Click</kbd> open feature</span><span><kbd>⌘K</kbd> command palette</span></div>
    </div>
  )
}
