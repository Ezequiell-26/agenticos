import Icon, { type IconName } from './Icon'

type RailMode = 'chat' | 'files' | 'runs' | 'providers' | 'settings'

interface ActivityRailProps {
  active: RailMode
  onChange: (mode: RailMode) => void
}

const items: Array<{ id: RailMode; label: string; icon: IconName }> = [
  { id: 'chat', label: 'Chat', icon: 'message' },
  { id: 'files', label: 'Files', icon: 'folder' },
  { id: 'runs', label: 'Runs', icon: 'activity' },
  { id: 'providers', label: 'Providers', icon: 'bot' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

export default function ActivityRail({ active, onChange }: ActivityRailProps) {
  return (
    <nav className="activity-rail" aria-label="Primary navigation">
      <div className="activity-brand" aria-label="AgentiCOS">
        <span className="brand-mark">A</span>
      </div>
      <div className="activity-rail__items">
        {items.map((item) => (
          <button
            aria-label={item.label}
            className={`rail-button ${active === item.id ? 'rail-button--active' : ''}`}
            key={item.id}
            onClick={() => onChange(item.id)}
            title={item.label}
            type="button"
          >
            <Icon name={item.icon} size={19} />
            {active === item.id && <span className="rail-indicator" />}
          </button>
        ))}
      </div>
      <button className="rail-button rail-button--muted" aria-label="Security status" title="Security" type="button">
        <Icon name="shield" size={18} />
      </button>
    </nav>
  )
}
