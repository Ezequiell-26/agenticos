import Icon from './Icon'

interface Provider {
  name: string
  status: 'healthy' | 'degraded' | 'offline'
  models: number
  quota: string
  latency: string
}

const providers: Provider[] = [
  { name: 'Primary runtime', status: 'healthy', models: 12, quota: '84%', latency: '142 ms' },
  { name: 'Fallback route', status: 'healthy', models: 7, quota: '61%', latency: '188 ms' },
  { name: 'Local models', status: 'degraded', models: 4, quota: '—', latency: 'On demand' },
]

export default function ProviderDashboard() {
  return (
    <section className="overview-surface">
      <div className="overview-heading">
        <div>
          <span className="eyebrow">Model plane</span>
          <h1>Providers & models</h1>
          <p>Operational view of the provider layer. Secrets and routing remain owned by the runtime.</p>
        </div>
        <div className="overview-heading__badge"><Icon name="shield" size={14} /> Runtime protected</div>
      </div>

      <div className="metric-row">
        <div className="metric-card"><span>Active routes</span><strong>3</strong><small>Primary + fallback + local</small></div>
        <div className="metric-card"><span>Available models</span><strong>23</strong><small>Capabilities discovered by runtime</small></div>
        <div className="metric-card"><span>Avg. latency</span><strong>165 ms</strong><small>Last observed session window</small></div>
      </div>

      <div className="surface-block">
        <div className="surface-block__heading"><span>Provider health</span><span className="mono-text">runtime snapshot</span></div>
        <div className="provider-list">
          {providers.map((provider) => (
            <div className="provider-row" key={provider.name}>
              <div className="provider-row__identity"><span className={
                `status-dot ${provider.status === 'offline' ? 'status-dot--offline' : 'status-dot--live'}`
              } /><strong>{provider.name}</strong></div>
              <span>{provider.models} models</span>
              <span>{provider.quota}</span>
              <span>{provider.latency}</span>
              <button className="icon-button" type="button" aria-label={`Open ${provider.name}`} title={`Open ${provider.name}`}><Icon name="chevron-right" size={15} /></button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
