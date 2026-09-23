import Icon, { type IconName } from './Icon'

export type RailMode =
  | 'chat'
  | 'files'
  | 'runs'
  | 'providers'
  | 'skills'
  | 'tools'
  | 'memory'
  | 'workflows'
  | 'artifacts'
  | 'terminal'
  | 'settings'

interface ActivityRailProps {
  active: RailMode
  onChange: (mode: RailMode) => void
}

const items: Array<{ id: RailMode; label: string; icon: IconName; group: 'build' | 'operate' | 'configure' }> = [
  { id: 'chat', label: 'Command Center', icon: 'message', group: 'build' },
  { id: 'files', label: 'Files & Editor', icon: 'folder', group: 'build' },
  { id: 'terminal', label: 'Terminal', icon: 'terminal', group: 'build' },
  { id: 'runs', label: 'Runs', icon: 'activity', group: 'operate' },
  { id: 'workflows', label: 'Workflows', icon: 'clock', group: 'operate' },
  { id: 'artifacts', label: 'Artifacts', icon: 'archive', group: 'operate' },
  { id: 'providers', label: 'Providers & Models', icon: 'bot', group: 'operate' },
  { id: 'skills', label: 'Skills', icon: 'spark', group: 'configure' },
  { id: 'tools', label: 'Tools', icon: 'tool', group: 'configure' },
  { id: 'memory', label: 'Memory', icon: 'history', group: 'configure' },
  { id: 'settings', label: 'Settings', icon: 'settings', group: 'configure' },
]

export default function ActivityRail({ active, onChange }: ActivityRailProps) {
  let previousGroup: string | undefined

  return (
    <nav className="activity-rail" aria-label="Primary navigation">
      <div className="activity-brand" aria-label="AgentiCOS">
        <span className="brand-mark">A</span>
      </div>

      <div className="activity-rail__items">
        {items.map((item) => {
          const showDivider = previousGroup !== undefined && previousGroup !== item.group
          previousGroup = item.group

          return (
            <div className="rail-item" key={item.id}>
              {showDivider && <span className="rail-divider" aria-hidden="true" />}
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
            </div>
          )
        })}
      </div>

      <div className="activity-rail__bottom">
        <button className="rail-button rail-button--muted" aria-label="Security status" title="Security" type="button">
          <Icon name="shield" size={18} />
        </button>
      </div>
    </nav>
  )
}
