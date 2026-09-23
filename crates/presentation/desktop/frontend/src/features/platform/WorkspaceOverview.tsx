import Icon from '../../components/Icon'
import { analyticsCards, backgroundJobs, notifications, tasks } from './platformData'
import { MetricCard, Panel, Shell, Toast } from './PlatformPrimitives'

export function WorkspaceOverview({ onAction }: { onAction: (message: string) => void }) {
  const unread = notifications.filter((item) => !item[4]).length
  const activeTasks = tasks.filter((item) => item[3] === 'In progress' || item[3] === 'Ready').length
  const runningAgents = backgroundJobs.filter((item) => item[3] === 'working').length

  return (
    <Shell>
      <header className="platform-header">
        <div>
          <span className="eyebrow">Workspace control plane</span>
          <h1>Workspace Overview</h1>
          <p>One surface for current project health, active agent work, pending decisions and the next safe action.</p>
        </div>
        <div className="platform-header__actions">
          <button className="studio-button" type="button" onClick={() => onAction('Workspace refresh staged in preview')}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
          <button className="studio-button studio-button--active" type="button" onClick={() => onAction('New task staged in preview')}>
            <Icon name="plus" size={14} /> New task
          </button>
        </div>
      </header>

      <div className="platform-metrics">
        {analyticsCards.map(([label, value, sub]) => <MetricCard key={label} label={label} value={value} sub={sub} />)}
      </div>

      <div className="overview-grid">
        <Panel title="Workspace health">
          <div className="overview-health">
            <div><span>Frontend architecture</span><strong>Stable preview</strong><small>All current platform surfaces remain presentation-only.</small></div>
            <div><span>Runtime connection</span><strong>Not connected</strong><small>Backend contracts intentionally remain outside this frontend slice.</small></div>
            <div><span>Verification</span><strong>Pending</strong><small>Build, browser and CI evidence must be collected before release.</small></div>
          </div>
          <div className="platform-actions">
            <button className="studio-button" type="button" onClick={() => onAction('Verification checklist opened in preview')}>Open verification</button>
            <button className="studio-button" type="button" onClick={() => onAction('Architecture journal opened in preview')}>Open journal</button>
          </div>
        </Panel>

        <Panel title="Attention required">
          <div className="overview-alerts">
            {notifications.filter((item) => !item[4]).slice(0, 3).map(([title, detail, age, priority]) => (
              <button key={title} className="overview-alert" type="button" onClick={() => onAction(`${title} opened in preview`)}>
                <span className={`overview-alert__dot overview-alert__dot--${priority}`} />
                <div><strong>{title}</strong><small>{detail}</small></div>
                <time>{age}</time>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="overview-grid overview-grid--three">
        <Panel title="Active tasks">
          <div className="overview-list">
            {tasks.slice(0, 4).map(([id, title, owner, state, priority]) => (
              <button key={id} className="overview-row" type="button" onClick={() => onAction(`${id} opened in preview`)}>
                <span className="overview-row__badge">{priority}</span>
                <div><strong>{title}</strong><small>{owner} · {state}</small></div>
                <Icon name="chevron-right" size={13} />
              </button>
            ))}
          </div>
          <button className="studio-button" type="button" onClick={() => onAction('Task manager opened in preview')}>Open task manager · {activeTasks} active</button>
        </Panel>

        <Panel title="Agent activity">
          <div className="overview-list">
            {backgroundJobs.map(([id, title, agent, state, age]) => (
              <button key={id} className="overview-row" type="button" onClick={() => onAction(`${id} activity opened in preview`)}>
                <span className={`status-dot ${state === 'working' ? 'status-dot--live' : 'status-dot--offline'}`} />
                <div><strong>{title}</strong><small>{agent} · {state}</small></div>
                <time>{age}</time>
              </button>
            ))}
          </div>
          <button className="studio-button" type="button" onClick={() => onAction('Agent activity center opened in preview')}>Open activity center · {runningAgents} running</button>
        </Panel>

        <Panel title="Quick actions">
          <div className="overview-actions">
            {[
              ['play', 'Run agent', 'Start a controlled preview run'],
              ['search', 'Inspect context', 'Review context sources and budget'],
              ['shield', 'Review approvals', 'Inspect sensitive action gates'],
              ['history', 'Open audit', 'Review workspace evidence'],
            ].map(([icon, label, detail]) => (
              <button key={label} type="button" className="overview-action" onClick={() => onAction(`${label} opened in preview`)}>
                <span className="overview-action__icon"><Icon name={icon as 'play'} size={14} /></span>
                <div><strong>{label}</strong><small>{detail}</small></div>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <Toast message="" />
    </Shell>
  )
}
