import Icon from './Icon'

interface RouteSlot {
  name: string
  role: string
}

const routeSlots: RouteSlot[] = [
  { name: 'Primary route', role: 'Preferred provider path' },
  { name: 'Fallback route', role: 'Failover provider path' },
  { name: 'Local route', role: 'On-device model path' },
]

export default function ProviderDashboard() {
  return (
    <section className="overview-surface">
      <div className="overview-heading">
        <div>
          <span className="eyebrow">Model plane</span>
          <h1>Providers & models</h1>
          <p>Runtime-owned provider routing and model discovery. No credentials or provider calls are handled by leaf UI components.</p>
        </div>
        <div className="overview-heading__badge"><Icon name="shield" size={14} /> Runtime protected</div>
      </div>

      <div className="metric-row">
        <div className="metric-card"><span>Telemetry</span><strong>Awaiting runtime</strong><small>No synthetic health, quota or latency values.</small></div>
        <div className="metric-card"><span>Model catalog</span><strong>Runtime owned</strong><small>Model discovery belongs behind the service boundary.</small></div>
        <div className="metric-card"><span>Secrets</span><strong>Isolated</strong><small>Credentials never live in the component tree.</small></div>
      </div>

      <div className="surface-block">
        <div className="surface-block__heading"><span>Route slots</span><span className="mono-text">design contract</span></div>
        <div className="provider-list">
          {routeSlots.map((route) => (
            <div className="provider-row" key={route.name}>
              <div className="provider-row__identity"><span className="status-dot status-dot--offline" /><strong>{route.name}</strong></div>
              <span>Not connected</span>
              <span>—</span>
              <span>{route.role}</span>
              <button className="icon-button" type="button" aria-label={`Open ${route.name}`} title={`Open ${route.name}`}><Icon name="chevron-right" size={15} /></button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
