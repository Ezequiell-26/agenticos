import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'

type CapabilityState = 'Available' | 'Requires setup' | 'Unavailable' | 'Disabled'
interface Capability {
  id: string
  label: string
  group: string
  state: CapabilityState
  detail: string
  latency: string
}

const initial: Capability[] = [
  { id: 'models', label: 'Multi-provider models', group: 'AI', state: 'Available', detail: 'Primary, fast and auxiliary model routing.', latency: 'Instant' },
  { id: 'vision', label: 'Vision', group: 'AI', state: 'Available', detail: 'Image understanding and visual context.', latency: 'Runtime' },
  { id: 'tools', label: 'Tool execution', group: 'Execution', state: 'Available', detail: 'Typed tools with policy boundaries.', latency: 'Runtime' },
  { id: 'terminal', label: 'Terminal', group: 'Execution', state: 'Available', detail: 'Local and remote execution backends.', latency: 'Runtime' },
  { id: 'browser', label: 'Browser agent', group: 'Web', state: 'Available', detail: 'Interactive browser and DevTools workflows.', latency: 'Runtime' },
  { id: 'mcp', label: 'MCP', group: 'Integrations', state: 'Available', detail: 'External servers, tools and resources.', latency: 'Runtime' },
  { id: 'cloud', label: 'Cloud agents', group: 'Execution', state: 'Requires setup', detail: 'Remote isolated workspaces and background agents.', latency: 'Remote' },
  { id: 'remote', label: 'Remote control', group: 'Integrations', state: 'Requires setup', detail: 'Continue sessions from another device.', latency: 'Remote' },
  { id: 'tts', label: 'TTS', group: 'Media', state: 'Available', detail: 'Text-to-speech voice responses.', latency: 'Runtime' },
  { id: 'stt', label: 'STT', group: 'Media', state: 'Unavailable', detail: 'No speech-to-text provider configured.', latency: '—' },
  { id: 'image', label: 'Image generation', group: 'Media', state: 'Available', detail: 'Image generation provider boundary.', latency: 'Runtime' },
  { id: 'docker', label: 'Docker sandbox', group: 'Execution', state: 'Requires setup', detail: 'Isolated container execution.', latency: 'Local' },
]

const groups = ['All', 'AI', 'Execution', 'Web', 'Integrations', 'Media']

export default function CapabilityRegistry() {
  const [items] = useState(initial)
  const [group, setGroup] = useState('All')
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return items.filter((item) => (group === 'All' || item.group === group) && (!term || [item.label, item.group, item.detail].join(' ').toLowerCase().includes(term)))
  }, [group, items, query])

  const counts = items.reduce<Record<CapabilityState, number>>((acc, item) => ({ ...acc, [item.state]: (acc[item.state] ?? 0) + 1 }), { Available: 0, 'Requires setup': 0, Unavailable: 0, Disabled: 0 })

  return (
    <div className="capability-registry">
      <div className="capability-summary">{(['Available','Requires setup','Unavailable','Disabled'] as CapabilityState[]).map((state) => <div key={state}><small>{state}</small><strong>{counts[state]}</strong></div>)}</div>
      <div className="capability-toolbar"><label className="control-center-search"><Icon name="search" size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search capabilities…" /></label><div className="customize-manager__filters">{groups.map((item) => <button type="button" key={item} className={group === item ? 'customize-filter customize-filter--active' : 'customize-filter'} onClick={() => setGroup(item)}>{item}</button>)}</div></div>
      <div className="capability-list">{visible.map((item) => <div className="capability-row" key={item.id}><span className="customize-row__icon"><Icon name={item.group === 'AI' ? 'bot' : item.group === 'Execution' ? 'terminal' : item.group === 'Web' ? 'globe' : item.group === 'Media' ? 'layout' : 'network'} size={13} /></span><div><strong>{item.label}</strong><small>{item.detail}</small></div><span className={`capability-pill capability-pill--${item.state.toLowerCase().replace(/\\s+/g, '-')}`}>{item.state}</span><small className="capability-latency">{item.latency}</small></div>)}</div>
    </div>
  )
}
