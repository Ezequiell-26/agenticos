import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { contextSources } from '../platform/platformData'

type SourceState = {
  enabled: boolean
  pinned: boolean
  excluded: boolean
}

export default function ContextInspector({ onAction }: { onAction: (message: string) => void }) {
  const [states, setStates] = useState<Record<string, SourceState>>(() => Object.fromEntries(
    contextSources.map(([name], index) => [name, { enabled: index < 5, pinned: index < 2, excluded: false }]),
  ))
  const [budget, setBudget] = useState(64)
  const [mode, setMode] = useState<'Balanced' | 'Compact' | 'Maximum'>('Balanced')

  const activeSources = contextSources.filter(([name]) => states[name]?.enabled && !states[name]?.excluded)
  const estimated = useMemo(() => activeSources.reduce((sum, [, , tokens]) => sum + Number.parseFloat(tokens), 0), [activeSources])
  const remaining = Math.max(0, budget - Math.round(estimated))
  const utilization = Math.min(100, Math.round((estimated / budget) * 100))

  function patch(name: string, patch: Partial<SourceState>) {
    setStates((current) => ({ ...current, [name]: { ...current[name], ...patch } }))
  }

  function toggleSource(name: string) {
    const current = states[name]
    patch(name, { enabled: !current.enabled, excluded: false })
  }

  return (
    <div className="context-inspector">
      <div className="context-inspector__toolbar">
        <div><span className="eyebrow">Prompt context</span><h2>Context Inspector</h2><p>Build an explicit, reviewable context pack before an agent run.</p></div>
        <div className="context-inspector__toolbar-actions">
          <span className="state-pill state-pill--completed">{activeSources.length} sources</span>
          <button className="studio-button" type="button" onClick={() => onAction('Context pack exported in preview')}><Icon name="download" size={13} /> Export</button>
          <button className="studio-button studio-button--active" type="button" onClick={() => onAction('Context pack saved in preview')}><Icon name="check" size={13} /> Save pack</button>
        </div>
      </div>

      <div className="context-inspector__grid">
        <section className="context-inspector__sources">
          <div className="context-inspector__section-head"><div><strong>Sources</strong><small>Pin, include or exclude each context source.</small></div><button className="icon-button" type="button" title="Reset sources" aria-label="Reset sources" onClick={() => setStates(Object.fromEntries(contextSources.map(([name], index) => [name, { enabled: index < 5, pinned: index < 2, excluded: false }])))}><Icon name="refresh" size={14} /></button></div>
          <div className="context-inspector__source-list">
            {contextSources.map(([name, detail, tokens]) => {
              const state = states[name]
              return (
                <div key={name} className={state.enabled && !state.excluded ? 'context-inspector__source context-inspector__source--active' : 'context-inspector__source'}>
                  <button type="button" className="context-inspector__source-main" onClick={() => toggleSource(name)}>
                    <span className="context-inspector__source-icon"><Icon name={name === 'Workspace files' ? 'folder' : name === 'Open files' ? 'file-code' : name === 'Git diff' ? 'git' : name === 'Project rules' ? 'shield' : name === 'Pinned memory' ? 'database' : name === 'Web sources' ? 'globe' : 'history'} size={14} /></span>
                    <span><strong>{name}</strong><small>{detail}</small></span>
                    <span className="mono-text">{tokens}k</span>
                  </button>
                  <div className="context-inspector__source-actions">
                    <button type="button" className={state.pinned ? 'mini-chip mini-chip--active' : 'mini-chip'} onClick={() => patch(name, { pinned: !state.pinned })}>{state.pinned ? 'Pinned' : 'Pin'}</button>
                    <button type="button" className={state.excluded ? 'mini-chip mini-chip--active' : 'mini-chip'} onClick={() => patch(name, { excluded: !state.excluded, enabled: state.excluded ? true : false })}>{state.excluded ? 'Excluded' : 'Exclude'}</button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <aside className="context-inspector__budget">
          <div className="context-inspector__budget-head"><span className="eyebrow">Budget</span><strong>{estimated.toFixed(1)}k / {budget}k</strong></div>
          <div className="context-inspector__ring"><div><strong>{utilization}%</strong><span>used</span></div></div>
          <div className="context-inspector__budget-row"><span>Reserved output</span><strong>8k</strong></div>
          <div className="context-inspector__budget-row"><span>Remaining</span><strong>{remaining.toFixed(1)}k</strong></div>
          <label className="context-inspector__range"><span>Context ceiling<strong>{budget}k</strong></span><input type="range" min={24} max={128} step={8} value={budget} onChange={(event) => setBudget(Number(event.target.value))} /></label>
          <div className="context-inspector__mode">
            <span>Compaction strategy</span>
            <div>{(['Balanced', 'Compact', 'Maximum'] as const).map((item) => <button type="button" key={item} className={mode === item ? 'mini-chip mini-chip--active' : 'mini-chip'} onClick={() => setMode(item)}>{item}</button>)}</div>
          </div>
          <div className="context-inspector__breakdown">
            <div><span>Prompt</span><strong>{Math.round(estimated * .68)}k</strong></div>
            <div><span>Memory</span><strong>{Math.round(estimated * .13)}k</strong></div>
            <div><span>Code</span><strong>{Math.round(estimated * .16)}k</strong></div>
            <div><span>Other</span><strong>{Math.max(0, Math.round(estimated * .03))}k</strong></div>
          </div>
          <div className="callout"><Icon name="archive" size={14} /><span>Physical model limits are runtime-owned. This inspector previews the context composition only.</span></div>
        </aside>
      </div>

      <section className="context-inspector__footer">
        <div><span className="eyebrow">Selected pack</span><strong>{mode} · {activeSources.length} sources · {estimated.toFixed(1)}k estimated</strong></div>
        <div className="context-inspector__footer-actions"><button className="studio-button" type="button" onClick={() => onAction('Old turns marked for compaction in preview')}><Icon name="archive" size={13} /> Compact old turns</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Context handoff preview opened')}>Preview handoff</button></div>
      </section>
    </div>
  )
}
