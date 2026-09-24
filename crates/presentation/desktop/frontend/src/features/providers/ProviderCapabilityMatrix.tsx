import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'

type Capability = 'Tools' | 'Vision' | 'Streaming' | 'Structured' | 'Long context'
const rows = [
  ['gpt-oss-120b', 'Primary', { Tools: true, Vision: false, Streaming: true, Structured: true, 'Long context': true }],
  ['qwen3-coder', 'Primary', { Tools: true, Vision: false, Streaming: true, Structured: true, 'Long context': true }],
  ['deepseek-chat', 'Fallback', { Tools: true, Vision: false, Streaming: true, Structured: true, 'Long context': false }],
  ['llama-4-maverick', 'Fallback', { Tools: true, Vision: true, Streaming: true, Structured: true, 'Long context': true }],
  ['local-qwen', 'Local', { Tools: true, Vision: false, Streaming: true, Structured: true, 'Long context': false }],
] as const
const capabilities: Capability[] = ['Tools', 'Vision', 'Streaming', 'Structured', 'Long context']

export default function ProviderCapabilityMatrix() {
  const [required, setRequired] = useState<Capability>('Tools')
  const visible = useMemo(() => rows.filter(([, , map]) => map[required]), [required])
  return (
    <section className="provider-capability-matrix" aria-labelledby="provider-capability-matrix-title">
      <div className="provider-capability-matrix__head"><div><span className="eyebrow">Compatibility contract</span><h3 id="provider-capability-matrix-title">Capability matrix</h3><small>Preview which catalog entries can satisfy a selected runtime requirement.</small></div><label><span>Required capability</span><select value={required} onChange={(event) => setRequired(event.target.value as Capability)}>{capabilities.map((capability) => <option key={capability}>{capability}</option>)}</select></label></div>
      <div className="provider-capability-matrix__table" role="table" aria-label="Provider model capability compatibility"><div className="provider-capability-matrix__row provider-capability-matrix__row--head" role="row"><strong role="columnheader">Model</strong><strong role="columnheader">Route</strong>{capabilities.map((capability) => <strong key={capability} role="columnheader">{capability}</strong>)}</div>{rows.map(([model, route, map]) => <div className="provider-capability-matrix__row" key={model} role="row"><span role="cell"><strong>{model}</strong></span><span role="cell" className="mono-text">{route}</span>{capabilities.map((capability) => <span className={map[capability] ? 'provider-capability-matrix__cell provider-capability-matrix__cell--yes' : 'provider-capability-matrix__cell'} role="cell" key={capability} aria-label={map[capability] ? capability + ' supported' : capability + ' unavailable'}>{map[capability] ? <Icon name="check" size={11} /> : <span>—</span>}</span>)}</div>)}</div>
      <div className="provider-capability-matrix__summary"><Icon name="check-circle" size={13} /><span><strong>{visible.length}</strong> of <strong>{rows.length}</strong> catalog entries satisfy <strong>{required}</strong>.</span></div>
    </section>
  )
}
