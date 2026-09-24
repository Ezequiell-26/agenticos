import { useState } from 'react'
import Icon from './Icon'
import { navigationItems, primaryRailIds, type RailMode } from '../navigation'
import NavigationLauncher from './NavigationLauncher'

export type { RailMode } from '../navigation'

interface ActivityRailProps {
  active: RailMode
  onChange: (mode: RailMode) => void
}

export default function ActivityRail({ active, onChange }: ActivityRailProps) {
  const [launcherOpen, setLauncherOpen] = useState(false)
  const primaryItems = navigationItems.filter((item) => primaryRailIds.has(item.id))
  const activeItem = navigationItems.find((item) => item.id === active)
  const visibleItems = activeItem && !primaryRailIds.has(active) ? [activeItem, ...primaryItems] : primaryItems
  let previousGroup: string | undefined

  return (
    <nav className="activity-rail" aria-label="Primary navigation">
      <div className="activity-brand">
        <button
          className={launcherOpen ? 'brand-mark brand-mark--active' : 'brand-mark'}
          type="button"
          aria-label="Open all AgentiCOS features"
          aria-expanded={launcherOpen}
          aria-controls="agenticos-navigation-launcher"
          onClick={() => setLauncherOpen((value) => !value)}
        >A</button>
        {launcherOpen && <NavigationLauncher active={active} onChange={(mode) => { onChange(mode); setLauncherOpen(false) }} onClose={() => setLauncherOpen(false)} />}
      </div>

      <div className="activity-rail__items">
        {visibleItems.map((item) => {
          const showDivider = previousGroup !== undefined && previousGroup !== item.group
          previousGroup = item.group

          return (
            <div className="rail-item" key={item.id}>
              {showDivider && <span className="rail-divider" aria-hidden="true" />}
              <div className="rail-button-wrap">
                <button
                  aria-label={item.label}
                  aria-current={active === item.id ? 'page' : undefined}
                  className={`rail-button ${active === item.id ? 'rail-button--active' : ''}`}
                  onClick={() => onChange(item.id)}
                  title={item.label}
                  type="button"
                >
                  <Icon name={item.icon} size={18} />
                  {active === item.id && <span className="rail-indicator" />}
                </button>
                <span className="rail-tooltip" role="tooltip">{item.label}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="activity-rail__bottom">
        <button
          className={launcherOpen ? 'rail-button rail-button--muted rail-button--active' : 'rail-button rail-button--muted'}
          aria-label="Open all features"
          aria-expanded={launcherOpen}
          aria-controls="agenticos-navigation-launcher"
          title="All features"
          onClick={() => setLauncherOpen((value) => !value)}
          type="button"
        >
          <Icon name="command" size={17} />
        </button>
      </div>
    </nav>
  )
}
