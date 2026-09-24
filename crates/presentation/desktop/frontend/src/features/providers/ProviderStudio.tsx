import { useEffect, useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import ProviderAcceptanceBoard from './ProviderAcceptanceBoard'
import ProviderCapabilityMatrix from './ProviderCapabilityMatrix'
import ProviderEvidenceLedger from './ProviderEvidenceLedger'
import ProviderRouteSimulator from './ProviderRouteSimulator'
import './ProviderResilience.css'
import { runtime } from '../../services/runtime'

type ProviderTab = 'Overview' | 'Models' | 'Routing' | 'Health' | 'Resilience' | 'Verification' | 'Quotas' | 'Accounts'

const providers = [
  { id: 'primary-route', name: 'Primary Route', type: 'Gateway', health: 'Healthy', models: 12, latency: '142 ms', load: 68, quota: '68%' },
  { id: 'fallback-route', name: 'Fallback Route', type: 'Gateway', health: 'Healthy', models: 7, latency: '188 ms', load: 41, quota: '41%' },
  { id: 'local-route', name: 'Local Route', type: 'Local', health: 'Degraded', models: 4, latency: 'On demand', load: 22, quota: '—' },
]

const models = [
  ['gpt-oss-120b', 'General', '128k', 'Fast', 'Primary Route'],
  ['qwen3-coder', 'Code', '256k', 'High', 'Primary Route'],
  ['deepseek-chat', 'Reasoning', '64k', 'High', 'Fallback Route'],
  ['llama-4-maverick', 'Vision', '128k', 'Medium', 'Fallback Route'],
  ['gemma-3-27b', 'General', '128k', 'Fast', 'Fallback Route'],
  ['local-qwen', 'Local', '32k', 'On demand', 'Local Route'],
]

const accounts = [
  ['OpenAI', 'Primary API account', 'API key · stored externally', 'Configured', '12 models', 'Daily 68%', 'Primary'],
  ['Google', 'Secondary provider', 'API key · stored externally', 'Configured', '8 models', 'Daily 41%', 'Fallback'],
  ['Groq', 'Fast inference account', 'API key · stored externally', 'Configured', '6 models', 'Daily 22%', 'Fallback'],
  ['Local runtime', 'Workstation inference', 'No secret', 'Ready', '4 models', 'No quota', 'Local'],
] as const

const routingRules = [
  ['Code tasks', 'qwen3-coder', 'Primary → Fallback', 'High confidence'],
  ['Research', 'deepseek-chat', 'Fallback → Primary', 'Evidence mode'],
  ['Vision', 'llama-4-maverick', 'Fallback only', 'Multimodal'],
  ['Default', 'Auto route', 'Primary → Fallback → Local', 'Balanced'],
]

const resilienceScenarios = [
  { id: 'R-01', name: 'Primary timeout', trigger: 'No response within latency budget', policy: 'Retry → alternate healthy route', state: 'Ready' },
  { id: 'R-02', name: 'Rate limit', trigger: 'Provider quota response', policy: 'Cooldown → fallback route', state: 'Ready' },
  { id: 'R-03', name: 'Context overflow', trigger: 'Requested context exceeds model limit', policy: 'Compact → compatible route', state: 'Guarded' },
  { id: 'R-04', name: 'Tool incompatibility', trigger: 'Selected model rejects required tool', policy: 'Capability match → alternate', state: 'Ready' },
  { id: 'R-05', name: 'Provider outage', trigger: 'Health check fails repeatedly', policy: 'Circuit open → preserve evidence', state: 'Guarded' },
] as const

export default function ProviderStudio({ onAction }: { onAction: (message: string) => void }) {
  const [tab, setTab] = useState<ProviderTab>('Overview')
  const [liveProviders, setLiveProviders] = useState(providers)
  const [liveModels, setLiveModels] = useState(models)
  const [selected, setSelected] = useState<string>(providers[0].name)
  const [query, setQuery] = useState('')
  const [compare, setCompare] = useState<string[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>(accounts[0][0])
  const [maskMetadata, setMaskMetadata] = useState(true)
  const [selectedScenario, setSelectedScenario] = useState<string>(resilienceScenarios[0].id)
  const [scenarioResults, setScenarioResults] = useState<Record<string, 'Passed' | 'Pending' | 'Blocked'>>({})
  const [verificationFilter, setVerificationFilter] = useState<'All' | 'Ready' | 'Attention'>('All')
  const [verificationResults, setVerificationResults] = useState<Record<string, 'Passed' | 'Pending' | 'Needs review'>>({})
  const [healthWindow, setHealthWindow] = useState<'15m' | '1h' | '24h'>('1h')
  const [resiliencePolicy, setResiliencePolicy] = useState({
    autoFailover: true,
    healthBased: true,
    circuitBreaker: true,
    boundedRetries: true,
    maxAttempts: 3,
    cooldownMs: 5000,
  })

  const provider = liveProviders.find((item) => item.name === selected) ?? liveProviders[0]
  const visibleModels = useMemo(() => liveModels.filter((model) => !query || model.join(' ').toLowerCase().includes(query.toLowerCase())), [liveModels, query])

  useEffect(() => {
    let cancelled = false
    void runtime.providers.list().then((remoteProviders) => {
      if (cancelled || remoteProviders.length === 0) return
      const mapped = remoteProviders.map((item, index) => ({
        id: item.provider_id,
        name: item.name || item.provider_id,
        type: item.provider_id === 'local' || item.name.toLowerCase().includes('local') ? 'Local' : 'Gateway',
        health: item.health === 'Healthy' ? 'Healthy' : item.health === 'Degraded' ? 'Degraded' : item.health === 'Unhealthy' ? 'Unhealthy' : 'Unknown',
        models: item.models.length,
        latency: 'Runtime',
        load: item.requests_per_minute ? Math.min(100, Math.round((item.requests_used / item.requests_per_minute) * 100)) : 0,
        quota: item.requests_per_minute ? `${Math.min(100, Math.round((item.requests_used / item.requests_per_minute) * 100))}%` : '—',
      }))
      setLiveProviders(mapped)
      setSelected((current) => mapped.some((item) => item.name === current) ? current : mapped[0].name)
      const first = mapped[0]
      void loadProviderModels(first?.id)
    }).catch(() => {
      // Static catalog stays available when the local runtime has not started.
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const current = liveProviders.find((item) => item.name === selected)
    if (current) void loadProviderModels(current.id)
  }, [liveProviders, selected])

  async function loadProviderModels(providerId?: string) {
    if (!providerId) return
    try {
      const remoteModels = await runtime.providers.models(providerId)
      const source = remoteModels.length > 0 ? remoteModels : []
      if (source.length > 0) {
        const current = liveProviders.find((item) => item.id === providerId)
        setLiveModels(source.map((name) => [name, 'Runtime', 'Auto', 'Live', current?.name ?? providerId]))
      }
    } catch {
      // Preserve the local fallback catalog on transient runtime errors.
    }
  }

  async function testProvider() {
    try {
      const health = await runtime.providers.health(provider.id)
      setLiveProviders((current) => current.map((item) => item.id === provider.id ? { ...item, health: health.status } : item))
      onAction(`${provider.name} health: ${health.status}`)
    } catch (error) {
      onAction(error instanceof Error ? error.message : 'Provider health check failed')
    }
  }

  async function refreshProviderModels() {
    try {
      const refreshed = await runtime.providers.refreshModels(provider.id)
      if (refreshed.length > 0) setLiveModels(refreshed.map((name) => [name, 'Runtime', 'Auto', 'Live', provider.name]))
      setLiveProviders((current) => current.map((item) => item.id === provider.id ? { ...item, models: refreshed.length || item.models, health: 'Healthy' } : item))
      onAction(`${provider.name}: ${refreshed.length || 0} models available`)
    } catch (error) {
      onAction(error instanceof Error ? error.message : 'Model refresh failed')
    }
  }

  function toggleCompare(name: string) {
    setCompare((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current.slice(-2), name])
  }

  return (
    <div className="provider-studio">
      <aside className="provider-studio__sidebar">
        <div className="provider-studio__sidebar-head"><span>Routes</span><span className="count-pill">{providers.length}</span></div>
        {liveProviders.map((item) => <button type="button" key={item.id} className={selected === item.name ? 'provider-studio__route provider-studio__route--active' : 'provider-studio__route'} onClick={() => setSelected(item.name)}><div className="provider-studio__route-icon"><Icon name="bot" size={14} /></div><div><strong>{item.name}</strong><small>{item.type} · {item.models} models</small></div><span className={item.health === 'Healthy' ? 'status-dot status-dot--live' : 'status-dot status-dot--offline'} /></button>)}
        <button className="studio-button" type="button" onClick={() => onAction('Provider route creation opened in preview')}><Icon name="plus" size={13} /> Add route</button>
      </aside>

      <section className="provider-studio__main">
        <div className="provider-studio__head">
          <div><span className="eyebrow">{provider.type}</span><h2>{provider.name}</h2><small>{provider.health} · {provider.models} models · {provider.latency}</small></div>
          <div className="provider-studio__actions"><button className="studio-button" type="button" onClick={() => void testProvider()}><Icon name="play" size={13} /> Test</button><button className="studio-button studio-button--active" type="button" onClick={() => void refreshProviderModels()}><Icon name="refresh" size={13} /> Refresh models</button></div>
        </div>

        <div className="provider-studio__tabs" role="tablist" aria-label="Provider details" aria-orientation="horizontal">
          {(['Overview', 'Models', 'Routing', 'Health', 'Resilience', 'Verification', 'Quotas', 'Accounts'] as ProviderTab[]).map((item, index, tabs) => <button type="button" key={item} role="tab" id={'provider-tab-' + item.toLowerCase()} aria-controls="provider-tabpanel" aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} className={tab === item ? 'provider-studio__tab provider-studio__tab--active' : 'provider-studio__tab'} onClick={() => setTab(item)} onKeyDown={(event) => {
            const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
            if (nextIndex >= 0) { event.preventDefault(); const next = tabs[nextIndex]; setTab(next); window.requestAnimationFrame(() => document.getElementById('provider-tab-' + next.toLowerCase())?.focus()) }
          }}>{item}</button>)}
        </div>

        <div className="provider-studio__content" id="provider-tabpanel" role="tabpanel" aria-labelledby={`provider-tab-${tab.toLowerCase()}`} tabIndex={0}>
          {tab === 'Overview' && <div className="provider-overview"><div className="provider-overview__hero"><div><span>Current health</span><strong>{provider.health}</strong><small>Runtime-owned when connected; preview state shown here.</small></div><div className="provider-health-ring"><span>{provider.load}%</span></div></div><div className="provider-stat-grid"><Metric label="Models" value={String(provider.models)} /><Metric label="Latency" value={provider.latency} /><Metric label="Load" value={String(provider.load) + '%'} /><Metric label="Quota" value={provider.quota} /></div><div className="provider-cap-grid"><Tag label="failover" /><Tag label="health check" /><Tag label="model catalog" /><Tag label="quota aware" /><Tag label="streaming" /><Tag label="vision capable" /></div></div>}

          {tab === 'Models' && <div className="provider-models"><div className="provider-model-toolbar"><input className="mini-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search models…" /><span className="mono-text">{compare.length}/3 compare slots</span></div>{visibleModels.map(([name, category, context, speed, route]) => <div className="provider-model-row" key={name}><div><strong>{name}</strong><span>{category} · {route}</span></div><span className="mono-text">{context}</span><span>{speed}</span><button className={compare.includes(name) ? 'studio-button studio-button--active' : 'studio-button'} type="button" onClick={() => toggleCompare(name)}>Compare</button></div>)}{compare.length > 0 && <div className="provider-compare-strip">{compare.map((name) => <span key={name}>{name}<button type="button" onClick={() => toggleCompare(name)} aria-label={'Remove ' + name}>×</button></span>)}</div>}</div>}

          {tab === 'Routing' && <div className="provider-routing-list">{routingRules.map(([task, model, order, policy]) => <div className="provider-routing-row" key={task}><div><strong>{task}</strong><small>{policy}</small></div><span className="mono-text">{model}</span><span>{order}</span><button className="icon-button" type="button" title="Edit route" onClick={() => onAction(task + ' routing opened in preview')}><Icon name="chevron-right" size={13} /></button></div>)}</div>}

          {tab === 'Resilience' && <div className="provider-resilience">
            <div className="provider-resilience__summary">
              <div><span className="eyebrow">Failure simulation</span><strong>Resilience matrix</strong><small>Exercise failover, health-check and recovery policies without executing provider traffic.</small></div>
              <div className="provider-resilience__summary-actions">
                <button className="studio-button" type="button" onClick={() => onAction('Resilience suite queued in preview')}><Icon name="play" size={13} /> Run suite</button>
                <button className="studio-button studio-button--active" type="button" onClick={() => onAction('Resilience policy opened in preview')}><Icon name="shield" size={13} /> Policy</button>
              </div>
            </div>
            <div className="provider-resilience__metrics">
              <MetricCard label="Scenarios" value={String(resilienceScenarios.length)} sub="Declared failure modes" />
              <MetricCard label="Passed" value={String(Object.values(scenarioResults).filter((value) => value === 'Passed').length)} sub="Local preview results" />
              <MetricCard label="Pending" value={String(resilienceScenarios.filter((scenario) => !scenarioResults[scenario.id]).length)} sub="Awaiting simulation" />
              <MetricCard label="Guarded" value="2" sub="Require explicit runtime evidence" />
            </div>
            <ProviderRouteSimulator />
            <ProviderCapabilityMatrix />
            <div className="provider-resilience__grid">
              <div className="provider-resilience__scenarios">
                {resilienceScenarios.map((scenario) => {
                  const result = scenarioResults[scenario.id] ?? 'Pending'
                  return <button key={scenario.id} type="button" className={selectedScenario === scenario.id ? 'provider-resilience__row provider-resilience__row--active' : 'provider-resilience__row'} onClick={() => setSelectedScenario(scenario.id)}>
                    <span className="provider-resilience__id">{scenario.id}</span>
                    <span><strong>{scenario.name}</strong><small>{scenario.trigger}</small></span>
                    <Tag label={result} />
                  </button>
                })}
              </div>
              <div className="provider-resilience__detail">
                {(() => {
                  const scenario = resilienceScenarios.find((item) => item.id === selectedScenario) ?? resilienceScenarios[0]
                  const result = scenarioResults[scenario.id] ?? 'Pending'
                  return <>
                    <div className="provider-resilience__detail-head"><div><span className="eyebrow">{scenario.id}</span><h3>{scenario.name}</h3></div><Tag label={scenario.state} /></div>
                    <div className="provider-resilience__trigger"><span>Failure trigger</span><strong>{scenario.trigger}</strong></div>
                    <div className="provider-resilience__policy"><span>Recovery policy</span><strong>{scenario.policy}</strong></div>
                    <div className="provider-resilience__timeline">
                      {['Detect', 'Classify', 'Select fallback', 'Preserve evidence', 'Resume'].map((step, index) => <div key={step} className="provider-resilience__step"><span>{index + 1}</span><div><strong>{step}</strong><small>{result === 'Passed' || index < 2 ? 'Ready' : 'Pending'}</small></div>{result === 'Passed' || index < 2 ? <Icon name="check" size={12} /> : <span className="status-dot status-dot--offline" />}</div>)}
                    </div>
                    <div className="platform-actions">
                      <button className="studio-button" type="button" onClick={() => onAction(scenario.id + ' details opened in preview')}>Inspect evidence</button>
                      <button className="studio-button" type="button" onClick={() => setScenarioResults((current) => ({ ...current, [scenario.id]: 'Blocked' }))}>Mark guarded</button>
                      <button className="studio-button studio-button--active" type="button" onClick={() => setScenarioResults((current) => ({ ...current, [scenario.id]: 'Passed' }))}><Icon name="play" size={13} /> Simulate pass</button>
                    </div>
                    <div className="callout"><Icon name="shield" size={14} /><span>Simulation updates presentation state only. Runtime failover, circuit breaking and provider health remain backend responsibilities.</span></div>
                  </>
                })()}
              </div>
            </div>
          </div>}
          {tab === 'Verification' && <div className="provider-verification">
            <div className="provider-verification__head">
              <div><span className="eyebrow">Integration evidence</span><strong>Provider verification matrix</strong><small>Track the frontend contract for provider failover, health checks, resilience behavior and multi-provider orchestration.</small></div>
              <div className="provider-verification__controls">
                {(['All','Ready','Attention'] as const).map((filter) => <button key={filter} type="button" className={verificationFilter === filter ? 'soft-button soft-button--active' : 'soft-button'} onClick={() => setVerificationFilter(filter)}>{filter}</button>)}
                <button className="studio-button studio-button--active" type="button" onClick={() => onAction('Provider verification suite queued in preview')}><Icon name="play" size={13} /> Run suite</button>
              </div>
            </div>
            <div className="provider-verification__summary">
              <MetricCard label="Contracts" value="8" sub="Provider integration checks" />
              <MetricCard label="Passed" value={String(Object.values(verificationResults).filter((value) => value === 'Passed').length)} sub="Local preview results" />
              <MetricCard label="Needs review" value={String(Object.values(verificationResults).filter((value) => value === 'Needs review').length)} sub="Evidence required" />
              <MetricCard label="Runtime" value="Required" sub="CI / adapter evidence" />
            </div>
            <div className="provider-verification__matrix">
              {[
                ['PV-001','Provider registry + model catalog','provider_registry_and_model_catalog_compose_across_multiple_providers','Register providers/models and verify cross-provider catalog composition','Ready','registry'],
                ['PV-002','Declared failover order','provider_failover_follows_declared_order','Advance primary → fallback-a → fallback-b in declared order','Ready','failover'],
                ['PV-003','Failover disabled','auto_failover_disabled_does_not_advance_to_fallback','Keep the primary route when automatic failover is disabled','Ready','failover'],
                ['PV-004','Health-driven selection','health_check_drives_failover_selection','Skip unhealthy/degraded routes and select the healthy fallback','Attention','health'],
                ['PV-005','Resilient retry + quota','retry_policy_and_quota_state_can_be_combined_for_resilient_provider_work','Combine bounded exponential retry with quota state','Ready','resilience'],
                ['PV-006','Provider-scoped credentials','credential_pool_keeps_credentials_scoped_to_their_provider','Keep credential lookup isolated to its provider','Ready','security'],
                ['PV-007','Deterministic transport','http_model_provider_executes_against_a_deterministic_local_provider','Execute a deterministic OpenAI-compatible local test response','Ready','transport'],
                ['PV-008','Multi-provider orchestration','multi_provider_orchestration_selects_healthy_provider_and_executes_transport','Select healthy fallback, resolve model and execute transport','Ready','orchestration'],
              ].filter(([, , , , readiness]) => verificationFilter === 'All' || (verificationFilter === 'Ready' ? readiness === 'Ready' : readiness === 'Attention'))
               .map(([id,name,testName,detail,readiness,group]) => {
                 const result = verificationResults[id] ?? 'Pending'
                 return <div className="provider-verification__row" key={id}>
                   <span className="provider-verification__id">{id}</span>
                   <div><strong>{name}</strong><small>{detail} · {group}</small><code>{testName}</code></div>
                   <Tag label={readiness} />
                   <Tag label={result} />
                   <button className="studio-button" type="button" onClick={() => setVerificationResults((current) => ({ ...current, [id]: 'Passed' }))}>Simulate</button>
                   <button className="icon-button" type="button" aria-label={'Inspect evidence for ' + id} title="Inspect evidence" onClick={() => onAction(id + ' evidence opened in preview')}><Icon name="chevron-right" size={13} /></button>
                 </div>
               })}
            </div>
            <ProviderEvidenceLedger onInspect={onAction} />
            <ProviderAcceptanceBoard />
            <div className="callout"><Icon name="shield" size={14} /><span>Preview matrix only: a local simulated pass never substitutes CI, provider-adapter or live resilience evidence.</span></div>
          </div>}
          {tab === 'Health' && <div className="provider-health">
            <div className="provider-health-grid"><MetricCard label="Success rate" value="99.2%" sub="312 requests preview" /><MetricCard label="P95 latency" value="428 ms" sub="rolling window" /><MetricCard label="Retries" value="7" sub="bounded retry policy" /><MetricCard label="Circuit" value="Closed" sub="healthy state" /><div className="provider-health-chart">{[34,49,42,65,51,77,60,83,67,91,72,80].map((height, index) => <i key={index} style={{ height: height + '%' }} />)}</div></div>
            <div className="provider-health__history">
              <div className="provider-health__history-head"><div><span className="eyebrow">Health telemetry</span><strong>Check history & incidents</strong><small>Presentation-only timeline for health status transitions and diagnostic evidence.</small></div><div className="provider-health__window">{(['15m','1h','24h'] as const).map((window) => <button key={window} type="button" className={healthWindow === window ? 'soft-button soft-button--active' : 'soft-button'} onClick={() => setHealthWindow(window)}>{window}</button>)}</div></div>
              <div className="provider-health__events">
                {[
                  ['11:42','Healthy','Latency returned to baseline','health check'],
                  ['11:31','Degraded','P95 crossed configured threshold','latency guard'],
                  ['11:18','Healthy','Fallback route available','routing'],
                  ['10:57','Recovered','Primary route accepted after bounded retry','recovery'],
                  ['10:41','Warning','Quota pressure reached 70%','quota'],
                ].map(([time,status,detail,kind]) => <div className="provider-health__event" key={time + detail}><span className="provider-health__time">{time}</span><span className={status === 'Healthy' || status === 'Recovered' ? 'provider-health__status provider-health__status--ok' : 'provider-health__status provider-health__status--warn'}>{status}</span><div><strong>{detail}</strong><small>{kind} · window {healthWindow}</small></div><button className="icon-button" type="button" aria-label={'Inspect ' + detail} title="Inspect event" onClick={() => onAction('Health event opened in preview')}><Icon name="chevron-right" size={13} /></button></div>)}
              </div>
            </div>
            <div className="provider-resilience-policy">
              <div className="provider-resilience-policy__head"><div><span className="eyebrow">Policy editor</span><strong>Resilience controls</strong><small>Shape the presentation contract that the runtime adapter will enforce later.</small></div><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Resilience policy saved in preview')}><Icon name="check" size={13} /> Save policy</button></div>
              <div className="provider-resilience-policy__grid">
                {[
                  ['autoFailover','Automatic failover','Advance to the next compatible route after a bounded failure.'],
                  ['healthBased','Health-aware selection','Avoid routes that are unhealthy or degraded.'],
                  ['circuitBreaker','Circuit breaker','Stop repeatedly hitting a failing provider.'],
                  ['boundedRetries','Bounded retries','Keep retry attempts finite and evidence-aware.'],
                ].map(([key,label,detail]) => {
                  const enabled = resiliencePolicy[key as keyof typeof resiliencePolicy] as boolean
                  return <button key={key} type="button" className={enabled ? 'provider-policy-row provider-policy-row--on' : 'provider-policy-row'} onClick={() => setResiliencePolicy((current) => ({ ...current, [key]: !enabled }))}>
                    <span className="provider-policy-row__switch"><span /></span>
                    <span><strong>{label}</strong><small>{detail}</small></span>
                    <Tag label={enabled ? 'On' : 'Off'} />
                  </button>
                })}
              </div>
              <div className="provider-resilience-policy__numbers">
                <label><span>Max attempts</span><input aria-label="Maximum retry attempts" type="number" min="1" max="8" value={resiliencePolicy.maxAttempts} onChange={(event) => setResiliencePolicy((current) => ({ ...current, maxAttempts: Math.min(8, Math.max(1, Number(event.target.value) || 1)) }))} /></label>
                <label><span>Cooldown (ms)</span><input aria-label="Provider cooldown milliseconds" type="number" min="0" max="60000" step="1000" value={resiliencePolicy.cooldownMs} onChange={(event) => setResiliencePolicy((current) => ({ ...current, cooldownMs: Math.min(60000, Math.max(0, Number(event.target.value) || 0)) }))} /></label>
                <div><span>Route order</span><strong>Primary → Fallback → Local</strong></div>
              </div>
            </div>
            <div className="callout"><Icon name="shield" size={14} /><span>Live health, circuit state and incident persistence must come from the provider runtime adapter; this timeline is a UI contract preview.</span></div>
          </div>}

          {tab === 'Quotas' && (
            <div className="provider-quota-grid">
              <MetricCard label="Daily budget" value="68%" sub="regenerating preview quota" />
              <MetricCard label="Monthly budget" value="41%" sub="shared account preview" />
              <MetricCard label="Requests" value="2,184" sub="rolling period" />
              <MetricCard label="Tokens" value="3.2M" sub="input + output preview" />
              <div className="provider-quota-bars">
                {[['Primary', 68], ['Fallback', 41], ['Local', 22]].map(([name, value]) => (
                  <div key={name}>
                    <span>{name}</span>
                    <div className="progress"><span style={{ width: String(value) + '%' }} /></div>
                    <small>{value}%</small>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'Accounts' && <div className="provider-account-center">
            <div className="provider-account-toolbar">
              <div><span className="eyebrow">Connection metadata</span><strong>Accounts & credentials</strong><small>Secrets never render here; only connection state and safe metadata are presented.</small></div>
              <button className={maskMetadata ? 'studio-button studio-button--active' : 'studio-button'} type="button" onClick={() => setMaskMetadata((value) => !value)}><Icon name="lock" size={13} /> {maskMetadata ? 'Metadata protected' : 'Metadata visible'}</button>
            </div>
            <div className="provider-account-layout">
              <div className="provider-account-list">
                {accounts.map(([name, label, , state]) => <button type="button" key={name} className={selectedAccount === name ? 'provider-account-row provider-account-row--active' : 'provider-account-row'} onClick={() => setSelectedAccount(name)}>
                  <span className="provider-account-icon"><Icon name={name === 'Local runtime' ? 'terminal' : 'network'} size={14} /></span>
                  <span><strong>{name}</strong><small>{label}</small></span>
                  <span className={state === 'Configured' || state === 'Ready' ? 'state-pill state-pill--completed' : 'state-pill state-pill--pending'}>{state}</span>
                </button>)}
                <button className="studio-button studio-button--active" type="button" onClick={() => onAction('Add provider account opened in preview')}><Icon name="plus" size={13} /> Add account</button>
              </div>
              <div className="provider-account-detail">
                <div className="provider-account-detail__head"><div><span className="eyebrow">{accounts.find((item) => item[0] === selectedAccount)?.[6] ?? 'Route'}</span><h3>{selectedAccount}</h3></div><span className="status-dot status-dot--live" /></div>
                <div className="provider-account-meta">
                  {(() => {
                    const account = accounts.find((item) => item[0] === selectedAccount) ?? accounts[0]
                    return <>
                      <Metric label="Connection" value={account[3]} />
                      <Metric label="Auth" value={account[2].split(' · ')[0]} />
                      <Metric label="Models" value={account[4]} />
                      <Metric label="Quota" value={account[5]} />
                      <Metric label="Secret" value={maskMetadata ? '••••••••' : 'Stored externally'} />
                      <Metric label="Routing role" value={account[6]} />
                    </>
                  })()}
                </div>
                <div className="provider-account-capabilities"><Tag label="chat" /><Tag label="tools" /><Tag label="streaming" /><Tag label="fallback-aware" /><Tag label="quota-aware" /></div>
                <div className="platform-actions">
                  <button className="studio-button" type="button" onClick={() => onAction(selectedAccount + ' connection test staged in preview')}><Icon name="play" size={13} /> Test connection</button>
                  <button className="studio-button" type="button" onClick={() => onAction(selectedAccount + ' model catalog refresh staged')}><Icon name="refresh" size={13} /> Refresh models</button>
                  <button className="studio-button studio-button--active" type="button" onClick={() => onAction(selectedAccount + ' routing opened in preview')}><Icon name="settings" size={13} /> Routing</button>
                </div>
                <div className="callout"><Icon name="shield" size={14} /><span>Presentation boundary: credentials, OAuth tokens and provider transport stay outside React state.</span></div>
              </div>
            </div>
          </div>}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="provider-metric-card"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>
}

function Tag({ label }: { label: string }) {
  return <span className="platform-tag">{label}</span>
}
