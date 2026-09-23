import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'

type ProviderTab = 'Overview' | 'Models' | 'Routing' | 'Health' | 'Quotas' | 'Accounts'

const providers = [
  { name: 'Primary Route', type: 'Gateway', health: 'Healthy', models: 12, latency: '142 ms', load: 68, quota: '68%' },
  { name: 'Fallback Route', type: 'Gateway', health: 'Healthy', models: 7, latency: '188 ms', load: 41, quota: '41%' },
  { name: 'Local Route', type: 'Local', health: 'Degraded', models: 4, latency: 'On demand', load: 22, quota: '—' },
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

export default function ProviderStudio({ onAction }: { onAction: (message: string) => void }) {
  const [tab, setTab] = useState<ProviderTab>('Overview')
  const [selected, setSelected] = useState(providers[0].name)
  const [query, setQuery] = useState('')
  const [compare, setCompare] = useState<string[]>([])
  const [selectedAccount, setSelectedAccount] = useState<(typeof accounts)[number][0]>(accounts[0][0])
  const [maskMetadata, setMaskMetadata] = useState(true)
  const [endpoint, setEndpoint] = useState('https://api.openai-compatible.local/v1')
  const [modelInput, setModelInput] = useState('qwen3-coder, gpt-oss-120b')
  const [tools, setTools] = useState(true)
  const [vision, setVision] = useState(true)

  const provider = providers.find((item) => item.name === selected) ?? providers[0]
  const visibleModels = useMemo(() => models.filter((model) => !query || model.join(' ').toLowerCase().includes(query.toLowerCase())), [query])

  function toggleCompare(name: string) {
    setCompare((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current.slice(-2), name])
  }

  return (
    <div className="provider-studio">
      <aside className="provider-studio__sidebar">
        <div className="provider-studio__sidebar-head"><span>Routes</span><span className="count-pill">{providers.length}</span></div>
        {providers.map((item) => <button type="button" key={item.name} className={selected === item.name ? 'provider-studio__route provider-studio__route--active' : 'provider-studio__route'} onClick={() => setSelected(item.name)}><div className="provider-studio__route-icon"><Icon name="bot" size={14} /></div><div><strong>{item.name}</strong><small>{item.type} · {item.models} models</small></div><span className="status-dot status-dot--live" /></button>)}
        <button className="studio-button" type="button" onClick={() => onAction('Provider route creation opened in preview')}><Icon name="plus" size={13} /> Add route</button>
      </aside>

      <section className="provider-studio__main">
        <div className="provider-studio__head">
          <div><span className="eyebrow">{provider.type}</span><h2>{provider.name}</h2><small>{provider.health} · {provider.models} models · {provider.latency}</small></div>
          <div className="provider-studio__actions"><button className="studio-button" type="button" onClick={() => onAction('Provider test started in preview')}><Icon name="play" size={13} /> Test</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Provider configuration opened in preview')}><Icon name="settings" size={13} /> Configure</button></div>
        </div>

        <div className="provider-studio__tabs" role="tablist" aria-label="Provider details">
          {(['Overview', 'Models', 'Routing', 'Health', 'Quotas', 'Accounts'] as ProviderTab[]).map((item) => <button type="button" key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'provider-studio__tab provider-studio__tab--active' : 'provider-studio__tab'} onClick={() => setTab(item)}>{item}</button>)}
        </div>

        <div className="provider-studio__content">
          {tab === 'Overview' && <div className="provider-overview"><div className="provider-overview__hero"><div><span>Current health</span><strong>{provider.health}</strong><small>Runtime-owned when connected; preview state shown here.</small></div><div className="provider-health-ring"><span>{provider.load}%</span></div></div><div className="provider-stat-grid"><Metric label="Models" value={String(provider.models)} /><Metric label="Latency" value={provider.latency} /><Metric label="Load" value={String(provider.load) + '%'} /><Metric label="Quota" value={provider.quota} /></div><div className="provider-cap-grid"><Tag label="failover" /><Tag label="health check" /><Tag label="model catalog" /><Tag label="quota aware" /><Tag label="streaming" /><Tag label="vision capable" /></div><div className="provider-endpoint"><div><span className="eyebrow">OpenAI-compatible endpoint</span><strong>Connection profile</strong><small>Custom gateways, llama.cpp, LM Studio, vLLM or compatible remote endpoints can be represented here.</small></div><label>Base URL<input value={endpoint} onChange={e=>setEndpoint(e.target.value)} aria-label="Provider base URL"/></label><label>Models<input value={modelInput} onChange={e=>setModelInput(e.target.value)} aria-label="Provider models"/></label><div className="provider-endpoint__toggles"><button type="button" className={tools?'studio-button studio-button--active':'studio-button'} aria-pressed={tools} onClick={()=>setTools(v=>!v)}>Tools {tools?'on':'off'}</button><button type="button" className={vision?'studio-button studio-button--active':'studio-button'} aria-pressed={vision} onClick={()=>setVision(v=>!v)}>Vision {vision?'on':'off'}</button></div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>onAction('Model discovery staged for '+endpoint)}>Discover models</button><button className="studio-button studio-button--active" type="button" onClick={()=>onAction('Endpoint connection test staged in preview')}>Test endpoint</button></div></div></div>}

          {tab === 'Models' && <div className="provider-models"><div className="provider-model-toolbar"><span className="eyebrow">Model registry · {tools?'tools':'text only'} · {vision?'vision':'no vision'}</span><input className="mini-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search models…" /><span className="mono-text">{compare.length}/3 compare slots</span></div>{visibleModels.map(([name, category, context, speed, route]) => <div className="provider-model-row" key={name}><div><strong>{name}</strong><span>{category} · {route}</span></div><span className="mono-text">{context}</span><span>{speed}</span><button className={compare.includes(name) ? 'studio-button studio-button--active' : 'studio-button'} type="button" onClick={() => toggleCompare(name)}>Compare</button></div>)}{compare.length > 0 && <div className="provider-compare-strip">{compare.map((name) => <span key={name}>{name}<button type="button" onClick={() => toggleCompare(name)} aria-label={'Remove ' + name}>×</button></span>)}</div>}</div>}

          {tab === 'Routing' && <div className="provider-routing-list">{routingRules.map(([task, model, order, policy]) => <div className="provider-routing-row" key={task}><div><strong>{task}</strong><small>{policy}</small></div><span className="mono-text">{model}</span><span>{order}</span><button className="icon-button" type="button" title="Edit route" onClick={() => onAction(task + ' routing opened in preview')}><Icon name="chevron-right" size={13} /></button></div>)}</div>}

          {tab === 'Health' && <div className="provider-health-grid"><MetricCard label="Success rate" value="99.2%" sub="312 requests preview" /><MetricCard label="P95 latency" value="428 ms" sub="rolling window" /><MetricCard label="Retries" value="7" sub="bounded retry policy" /><MetricCard label="Circuit" value="Closed" sub="healthy state" /><div className="provider-health-chart">{[34,49,42,65,51,77,60,83,67,91,72,80].map((height, index) => <i key={index} style={{ height: height + '%' }} />)}</div></div>}

          {tab === 'Quotas' && <div className="provider-quota-grid"><MetricCard label="Daily budget" value="68%" sub="regenerating preview quota" /><MetricCard label="Monthly budget" value="41%" sub="shared account preview" /><MetricCard label="Requests" value="2,184" sub="rolling period" /><MetricCard label="Tokens" value="3.2M" sub="input + output preview" /><div className="provider-quota-bars">{[['Primary',68],['Fallback',41],['Local',22]].map(([name, value]) => <div key={name}><span>{name}</span><div className="progress"><span style={{ width: value + '%' }} /></div><small>{value}%</small></div>)}</div></div>}

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
