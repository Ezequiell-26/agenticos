import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'

type Kind = 'Agent' | 'Skill' | 'Rule' | 'Command' | 'Hook' | 'MCP' | 'Plugin' | 'Toolset'

interface Customization {
  id: string
  name: string
  kind: Kind
  scope: 'Global' | 'Project' | 'Agent'
  status: 'Enabled' | 'Disabled'
  source: 'Built-in' | 'Local' | 'Community' | 'Managed'
  detail: string
  permissions: string
}

const initialItems: Customization[] = [
  { id: 'agent-builder', name: 'Builder', kind: 'Agent', scope: 'Project', status: 'Enabled', source: 'Built-in', detail: 'Implementation agent with repository-safe edit and verification workflow.', permissions: 'Workspace write · terminal ask' },
  { id: 'reviewer', name: 'Reviewer', kind: 'Agent', scope: 'Project', status: 'Enabled', source: 'Built-in', detail: 'Focused diff, test and policy review agent.', permissions: 'Workspace read · Git read' },
  { id: 'research', name: 'Research', kind: 'Skill', scope: 'Global', status: 'Enabled', source: 'Community', detail: 'Collect, compare and cite external information.', permissions: 'Web · browser read' },
  { id: 'safe-edits', name: 'Safe edits', kind: 'Rule', scope: 'Project', status: 'Enabled', source: 'Local', detail: 'Prefer reversible changes and verify every implementation slice.', permissions: 'Instruction only' },
  { id: 'verify', name: 'Verify', kind: 'Command', scope: 'Project', status: 'Enabled', source: 'Local', detail: 'Run the project verification sequence and report evidence.', permissions: 'Terminal ask' },
  { id: 'pre-tool', name: 'preTool', kind: 'Hook', scope: 'Global', status: 'Enabled', source: 'Local', detail: 'Inspect tool requests before execution.', permissions: 'Policy inspect' },
  { id: 'github', name: 'GitHub MCP', kind: 'MCP', scope: 'Project', status: 'Enabled', source: 'Community', detail: 'Repository, issue and pull-request capabilities.', permissions: 'External · ask' },
  { id: 'browser-tools', name: 'Browser Tools', kind: 'Toolset', scope: 'Project', status: 'Enabled', source: 'Built-in', detail: 'Grouped browser navigation, inspection and capture tools.', permissions: 'Browser · ask' },
  { id: 'diff-review', name: 'Diff Review', kind: 'Plugin', scope: 'Global', status: 'Disabled', source: 'Community', detail: 'Adds review helpers without replacing the native diff surface.', permissions: 'Read only' },
]

const kinds: Array<'All' | Kind> = ['All', 'Agent', 'Skill', 'Rule', 'Command', 'Hook', 'MCP', 'Plugin', 'Toolset']

export default function CustomizeManager() {
  const [items, setItems] = useState(initialItems)
  const [filter, setFilter] = useState<'All' | Kind>('All')
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'All' | Customization['scope']>('All')
  const [selectedId, setSelectedId] = useState(initialItems[0].id)

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return items.filter((item) => {
      const matchesKind = filter === 'All' || item.kind === filter
      const matchesScope = scope === 'All' || item.scope === scope
      const matchesQuery = !term || [item.name, item.kind, item.source, item.detail].join(' ').toLowerCase().includes(term)
      return matchesKind && matchesScope && matchesQuery
    })
  }, [filter, items, query, scope])

  const selected = items.find((item) => item.id === selectedId) ?? filtered[0]

  function toggle(id: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status: item.status === 'Enabled' ? 'Disabled' : 'Enabled' } : item))
  }

  return (
    <div className="customize-manager">
      <div className="customize-manager__toolbar">
        <label className="control-center-search">
          <Icon name="search" size={13} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search agents, skills, rules, MCP…" />
        </label>
        <select value={scope} onChange={(event) => setScope(event.target.value as typeof scope)} aria-label="Customization scope">
          <option>All</option><option>Global</option><option>Project</option><option>Agent</option>
        </select>
      </div>
      <div className="customize-manager__filters">
        {kinds.map((kind) => <button type="button" key={kind} className={filter === kind ? 'customize-filter customize-filter--active' : 'customize-filter'} onClick={() => setFilter(kind)}>{kind}</button>)}
      </div>
      <div className="customize-manager__body">
        <div className="customize-manager__list">
          {filtered.map((item) => (
            <button type="button" key={item.id} className={selected?.id === item.id ? 'customize-row customize-row--active' : 'customize-row'} onClick={() => setSelectedId(item.id)}>
              <span className="customize-row__icon"><Icon name={item.kind === 'MCP' ? 'network' : item.kind === 'Rule' ? 'shield' : item.kind === 'Skill' ? 'spark' : item.kind === 'Agent' ? 'bot' : item.kind === 'Toolset' ? 'layers' : 'tool'} size={13} /></span>
              <span><strong>{item.name}</strong><small>{item.kind} · {item.scope}</small></span>
              <span className={item.status === 'Enabled' ? 'state-pill state-pill--active' : 'state-pill state-pill--pending'}>{item.status}</span>
            </button>
          ))}
          {filtered.length === 0 && <div className="customize-empty">No customization matches the current filters.</div>}
        </div>
        {selected && (
          <div className="customize-manager__detail">
            <div className="customize-detail__header">
              <div><span className="eyebrow">{selected.kind}</span><h3>{selected.name}</h3><p>{selected.detail}</p></div>
              <button type="button" className={selected.status === 'Enabled' ? 'studio-button studio-button--active' : 'studio-button'} onClick={() => toggle(selected.id)}>{selected.status === 'Enabled' ? 'Disable' : 'Enable'}</button>
            </div>
            <div className="customize-detail__grid">
              <div><span>Scope</span><strong>{selected.scope}</strong></div>
              <div><span>Source</span><strong>{selected.source}</strong></div>
              <div><span>Permissions</span><strong>{selected.permissions}</strong></div>
              <div><span>State</span><strong>{selected.status}</strong></div>
            </div>
            <div className="control-info-callout">
              <span><Icon name="info" size={14} /></span>
              <div><strong>One customization contract</strong><small>Agents, skills, rules, commands, hooks, MCP, plugins and toolsets share the same management model while retaining type-specific configuration.</small></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
