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
  { name: 'web_search', description: 'Search the web for current sources and evidence.', risk: 'Medium', category: 'Web', enabled: false },
  { name: 'web_extract', description: 'Extract readable content from a web page.', risk: 'Medium', category: 'Web', enabled: false },
  { name: 'browser_navigate', description: 'Navigate a browser session and preserve session state.', risk: 'High', category: 'Browser', enabled: false },
  { name: 'browser_click', description: 'Click interactive browser elements by reference.', risk: 'High', category: 'Browser', enabled: false },
  { name: 'browser_type', description: 'Fill browser form fields and submit input.', risk: 'High', category: 'Browser', enabled: false },
  { name: 'browser_screenshot', description: 'Capture the current browser state for visual verification.', risk: 'Medium', category: 'Browser', enabled: false },
  { name: 'browser_console', description: 'Inspect browser console output and JavaScript errors.', risk: 'Medium', category: 'Browser', enabled: false },
  { name: 'browser_network', description: 'Inspect network traffic for debugging workflows.', risk: 'High', category: 'Browser', enabled: false },
  { name: 'process_manage', description: 'Manage background terminal processes and output.', risk: 'High', category: 'Execution', enabled: false },
  { name: 'read_file', description: 'Read workspace files with bounded output.', risk: 'Medium', category: 'Files', enabled: true },
  { name: 'patch', description: 'Apply targeted file patches within policy scope.', risk: 'High', category: 'Files', enabled: true },
  { name: 'memory', description: 'Read and curate persistent agent memory.', risk: 'Medium', category: 'Memory', enabled: false },
  { name: 'session_search', description: 'Search previous sessions and messages.', risk: 'Medium', category: 'Memory', enabled: false },
  { name: 'todo_list', description: 'Create and inspect structured task plans.', risk: 'Low', category: 'Planning', enabled: true },
  { name: 'clarify', description: 'Request missing information before high-impact actions.', risk: 'Low', category: 'Planning', enabled: true },
  { name: 'delegate_task', description: 'Spawn an isolated specialist subagent for a subtask.', risk: 'High', category: 'Delegation', enabled: false },
  { name: 'execute_code', description: 'Run bounded programmatic tool pipelines in an execution environment.', risk: 'Critical', category: 'Execution', enabled: false },
  { name: 'cronjob_manage', description: 'Create, pause, resume and inspect scheduled jobs.', risk: 'High', category: 'Automation', enabled: false },
  { name: 'skills_list', description: 'List installed and available procedural skills.', risk: 'Low', category: 'Skills', enabled: true },
  { name: 'skill_view', description: 'Load a skill and its references progressively.', risk: 'Medium', category: 'Skills', enabled: false },
  { name: 'skill_manage', description: 'Create, update or remove skill packages.', risk: 'High', category: 'Skills', enabled: false },
  { name: 'text_to_speech', description: 'Generate spoken output for voice workflows.', risk: 'Medium', category: 'Media', enabled: false },
  { name: 'image_generate', description: 'Generate image assets from prompts or references.', risk: 'Medium', category: 'Media', enabled: false },
  { name: 'vision_analyze', description: 'Analyze images, screenshots and visual artifacts.', risk: 'Medium', category: 'Multimodal', enabled: false },
  { name: 'video_generate', description: 'Generate video assets for agent workflows.', risk: 'Medium', category: 'Media', enabled: false },
  { name: 'video_analyze', description: 'Inspect video content for multimodal workflows.', risk: 'Medium', category: 'Media', enabled: false },
  { name: 'computer_use', description: 'Drive a controlled desktop or application session.', risk: 'Critical', category: 'Computer', enabled: false },
  { name: 'x_search', description: 'Search public social posts and threads when enabled.', risk: 'Medium', category: 'Social', enabled: false },
  { name: 'homeassistant', description: 'Use Home Assistant integration tools under explicit policy.', risk: 'Critical', category: 'Integrations', enabled: false },
  { name: 'messaging', description: 'Send messages through configured gateway channels.', risk: 'Critical', category: 'Messaging', enabled: false },
  { name: 'spotify', description: 'Control supported Spotify workflows through an integration.', risk: 'High', category: 'Integrations', enabled: false },
  { name: 'discord', description: 'Interact with supported Discord integrations.', risk: 'High', category: 'Messaging', enabled: false },
  { name: 'kanban', description: 'Operate structured task-board workflows.', risk: 'Medium', category: 'Work management', enabled: false },
  { name: 'desktop_preview', description: 'Preview desktop application state for agent verification.', risk: 'Medium', category: 'Desktop GUI', enabled: false },
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
