import { useEffect, useMemo, useState } from 'react'
import { runtime } from '../../services/runtime'
import Icon from '../../components/Icon'

type MemoryScope = 'Workspace' | 'Project' | 'Agent' | 'Session'
type MemoryTab = 'All' | 'Pinned' | 'Recent'

type MemoryItem = {
  id: string
  title: string
  detail: string
  scope: MemoryScope
  priority: 'High' | 'Medium' | 'Low'
  tokens: string
  pinned: boolean
  updated: string
}

const initialItems: MemoryItem[] = [
  { id: 'mem-01', title: 'Architecture rules', detail: 'Never bypass the runtime boundary for credentials or provider secrets.', scope: 'Project', priority: 'High', tokens: '420', pinned: true, updated: '2m ago' },
  { id: 'mem-02', title: 'Frontend principle', detail: 'Prefer reversible, incremental UI work with explicit visual states.', scope: 'Workspace', priority: 'High', tokens: '310', pinned: true, updated: '8m ago' },
  { id: 'mem-03', title: 'Current focus', detail: 'Premium black/white desktop command center.', scope: 'Agent', priority: 'Medium', tokens: '180', pinned: false, updated: '21m ago' },
  { id: 'mem-04', title: 'Testing policy', detail: 'Do not mark implementation steps verified without evidence.', scope: 'Project', priority: 'High', tokens: '260', pinned: true, updated: '31m ago' },
  { id: 'mem-05', title: 'Provider strategy', detail: 'Runtime owns provider selection, failover and health semantics.', scope: 'Project', priority: 'Medium', tokens: '220', pinned: false, updated: '46m ago' },
  { id: 'mem-06', title: 'Session preference', detail: 'Keep responses concise unless deep technical detail is requested.', scope: 'Session', priority: 'Low', tokens: '140', pinned: false, updated: '1h ago' },
]

export default function MemoryStudio({ onAction }: { onAction: (message: string) => void }) {
  const [items, setItems] = useState(initialItems)
  const [tab, setTab] = useState<MemoryTab>('All')
  const [scope, setScope] = useState<MemoryScope | 'All'>('All')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(items[0].id)
  const [runtimeLoading, setRuntimeLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void runtime.memory.list('agenticos', query || undefined, 100).then((records) => {
      if (cancelled || records.length === 0) return
      setItems(records.map((record, index) => ({
        id: `${record.namespace}:${record.key}`,
        title: record.key,
        detail: record.value,
        scope: (record.tags?.find((tag) => ['Workspace', 'Project', 'Agent', 'Session'].includes(tag)) as MemoryScope | undefined) ?? 'Project',
        priority: (record.importance ?? 0.5) >= 0.75 ? 'High' : (record.importance ?? 0.5) >= 0.4 ? 'Medium' : 'Low',
        tokens: String(Math.max(1, Math.ceil(record.value.length / 4))),
        pinned: record.tags?.includes('pinned') ?? false,
        updated: record.updated_at ? new Date(record.updated_at * 1000).toLocaleString() : `remote ${index + 1}`,
      })))
      setSelected((current) => records.some((record) => `${record.namespace}:${record.key}` === current) ? current : `${records[0].namespace}:${records[0].key}`)
    }).catch(() => {
      // Keep the local presentation fallback when runtime memory is unavailable.
    }).finally(() => { if (!cancelled) setRuntimeLoading(false) })
    return () => { cancelled = true }
  }, [query])

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return items.filter((item) => {
      if (tab === 'Pinned' && !item.pinned) return false
      if (tab === 'Recent' && item.updated.includes('h') && !item.updated.includes('m')) return false
      if (scope !== 'All' && item.scope !== scope) return false
      return !normalized || (item.title + ' ' + item.detail + ' ' + item.scope).toLowerCase().includes(normalized)
    })
  }, [items, query, scope, tab])

  const active = items.find((item) => item.id === selected) ?? visible[0] ?? items[0]

  function togglePinned(id: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, pinned: !item.pinned } : item))
    onAction('Memory pin state updated in preview')
  }

  async function forget(id: string) {
    const item = items.find((entry) => entry.id === id)
    if (!item) return
    try {
      await runtime.memory.remove('agenticos', item.title)
      setItems((current) => current.filter((entry) => entry.id !== id))
      onAction('Memory item removed')
    } catch (error) {
      onAction(error instanceof Error ? error.message : 'Memory removal failed')
    }
  }

  return (
    <div className="memory-studio">
      <aside className="memory-studio__sidebar">
        <div className="memory-studio__controls">
          <div className="memory-search"><Icon name="search" size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search memory…" aria-label="Search memory" /></div>
          <select value={scope} onChange={(event) => setScope(event.target.value as MemoryScope | 'All')} aria-label="Memory scope"><option>All</option><option>Workspace</option><option>Project</option><option>Agent</option><option>Session</option></select>
        </div>
        <div className="memory-tabs" role="tablist" aria-label="Memory filters" aria-orientation="horizontal">
          {(['All', 'Pinned', 'Recent'] as MemoryTab[]).map((item, index, tabs) => <button type="button" key={item} id={'memory-tab-' + item.toLowerCase()} role="tab" tabIndex={tab === item ? 0 : -1} aria-selected={tab === item} aria-controls="memory-list-panel" className={tab === item ? 'memory-tab memory-tab--active' : 'memory-tab'} onClick={() => setTab(item)} onKeyDown={(event) => {
            const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
            if (nextIndex >= 0) { event.preventDefault(); const next = tabs[nextIndex]; setTab(next); window.requestAnimationFrame(() => document.getElementById('memory-tab-' + next.toLowerCase())?.focus()) }
          }}>{item}</button>)}
        </div>
        <div id="memory-list-panel" className="memory-list" role="tabpanel" aria-labelledby={'memory-tab-' + tab.toLowerCase()} tabIndex={0}><span>{runtimeLoading ? 'Syncing…' : `${items.length} items`}</span><span>{items.filter((item) => item.pinned).length} pinned</span><span>{items.reduce((sum, item) => sum + Number(item.tokens), 0)} tokens</span></div>
        <div className="memory-list">
          {visible.length === 0 ? <div className="memory-empty">No memory matches the current filters.</div> : visible.map((item) => <button type="button" key={item.id} className={active.id === item.id ? 'memory-item memory-item--active' : 'memory-item'} onClick={() => setSelected(item.id)}><div className="memory-item__icon"><Icon name={item.pinned ? 'archive' : 'history'} size={13} /></div><div><strong>{item.title}</strong><span>{item.scope} · {item.priority}</span></div><small>{item.tokens}</small></button>)}
        </div>
      </aside>
      <section className="memory-studio__detail">
        <div className="memory-detail-head"><div><span className="eyebrow">{active.scope} memory</span><h2>{active.title}</h2><p>{active.detail}</p></div><span className={active.pinned ? 'state-pill state-pill--completed' : 'state-pill state-pill--pending'}>{active.pinned ? 'Pinned' : 'Optional'}</span></div>
        <div className="memory-detail-grid"><div><span>Priority</span><strong>{active.priority}</strong></div><div><span>Estimated tokens</span><strong>{active.tokens}</strong></div><div><span>Updated</span><strong>{active.updated}</strong></div><div><span>Scope</span><strong>{active.scope}</strong></div></div>
        <div className="memory-content-card"><div className="surface-block__heading"><span>Content</span><span className="mono-text">preview</span></div><p>{active.detail}</p><div className="memory-content-actions"><button className="studio-button" type="button" onClick={() => togglePinned(active.id)}><Icon name="archive" size={13} /> {active.pinned ? 'Unpin' : 'Pin'}</button><button className="studio-button" type="button" onClick={() => onAction('Memory added to active context in preview')}>Add to context</button><button className="studio-button" type="button" onClick={() => onAction('Memory edit opened in preview')}>Edit</button><button className="studio-button" type="button" onClick={() => forget(active.id)}>Forget</button></div></div>
        <div className="memory-boundary"><Icon name="shield" size={14} /><span>Memory suggestions never silently modify agent behavior. Promotion into persistent context remains explicit.</span></div>
      </section>
    </div>
  )
}
