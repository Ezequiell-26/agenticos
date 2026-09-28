import { useEffect, useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { runtime } from '../../services/runtime'
import type { RuntimeModel, RuntimeProviderStatus } from '../../types/runtime'
import { MetricCard, Panel, Tag } from './PlatformPrimitives'
import './ModelControlCenter.css'

type Tab = 'models' | 'routing' | 'capabilities' | 'usage'

type ProviderRow = {
  id: string
  name: string
  state: 'Connected' | 'Degraded' | 'Unavailable'
  models: number
  context: string
  role: string
  load: number
}

type ModelRow = {
  id: string
  description: string
  context: string
  provider: string
  providerId: string
  capabilities: string[]
}

type UsageRow = {
  providerId: string
  provider: string
  tokens: number
  cost: number
}

const fallbackProviders: ProviderRow[] = [
  { id: 'preview-primary', name: 'OpenAI-compatible', state: 'Connected', models: 0, context: '—', role: 'primary', load: 0 },
  { id: 'preview-local', name: 'Local / Ollama', state: 'Connected', models: 0, context: '—', role: 'local', load: 0 },
]

const fallbackModels: ModelRow[] = [
  { id: 'preview-model', description: 'Runtime model catalog unavailable', context: '—', provider: 'Connect a provider', providerId: '', capabilities: [] },
]

function contextLabel(windowSize?: number | null): string {
  if (!windowSize || windowSize <= 0) return '—'
  if (windowSize >= 1_000_000) return `${Math.round(windowSize / 1_000_000)}M`
  if (windowSize >= 1_000) return `${Math.round(windowSize / 1_000)}k`
  return String(windowSize)
}

function providerRows(providers: RuntimeProviderStatus[]): ProviderRow[] {
  return providers.map((provider) => {
    const load = provider.requests_per_minute && provider.requests_per_minute > 0
      ? Math.min(100, Math.round((provider.requests_used / provider.requests_per_minute) * 100))
      : 0
    const state: ProviderRow['state'] = provider.configured
      ? provider.health === 'Healthy'
        ? 'Connected'
        : 'Degraded'
      : 'Unavailable'
    return {
      id: provider.provider_id,
      name: provider.name || provider.provider_id,
      state,
      models: provider.models.length,
      context: 'Runtime',
      role: load >= 80 ? 'high load' : provider.configured ? 'connected' : 'setup',
      load,
    }
  })
}

function modelRows(models: RuntimeModel[]): ModelRow[] {
  return models.map((model) => ({
    id: model.model_id,
    description: model.name || model.model_id,
    context: contextLabel(model.context_window),
    provider: model.provider_id,
    providerId: model.provider_id,
    capabilities: model.capabilities,
  }))
}

export function ModelControlCenter({ onAction }: { onAction: (message: string) => void }) {
  const [tab, setTab] = useState<Tab>('models')
  const [providers, setProviders] = useState<ProviderRow[]>(fallbackProviders)
  const [models, setModels] = useState<ModelRow[]>(fallbackModels)
  const [providerId, setProviderId] = useState(fallbackProviders[0].id)
  const [selected, setSelected] = useState(fallbackModels[0].id)
  const [filter, setFilter] = useState('')
  const [fallback, setFallback] = useState(true)
  const [fallbackProvidersLive, setFallbackProvidersLive] = useState<string[]>([])
  const [usage, setUsage] = useState<UsageRow[]>([])
  const [usageCost, setUsageCost] = useState(0)
  const [syncing, setSyncing] = useState(true)
  const [policySyncing, setPolicySyncing] = useState(false)

  const visibleModels = useMemo(
    () => models.filter((model) => !filter || `${model.id} ${model.description} ${model.provider} ${model.capabilities.join(' ')}`.toLowerCase().includes(filter.toLowerCase())),
    [models, filter],
  )
  const active = models.find((model) => model.id === selected) ?? visibleModels[0] ?? models[0]
  const activeProvider = providers.find((provider) => provider.id === providerId) ?? providers[0]

  const refreshCatalog = async () => {
    const [providerResult, modelResult] = await Promise.allSettled([
      runtime.providers.list(),
      runtime.models.list(),
    ])

    if (providerResult.status === 'fulfilled' && providerResult.value.length > 0) {
      const mapped = providerRows(providerResult.value)
      setProviders(mapped)
      setProviderId((current) => mapped.some((provider) => provider.id === current) ? current : mapped[0].id)
    }

    if (modelResult.status === 'fulfilled' && modelResult.value.length > 0) {
      const mapped = modelRows(modelResult.value)
      setModels(mapped)
      setSelected((current) => mapped.some((model) => model.id === current) ? current : mapped[0].id)
    }
  }

  useEffect(() => {
    let cancelled = false
    void refreshCatalog().finally(() => {
      if (!cancelled) setSyncing(false)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!activeProvider?.id) return
    let cancelled = false
    setPolicySyncing(true)
    void runtime.providers.fallback(activeProvider.id)
      .then((config) => {
        if (cancelled) return
        setFallback(Boolean(config.auto_failover))
        setFallbackProvidersLive(config.fallback_providers)
      })
      .catch(() => {
        if (!cancelled) {
          setFallbackProvidersLive([])
          setFallback(true)
        }
      })
      .finally(() => {
        if (!cancelled) setPolicySyncing(false)
      })
    return () => { cancelled = true }
  }, [activeProvider?.id])

  useEffect(() => {
    if (tab !== 'usage') return
    let cancelled = false
    void Promise.allSettled([runtime.usage.summary(), runtime.usage.records()]).then(([summary, records]) => {
      if (cancelled) return
      if (summary.status === 'fulfilled') {
        const tokens = typeof summary.value.tokens === 'number' ? summary.value.tokens : 0
        const cost = typeof summary.value.cost_usd === 'number' ? summary.value.cost_usd : 0
        setUsageCost(cost)
        if (tokens > 0 && usage.length === 0) {
          setUsage([{ providerId: 'aggregate', provider: 'All providers', tokens, cost }])
        }
      }
      if (records.status === 'fulfilled') {
        const grouped = new Map<string, UsageRow>()
        for (const record of records.value) {
          const provider = typeof record.provider_id === 'string' ? record.provider_id : 'unknown'
          const model = typeof record.model_id === 'string' ? record.model_id : 'unknown'
          const tokens = typeof record.tokens_used === 'number' ? record.tokens_used : 0
          const cost = typeof record.cost_usd === 'number' ? record.cost_usd : 0
          const current = grouped.get(provider)
          grouped.set(provider, {
            providerId: provider,
            provider: provider,
            tokens: (current?.tokens ?? 0) + tokens,
            cost: (current?.cost ?? 0) + cost,
          })
          void model
        }
        setUsage([...grouped.values()])
      }
    })
    return () => { cancelled = true }
  }, [tab])

  async function toggleFallback() {
    if (!activeProvider?.id || policySyncing) return
    const next = !fallback
    setPolicySyncing(true)
    try {
      const nextConfig = await runtime.providers.setFallback(activeProvider.id, {
        fallback_providers: fallbackProvidersLive,
        auto_failover: next,
      })
      setFallback(Boolean(nextConfig.auto_failover))
      setFallbackProvidersLive(nextConfig.fallback_providers)
      onAction(`${activeProvider.name}: automatic failover ${nextConfig.auto_failover ? 'enabled' : 'disabled'}`)
    } catch (error) {
      onAction(error instanceof Error ? error.message : 'Fallback policy update failed')
    } finally {
      setPolicySyncing(false)
    }
  }

  async function refresh() {
    setSyncing(true)
    try {
      await refreshCatalog()
      if (activeProvider?.id) {
        const next = await runtime.providers.fallback(activeProvider.id)
        setFallback(Boolean(next.auto_failover))
        setFallbackProvidersLive(next.fallback_providers)
      }
      onAction('Model and provider catalog refreshed from runtime')
    } catch (error) {
      onAction(error instanceof Error ? error.message : 'Runtime catalog refresh failed')
    } finally {
      setSyncing(false)
    }
  }

  const highestContext = models.reduce((max, model) => {
    const match = /^([0-9]+)([kM])$/.exec(model.context)
    if (!match) return max
    const factor = match[2] === 'M' ? 1_000_000 : 1_000
    return Math.max(max, Number(match[1]) * factor)
  }, 0)

  return <div className="model-control">
    <header className="model-control__hero">
      <div>
        <span className="eyebrow">Model plane</span>
        <h1>Provider & Model Control Center</h1>
        <p>Centralize provider accounts, model inventory, routing policy, fallback behavior, capabilities and usage around the live runtime.</p>
      </div>
      <div className="model-control__actions">
        <Tag label={syncing ? 'Syncing' : 'Runtime-backed'} />
        <button className={fallback ? 'studio-button studio-button--active' : 'studio-button'} type="button" disabled={policySyncing || !activeProvider?.id} onClick={() => void toggleFallback()}>
          <Icon name="shield" size={13} />{policySyncing ? 'Syncing…' : fallback ? 'Fallback armed' : 'Fallback off'}
        </button>
        <button className="studio-button studio-button--active" type="button" disabled={syncing} onClick={() => void refresh()}>
          <Icon name="refresh" size={13} /> Refresh
        </button>
      </div>
    </header>

    <div className="platform-metrics">
      <MetricCard label="Providers" value={String(providers.length)} sub={`${providers.filter((provider) => provider.state === 'Connected').length} connected`} />
      <MetricCard label="Models" value={String(models.length)} sub="Live runtime catalog" />
      <MetricCard label="Routes" value={String(fallbackProvidersLive.length + (activeProvider ? 1 : 0))} sub={fallback ? 'Automatic failover enabled' : 'Automatic failover disabled'} />
      <MetricCard label="Context" value={highestContext > 0 ? contextLabel(highestContext) : '—'} sub="Highest reported model context" />
    </div>

    <div className="model-control__tabs">
      {(['models', 'routing', 'capabilities', 'usage'] as Tab[]).map((item) => (
        <button key={item} className={tab === item ? 'model-tab model-tab--active' : 'model-tab'} type="button" onClick={() => setTab(item)}>{item}</button>
      ))}
    </div>

    {tab === 'models' && <div className="model-control__layout">
      <Panel title="Providers">
        <div className="provider-list">
          {providers.map((item) => <button key={item.id} type="button" className={providerId === item.id ? 'provider-row provider-row--active' : 'provider-row'} onClick={() => setProviderId(item.id)}>
            <span className="provider-dot"><Icon name={item.state === 'Connected' ? 'check' : 'network'} size={12} /></span>
            <span><strong>{item.name}</strong><small>{item.models} models · {item.role}</small></span>
            <Tag label={item.state} />
          </button>)}
        </div>
        <div className="platform-actions">
          <button className="studio-button" type="button" onClick={() => onAction('Use ProviderStudio to register a new provider with runtime credentials')}>Add provider</button>
          <button className="studio-button" type="button" onClick={() => onAction('CredentialManager is the runtime credential control surface')}>Credentials</button>
        </div>
      </Panel>

      <Panel title={activeProvider?.name ?? 'Models'}>
        <div className="model-search"><Icon name="search" size={12} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter models…" aria-label="Filter models" /></div>
        <div className="model-list">
          {visibleModels.filter((model) => !providerId || model.providerId === providerId || models.length === 1).map((model) => <button key={model.id} type="button" className={selected === model.id ? 'model-row model-row--active' : 'model-row'} onClick={() => setSelected(model.id)}>
            <span><strong>{model.id}</strong><small>{model.description} · {model.context} context</small></span>
            <span>{model.provider}</span>
            <Tag label={model.capabilities.length ? model.capabilities[0] : 'Runtime'} />
          </button>)}
        </div>
        {visibleModels.filter((model) => !providerId || model.providerId === providerId || models.length === 1).length === 0 && <div className="callout"><Icon name="info" size={13} /><span>No models were reported by the selected runtime provider.</span></div>}
      </Panel>
    </div>}

    {tab === 'routing' && <div className="model-control__routing">
      <Panel title="Runtime route policy">
        <div className="route-table">
          <div><span><strong>Primary provider</strong><small>Current runtime provider selection.</small></span><code>{activeProvider?.id ?? '—'}</code><Tag label={activeProvider?.state ?? 'Unavailable'} /><span /></div>
          {(fallbackProvidersLive.length > 0 ? fallbackProvidersLive : ['No fallback providers configured']).map((id, index) => <div key={id + index}><span><strong>Fallback {index + 1}</strong><small>Persisted provider fallback route.</small></span><code>{id}</code><Tag label={fallback ? 'Eligible' : 'Standby'} /><span /></div>)}
        </div>
        <div className="platform-actions">
          <button className="studio-button" type="button" onClick={() => void refresh()}><Icon name="refresh" size={13} /> Refresh routing</button>
          <button className="studio-button studio-button--active" type="button" onClick={() => onAction('Routing simulation remains a local preview and does not send provider traffic')}>Simulate</button>
        </div>
      </Panel>
      <Panel title="Fallback strategy">
        <div className="fallback-stack">
          <div><span>Primary unavailable</span><strong>{fallback ? 'Select configured fallback' : 'Stop execution'}</strong></div>
          <div><span>Rate limited</span><strong>{fallback ? 'Cooldown → alternate provider' : 'Stop execution'}</strong></div>
          <div><span>Context too large</span><strong>Compact → compatible model</strong></div>
          <div><span>Tool incompatibility</span><strong>Capability match → alternate</strong></div>
          <div><span>Provider error</span><strong>Preserve evidence → bounded retry</strong></div>
        </div>
      </Panel>
    </div>}

    {tab === 'capabilities' && <div className="model-control__layout">
      <Panel title={active?.id ?? 'Model'}>
        <div className="model-identity">
          <span className="eyebrow">{active?.provider ?? 'Runtime'}</span>
          <h2>{active?.id ?? 'No model selected'}</h2>
          <p>Capabilities below are reported by the provider adapter; no presentation-side capability inference is performed.</p>
        </div>
        <div className="capability-grid">
          {active?.capabilities.length ? active.capabilities.map((capability) => <div key={capability}><span>{capability}</span><strong>Reported</strong></div>) : <div><span>Capabilities</span><strong>Not reported</strong></div>}
        </div>
      </Panel>
      <Panel title="Selection policy">
        {['Task intent', 'Context limit', 'Tool compatibility', 'Vision requirement', 'Latency budget', 'Cost/quota', 'Provider health'].map((item) => <div className="selection-policy" key={item}><div><Icon name="check" size={11} /><span>{item}</span><Tag label="runtime evaluated" /></div></div>)}
      </Panel>
    </div>}

    {tab === 'usage' && <div className="model-control__usage">
      <Panel title="Provider usage">
        <div className="usage-rows">
          {(usage.length ? usage : [{ providerId: 'aggregate', provider: 'No recorded usage', tokens: 0, cost: usageCost }]).map((row) => <div key={row.providerId}><span><strong>{row.provider}</strong><small>{row.tokens.toLocaleString()} tokens</small></span><b>{row.cost ? `$${row.cost.toFixed(4)}` : '—'}</b><div className="usage-bar"><i style={{ width: `${Math.min(100, Math.round((row.tokens / Math.max(1, usage.reduce((sum, item) => sum + item.tokens, 0))) * 100))}%` }} /></div></div>)}
        </div>
      </Panel>
      <Panel title="Budget / cost">
        <div className="budget-guards">
          <div><span>Recorded tokens</span><strong>{usage.reduce((sum, item) => sum + item.tokens, 0).toLocaleString()}</strong></div>
          <div><span>Recorded cost</span><strong>{usageCost ? `$${usageCost.toFixed(4)}` : '$0.0000'}</strong></div>
          <div><span>Providers with usage</span><strong>{String(usage.length)}</strong></div>
          <div><span>Runtime source</span><strong>Authoritative</strong></div>
        </div>
        <div className="platform-actions"><button className="studio-button studio-button--active" type="button" onClick={() => void runtime.usage.records().then(() => onAction('Usage records refreshed from runtime')).catch((error) => onAction(error instanceof Error ? error.message : 'Usage refresh failed'))}>Refresh usage</button></div>
      </Panel>
    </div>}

    <div className="model-control__guard">
      <Icon name="shield" size={13} />
      <span>Provider credentials stay outside this presentation surface. Catalog, health, fallback and usage data shown here come from the runtime whenever available.</span>
    </div>
  </div>
}
