import { useMemo, useState } from 'react'
import Icon from './Icon'
import { navigationItems, type NavigationGroup, type RailMode } from '../navigation'

interface NavigationLauncherProps {
  active: RailMode
  onChange: (mode: RailMode) => void
  onClose: () => void
}

const groups: NavigationGroup[] = ['build', 'operate', 'configure', 'integrate']

const labels: Record<NavigationGroup, string> = {
  build: 'Build',
  operate: 'Operate',
  configure: 'Configure',
  integrate: 'Integrate',
}

export default function NavigationLauncher({ active, onChange, onClose }: NavigationLauncherProps) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return normalized
      ? navigationItems.filter((item) => (item.label + ' ' + item.detail).toLowerCase().includes(normalized))
      : navigationItems
  }, [query])

  return (
    <div className="navigation-launcher" role="dialog" aria-label="All AgentiCOS features">
      <div className="navigation-launcher__head">
        <div><span className="eyebrow">AgentiCOS</span><strong>All features</strong></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close feature launcher"><Icon name="x" size={14} /></button>
      </div>
      <div className="navigation-launcher__search">
        <Icon name="search" size={14} />
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search features…" aria-label="Search features" />
      </div>
      <div className="navigation-launcher__body">
        {groups.map((group) => {
          const items = filtered.filter((item) => item.group === group)
          if (items.length === 0) return null
          return (
            <section key={group} className="navigation-launcher__group">
              <div className="navigation-launcher__group-title">{labels[group]}</div>
              {items.map((item) => (
                <button key={item.id} type="button" className={active === item.id ? 'navigation-launcher__item navigation-launcher__item--active' : 'navigation-launcher__item'} onClick={() => onChange(item.id)}>
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
