import { useState } from 'react'
import Icon from './Icon'
import { navigationItems, type RailMode } from '../navigation'
import NavigationLauncher from './NavigationLauncher'

export type { RailMode } from '../navigation'

interface ActivityRailProps {
  active: RailMode
  onChange: (mode: RailMode) => void
}

export default function ActivityRail({ active, onChange }: ActivityRailProps) {
  const [launcherOpen, setLauncherOpen] = useState(false)
  let previousGroup: string | undefined

  return (
    <nav className="activity-rail" aria-label="Primary navigation">
      <div className="activity-brand">
        <button className={launcherOpen ? 'brand-mark brand-mark--active' : 'brand-mark'} type="button" aria-label="Open all AgentiCOS features" aria-expanded={launcherOpen} onClick={() => setLauncherOpen((value) => !value)}>A</button>
        {launcherOpen && <NavigationLauncher active={active} onChange={(mode) => { onChange(mode); setLauncherOpen(false) }} onClose={() => setLauncherOpen(false)} />}
      </div>

      <div className="activity-rail__items">
        {navigationItems.map((item) => {
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
          className={`rail-button rail-button--muted ${active === 'security' ? 'rail-button--active' : ''}`}
          aria-label="Security Center"
          title="Security Center"
          onClick={() => onChange('security')}
          type="button"
        >
          <Icon name="shield" size={18} />
        </button>
      </div>
    </nav>
  )
}
