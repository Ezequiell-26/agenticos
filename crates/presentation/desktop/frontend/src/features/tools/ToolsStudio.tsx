import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'

type ToolTab = 'All' | 'Enabled' | 'Risk'

const toolCatalog = [
  { name: 'filesystem', description: 'Read and write workspace files', risk: 'High', category: 'Workspace', enabled: true },
  { name: 'terminal', description: 'Execute shell commands in the selected environment', risk: 'Critical', category: 'Execution', enabled: true },
  { name: 'git', description: 'Inspect repository state and create changes', risk: 'High', category: 'Source control', enabled: true },
  { name: 'browser', description: 'Navigate pages, inspect DOM and interact with forms', risk: 'High', category: 'Automation', enabled: true },
  { name: 'search', description: 'Search web or indexed repository sources', risk: 'Medium', category: 'Research', enabled: false },
  { name: 'http', description: 'Perform outbound HTTP requests', risk: 'High', category: 'Network', enabled: false },
  { name: 'python', description: 'Run data and scripting workloads in a sandbox', risk: 'High', category: 'Execution', enabled: false },
  { name: 'vision', description: 'Analyze visual inputs', risk: 'Medium', category: 'Multimodal', enabled: false },
]

const schemas = [
  ['filesystem.read', 'path: string', 'Workspace file content'],
  ['terminal.exec', 'command: string', 'Command result + exit code'],
  ['git.diff', 'scope?: string', 'Repository change set'],
  ['browser.navigate', 'url: string', 'Navigation state'],
  ['search.query', 'query: string', 'Search results'],
]

export default function ToolsStudio({ onAction }: { onAction: (message: string) => void }) {
  const [tab, setTab] = useState<ToolTab>('All')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(toolCatalog[0].name)
  const [enabled, setEnabled] = useState(() => new Set(toolCatalog.filter((tool) => tool.enabled).map((tool) => tool.name)))

  const visible = useMemo(() => toolCatalog.filter((tool) => {
    if (tab === 'Enabled' && !enabled.has(tool.name)) return false
    if (tab === 'Risk' && tool.risk === 'Medium') return false
    return !query || (tool.name + ' ' + tool.description + ' ' + tool.category).toLowerCase().includes(query.toLowerCase())
  }), [enabled, query, tab])

  const current = toolCatalog.find((tool) => tool.name === selected) ?? toolCatalog[0]

  function toggle(name: string) {
    setEnabled((state) => {
      const next = new Set(state)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
    onAction(name + ' tool toggled in preview')
  }

  return (
    <div className="tools-studio">
      <aside className="tools-studio__sidebar">
        <div className="tools-search"><Icon name="search" size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools…" aria-label="Search tools" /></div>
        <div className="tools-tabs" role="tablist" aria-label="Tool registry filters">
          {(['All', 'Enabled', 'Risk'] as ToolTab[]).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'tools-tab tools-tab--active' : 'tools-tab'} onClick={() => setTab(item)}>{item}</button>)}
        </div>
        <div className="tools-list">
          {visible.map((tool) => <button type="button" key={tool.name} className={current.name === tool.name ? 'tool-list-row tool-list-row--active' : 'tool-list-row'} onClick={() => setSelected(tool.name)}><span className="tool-list-icon"><Icon name={tool.name === 'terminal' ? 'terminal' : tool.name === 'git' ? 'git' : tool.name === 'browser' ? 'globe' : 'tool'} size={13} /></span><span><strong>{tool.name}</strong><small>{tool.category}</small></span><span className={'risk-pill risk-pill--' + tool.risk.toLowerCase()}>{tool.risk}</span></button>)}
        </div>
      </aside>
      <section className="tools-studio__detail">
        <div className="tools-detail-head"><div><span className="eyebrow">{current.category}</span><h2>{current.name}</h2><p>{current.description}</p></div><button className={enabled.has(current.name) ? 'switch switch--on' : 'switch'} type="button" role="switch" aria-checked={enabled.has(current.name)} onClick={() => toggle(current.name)}><span /></button></div>
        <div className="tools-detail-grid"><div><span>Risk</span><strong>{current.risk}</strong></div><div><span>Category</span><strong>{current.category}</strong></div><div><span>State</span><strong>{enabled.has(current.name) ? 'Enabled' : 'Disabled'}</strong></div><div><span>Approval</span><strong>{current.risk === 'Critical' ? 'Required' : 'Policy based'}</strong></div></div>
        <div className="tool-schema"><div className="surface-block__heading"><span>Schema preview</span><span className="mono-text">typed</span></div>{schemas.filter(([name]) => name.startsWith(current.name + '.')).map(([name, args, result]) => <div key={name}><strong>{name}</strong><span>{args}</span><small>{result}</small></div>)}{schemas.filter(([name]) => name.startsWith(current.name + '.')).length === 0 && <div className="review-empty">Schema details appear when the runtime registers this tool.</div>}</div>
        <div className="tool-policy-grid"><div><span>Workspace access</span><strong>Scoped</strong></div><div><span>Network access</span><strong>{current.category === 'Network' ? 'Confirm' : 'None'}</strong></div><div><span>Mutation</span><strong>{current.risk === 'Critical' ? 'Blocked by default' : 'Policy based'}</strong></div><div><span>Audit</span><strong>Recorded</strong></div></div>
        <div className="platform-actions"><button className="studio-button" type="button" onClick={() => onAction(current.name + ' test run opened in preview')}><Icon name="play" size={13} /> Test tool</button><button className="studio-button" type="button" onClick={() => onAction(current.name + ' schema copied')}><Icon name="copy" size={13} /> Copy schema</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction(current.name + ' policy editor opened in preview')}><Icon name="shield" size={13} /> Edit policy</button></div>
      </section>
    </div>
  )
}
