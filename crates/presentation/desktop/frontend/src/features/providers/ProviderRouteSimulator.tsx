import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'

type Failure = 'timeout' | 'rate-limit' | 'context' | 'tool' | 'outage'
type Health = 'Healthy' | 'Degraded' | 'Offline'

const routes = [
  { id: 'primary', label: 'Primary', health: 'Healthy' as Health, latency: '142 ms' },
  { id: 'fallback', label: 'Fallback', health: 'Healthy' as Health, latency: '188 ms' },
  { id: 'local', label: 'Local', health: 'Degraded' as Health, latency: 'on demand' },
]

const failureLabels: Record<Failure, string> = { timeout: 'Timeout', 'rate-limit': 'Rate limit', context: 'Context overflow', tool: 'Tool incompatibility', outage: 'Provider outage' }

export default function ProviderRouteSimulator() {
  const [failure, setFailure] = useState<Failure>('timeout')
  const [autoFailover, setAutoFailover] = useState(true)
  const [healthAware, setHealthAware] = useState(true)
  const [boundedRetries, setBoundedRetries] = useState(true)
  const [attempts, setAttempts] = useState(2)

  const decision = useMemo(() => {
    const primary = routes[0]
    const fallback = routes[1]
    const local = routes[2]
    const trace: Array<{ label: string; state: 'done' | 'blocked' | 'selected' | 'skipped'; detail: string }> = [
      { label: 'Primary attempt', state: 'done', detail: failureLabels[failure] + ' injected' },
    ]
    if (!autoFailover) {
      trace.push({ label: 'Fallback transition', state: 'blocked', detail: 'Automatic failover is disabled' })
      trace.push({ label: 'Terminal outcome', state: 'selected', detail: 'Remain on primary route' })
      return { route: primary, trace, reason: 'Failover policy prevents route advancement.' }
    }
    trace.push({ label: 'Bounded retry', state: boundedRetries ? 'done' : 'skipped', detail: boundedRetries ? (String(attempts) + ' attempt' + (attempts === 1 ? '' : 's') + ' allowed') : 'Retry guard disabled' })
    if (failure === 'tool') trace.push({ label: 'Capability match', state: 'done', detail: 'Search for a tool-compatible route' })
    if (failure === 'context') trace.push({ label: 'Context adaptation', state: 'done', detail: 'Compact before fallback selection' })
    if (healthAware && fallback.health !== 'Healthy') {
      trace.push({ label: 'Health gate', state: 'blocked', detail: 'Fallback is not healthy' })
      trace.push({ label: 'Local route', state: 'selected', detail: 'Selected as last-resort route' })
      return { route: local, trace, reason: 'Health-aware selection skipped an unhealthy fallback.' }
    }
    trace.push({ label: 'Fallback transition', state: 'selected', detail: 'Fallback route selected' })
    return { route: fallback, trace, reason: 'Declared fallback remains compatible and healthy.' }
  }, [attempts, autoFailover, boundedRetries, failure, healthAware])

  return (
    <section className="provider-route-simulator" aria-labelledby="provider-route-simulator-title">
      <div className="provider-route-simulator__head"><div><span className="eyebrow">Deterministic scenario</span><h3 id="provider-route-simulator-title">Route decision simulator</h3><small>Presentation-only replay of provider selection rules. No network calls are executed.</small></div><span className="state-pill state-pill--active">Preview</span></div>
      <div className="provider-route-simulator__controls">
        <label><span>Injected failure</span><select value={failure} onChange={(event) => setFailure(event.target.value as Failure)}>{Object.entries(failureLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label><span>Retry attempts</span><input type="number" min="1" max="5" value={attempts} onChange={(event) => setAttempts(Math.min(5, Math.max(1, Number(event.target.value) || 1)))} /></label>
        <button type="button" className={autoFailover ? 'control-pill control-pill--active' : 'control-pill'} onClick={() => setAutoFailover((value) => !value)}><Icon name="refresh" size={12} /> Auto failover</button>
        <button type="button" className={healthAware ? 'control-pill control-pill--active' : 'control-pill'} onClick={() => setHealthAware((value) => !value)}><Icon name="activity" size={12} /> Health aware</button>
        <button type="button" className={boundedRetries ? 'control-pill control-pill--active' : 'control-pill'} onClick={() => setBoundedRetries((value) => !value)}><Icon name="shield" size={12} /> Bounded retry</button>
      </div>
      <div className="provider-route-simulator__result">
        <div className="provider-route-simulator__target"><span className="eyebrow">Selected route</span><strong>{decision.route.label}</strong><small>{decision.reason}</small></div>
        <div className="provider-route-simulator__routes">{routes.map((route, index) => { const chosen = route.id === decision.route.id; return <div className={chosen ? 'provider-route-simulator__route provider-route-simulator__route--selected' : 'provider-route-simulator__route'} key={route.id}><span className="provider-route-simulator__route-index">{index + 1}</span><div><strong>{route.label}</strong><small>{route.health} · {route.latency}</small></div>{chosen ? <Icon name="check-circle" size={13} /> : <Icon name="chevron-right" size={12} />}</div> })}</div>
      </div>
      <div className="provider-route-simulator__trace">{decision.trace.map((item, index) => <div className={'provider-route-simulator__trace-step provider-route-simulator__trace-step--' + item.state} key={item.label}><span>{index + 1}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div><Icon name={item.state === 'done' || item.state === 'selected' ? 'check' : item.state === 'blocked' ? 'lock' : 'clock'} size={12} /></div>)}</div>
    </section>
  )
}
