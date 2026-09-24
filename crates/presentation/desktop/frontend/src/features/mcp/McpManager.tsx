import { useMemo, useState, type ReactNode } from 'react'
import Icon from '../../components/Icon'
import { mcpServers } from '../platform/platformData'

type Tab = 'Overview' | 'Tools' | 'Resources' | 'Auth' | 'Policy'
type Server = {
  name: string
  detail: string
  tools: number
  state: string
  transport: string
  auth: string
  resources: number
  risk: string
}
const serverCatalog: Server[] = [
  ...mcpServers.map(([name, detail, tools, state]) => ({
    name,
    detail,
    tools: Number.parseInt(tools, 10) || 0,
    state,
    transport: name === 'github' ? 'HTTP' : 'stdio / HTTP',
    auth: name === 'filesystem' ? 'Local' : name === 'github' ? 'OAuth' : 'API key',
    resources: name === 'filesystem' ? 8 : name === 'github' ? 4 : 2,
    risk: name === 'filesystem' ? 'Low' : name === 'github' ? 'Medium' : 'Review',
  })),
]

export default function McpManager({ onAction }: { onAction: (message: string) => void }) {
  const [servers, setServers] = useState(serverCatalog)
  const [selected, setSelected] = useState(serverCatalog[0].name)
  const [tab, setTab] = useState<Tab>('Overview')
  const [search, setSearch] = useState('')
  const current = servers.find((server) => server.name === selected) ?? servers[0]
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? servers.filter((server) => [server.name, server.detail, server.transport, server.auth].join(' ').toLowerCase().includes(q)) : servers
  }, [servers, search])

  function addServer() {
    const next: Server = { name: 'new-server', detail: 'Custom MCP endpoint', tools: 0, state: 'Draft', transport: 'stdio', auth: 'Not configured', resources: 0, risk: 'Review' }
    setServers((items) => [next, ...items])
    setSelected(next.name)
    setTab('Overview')
    onAction('New MCP server created in preview')
  }

  return (
    <div className="mcp-manager">
      <aside className="mcp-manager__rail">
        <div className="mcp-manager__rail-head"><div><span className="eyebrow">Tool gateway</span><strong>MCP Servers</strong></div><button className="icon-button" type="button" aria-label="Add MCP server" title="Add MCP server" onClick={addServer}><Icon name="plus" size={15} /></button></div>
        <div className="mcp-manager__search"><Icon name="search" size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search servers…" /></div>
        <div className="mcp-manager__list">{visible.map((server) => <button type="button" key={server.name} className={server.name === current.name ? 'mcp-manager__server mcp-manager__server--active' : 'mcp-manager__server'} onClick={() => setSelected(server.name)}><span className="mcp-manager__icon"><Icon name="network" size={14} /></span><span><strong>{server.name}</strong><small>{server.tools} tools · {server.auth}</small></span><span className={server.state === 'Connected' ? 'status-dot status-dot--live' : 'status-dot status-dot--offline'} /></button>)}</div>
        <div className="mcp-manager__rail-foot"><span className="mono-text">{servers.length} servers</span><span className="state-pill state-pill--pending">Runtime-owned</span></div>
      </aside>

      <section className="mcp-manager__workspace">
        <header className="mcp-manager__header"><div><span className="eyebrow">{current.state} · {current.transport}</span><h2>{current.name}</h2><p>{current.detail}</p></div><div className="mcp-manager__actions"><button className="studio-button" type="button" onClick={() => onAction(current.name + ' health check staged in preview')}><Icon name="refresh" size={13} /> Health check</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction(current.name + ' configuration saved in preview')}><Icon name="check" size={13} /> Save</button></div></header>
        <nav className="mcp-manager__tabs" role="tablist" aria-label="MCP server details">{(['Overview','Tools','Resources','Auth','Policy'] as Tab[]).map((item) => <button type="button" key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'mcp-manager__tab mcp-manager__tab--active' : 'mcp-manager__tab'} onClick={() => setTab(item)}>{item}</button>)}</nav>
        <div className="mcp-manager__content">
          {tab === 'Overview' && <Section title="Server overview" description="Review endpoint metadata and capability counts before the server is exposed to an agent."><div className="mcp-manager__stat-grid"><Stat label="State" value={current.state} /><Stat label="Transport" value={current.transport} /><Stat label="Tools" value={String(current.tools)} /><Stat label="Resources" value={String(current.resources)} /><Stat label="Auth" value={current.auth} /><Stat label="Risk" value={current.risk} /></div><div className="mcp-manager__capability-strip"><span>Tools</span><span>Resources</span><span>Prompts</span><span>Sampling</span><span>Progress</span></div><div className="callout"><Icon name="shield" size={14} /><span>MCP credentials and authorization are never stored in this presentation component.</span></div></Section>}

          {tab === 'Tools' && <Section title="Tool registry" description="Inspect tool names, risk and whether each operation requires approval."><div className="mcp-manager__table">{['read_file','list_directory','search_code','create_issue','create_pull_request','run_command'].map((tool,index)=><div key={tool}><span>{String(index+1).padStart(2,'0')}</span><strong>{tool}</strong><small>{index < 3 ? 'read' : index === 3 ? 'write' : index === 4 ? 'write' : 'sensitive'}</small><button type="button" className="mini-chip">{index >= 3 ? 'Ask' : 'Allow'}</button></div>)}</div></Section>}

          {tab === 'Resources' && <Section title="Resources & prompts" description="Model resources, templates and prompt assets exposed by the server."><div className="mcp-manager__resource-grid">{[['workspace://README.md','Document'],['project://config','Structured'],['prompt://review','Prompt'],['resource://schema','Schema']].slice(0,current.resources || 2).map(([name,type])=><div key={name}><Icon name={type === 'Prompt' ? 'spark' : 'archive'} size={14} /><span><strong>{name}</strong><small>{type} · read-only preview</small></span></div>)}</div><button className="studio-button" type="button" onClick={() => onAction('MCP resource catalog refreshed in preview')}><Icon name="refresh" size={13} /> Refresh catalog</button></Section>}

          {tab === 'Auth' && <Section title="Authentication" description="Represent connection readiness without exposing a secret value."><div className="mcp-manager__auth-card"><div><span className="eyebrow">Current method</span><strong>{current.auth}</strong><small>{current.auth === 'OAuth' ? 'External consent flow' : current.auth === 'Local' ? 'No secret required' : 'Secret stored outside UI'}</small></div><div className="mcp-manager__masked-secret"><Icon name="lock" size={14} /><span>••••••••••••</span></div><div className="platform-actions"><button className="studio-button" type="button" onClick={() => onAction(current.name + ' authentication flow opened in preview')}>{current.auth === 'OAuth' ? 'Authorize' : 'Configure'}</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction(current.name + ' credential status checked in preview')}>Check status</button></div></div></Section>}

          {tab === 'Policy' && <Section title="Server policy" description="Preview which classes of MCP operation are allowed, gated or denied."><div className="mcp-manager__policy-list">{[['Read tools','Allow'],['Write tools','Ask'],['Network resources','Ask'],['Credentials access','Deny'],['Destructive operations','Deny']].map(([name,value])=><div key={name}><span><strong>{name}</strong><small>Runtime authorization remains authoritative.</small></span><Select value={value} onChange={(next) => onAction(name + ' set to ' + next + ' in preview')} /></div>)}</div></Section>}
        </div>
      </section>
    </div>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="mcp-manager__section"><header><span className="eyebrow">MCP configuration</span><h3>{title}</h3><p>{description}</p></header><div className="mcp-manager__section-body">{children}</div></section>
}
function Select({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <select className="mcp-manager__select" value={value} onChange={(event) => onChange(event.target.value)}><option>Allow</option><option>Ask</option><option>Deny</option></select>
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="mcp-manager__stat"><span>{label}</span><strong>{value}</strong></div>
}
