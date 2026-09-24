import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { runtime } from '../../services/runtime'
import Icon from '../../components/Icon'
import { mcpServers } from '../platform/platformData'
import type { RuntimeApiRecord } from '../../types/runtime'

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
  const [serverTools, setServerTools] = useState<RuntimeApiRecord[]>([])
  const [toolsSyncing, setToolsSyncing] = useState(false)

  useEffect(() => {
    let cancelled = false
    void runtime.mcp.list().then((remoteServers) => {
      if (cancelled || remoteServers.length === 0) return
      const mapped = remoteServers.map((server, index) => {
        const name = typeof server.server_id === 'string' ? server.server_id : typeof server.name === 'string' ? server.name : `server-${index + 1}`
        const enabled = server.enabled !== false
        const transport = typeof server.transport === 'string' ? server.transport : typeof server.command === 'string' ? 'stdio' : 'HTTP'
        const detail = typeof server.description === 'string' ? server.description : typeof server.url === 'string' ? server.url : 'Runtime MCP server'
        return { name, detail, tools: typeof server.tool_count === 'number' ? server.tool_count : 0, state: enabled ? 'Connected' : 'Disabled', transport, auth: typeof server.auth === 'string' ? server.auth : 'Runtime', resources: typeof server.resource_count === 'number' ? server.resource_count : 0, risk: 'Review' }
      })
      setServers(mapped)
      setSelected((current) => mapped.some((item) => item.name === current) ? current : mapped[0].name)
    }).catch(() => {
      // Keep the local catalog available while the runtime is offline.
    })
    return () => { cancelled = true }
  }, [])
  const current = servers.find((server) => server.name === selected) ?? servers[0]

  useEffect(() => {
    if (!current?.name) return
    let cancelled = false
    setToolsSyncing(true)
    void runtime.mcp.tools(current.name).then((tools) => {
      if (!cancelled) setServerTools(tools)
    }).catch(() => {
      if (!cancelled) setServerTools([])
    }).finally(() => { if (!cancelled) setToolsSyncing(false) })
    return () => { cancelled = true }
  }, [current?.name])
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? servers.filter((server) => [server.name, server.detail, server.transport, server.auth].join(' ').toLowerCase().includes(q)) : servers
  }, [servers, search])

  async function addServer() {
    const serverId = window.prompt('MCP server_id', 'my-mcp-server')?.trim()
    if (!serverId) return
    const name = window.prompt('Display name', serverId)?.trim() || serverId
    const command = window.prompt('stdio command', 'npx')?.trim()
    if (!command) return
    const argsRaw = window.prompt('Arguments (space separated)', '') ?? ''
    const args = argsRaw.split(/\\s+/).map((value) => value.trim()).filter(Boolean)
    try {
      await runtime.mcp.register({
        server: {
          server_id: serverId,
          name,
          enabled: true,
          timeout_ms: 30000,
          transport: { Stdio: { command, args } },
        },
      })
      const remoteServers = await runtime.mcp.list()
      const mapped = remoteServers.map((server, index) => {
        const id = typeof server.server_id === 'string' ? server.server_id : typeof server.name === 'string' ? server.name : `server-${index + 1}`
        return {
          name: id,
          detail: typeof server.description === 'string' ? server.description : 'Runtime MCP server',
          tools: typeof server.tool_count === 'number' ? server.tool_count : 0,
          state: server.enabled === false ? 'Disabled' : 'Connected',
          transport: typeof server.transport === 'string' ? server.transport : 'stdio',
          auth: typeof server.auth === 'string' ? server.auth : 'Runtime',
          resources: typeof server.resource_count === 'number' ? server.resource_count : 0,
          risk: 'Review',
        }
      })
      setServers(mapped)
      setSelected(serverId)
      onAction(serverId + ' registered in runtime')
    } catch (error) {
      onAction(error instanceof Error ? error.message : 'MCP registration failed')
    }
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
        <header className="mcp-manager__header"><div><span className="eyebrow">{current.state} · {current.transport}</span><h2>{current.name}</h2><p>{current.detail}</p></div><div className="mcp-manager__actions"><button className="studio-button" type="button" onClick={() => void runtime.mcp.sync(current.name).then(() => runtime.mcp.tools(current.name)).then((tools) => { setServerTools(tools); onAction(current.name + ' tool catalog synced in runtime') }).catch((error) => onAction(error instanceof Error ? error.message : 'MCP sync failed'))}><Icon name="refresh" size={13} /> Sync tools</button><button className="studio-button studio-button--active" type="button" onClick={() => void runtime.mcp.setEnabled(current.name, current.state !== 'Connected').then(() => { setServers((items) => items.map((item) => item.name === current.name ? { ...item, state: current.state === 'Connected' ? 'Disabled' : 'Connected' } : item)); onAction(`${current.name} state updated`) }).catch((error) => onAction(error instanceof Error ? error.message : 'MCP update failed'))}><Icon name="check" size={13} /> {current.state === 'Connected' ? 'Disable' : 'Enable'}</button></div></header>
        <nav className="mcp-manager__tabs" role="tablist" aria-label="MCP server details">{(['Overview','Tools','Resources','Auth','Policy'] as Tab[]).map((item) => <button type="button" key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'mcp-manager__tab mcp-manager__tab--active' : 'mcp-manager__tab'} onClick={() => setTab(item)}>{item}</button>)}</nav>
        <div className="mcp-manager__content">
          {tab === 'Overview' && <Section title="Server overview" description="Review endpoint metadata and capability counts before the server is exposed to an agent."><div className="mcp-manager__stat-grid"><Stat label="State" value={current.state} /><Stat label="Transport" value={current.transport} /><Stat label="Tools" value={String(current.tools)} /><Stat label="Resources" value={String(current.resources)} /><Stat label="Auth" value={current.auth} /><Stat label="Risk" value={current.risk} /></div><div className="mcp-manager__capability-strip"><span>Tools</span><span>Resources</span><span>Prompts</span><span>Sampling</span><span>Progress</span></div><div className="callout"><Icon name="shield" size={14} /><span>MCP credentials and authorization are never stored in this presentation component.</span></div></Section>}

          {tab === 'Tools' && <Section title="Tool registry" description={toolsSyncing ? 'Discovering tools from the connected MCP server.' : 'Live tool catalog returned by the MCP runtime.'}><div className="mcp-manager__table">{(serverTools.length > 0 ? serverTools : []).map((tool,index) => { const name=typeof tool.name==='string'?tool.name:`tool-${index+1}`; const description=typeof tool.description==='string'?tool.description:'Runtime MCP tool'; return <div key={name}><span>{String(index+1).padStart(2,'0')}</span><strong>{name}</strong><small>{description}</small><button type="button" className="mini-chip">{'Runtime'}</button></div>})}{!toolsSyncing && serverTools.length===0 && <div className="review-empty">No tools were returned by this MCP server.</div>}</div></Section>}

          {tab === 'Resources' && <Section title="Resources & prompts" description="Model resources, templates and prompt assets exposed by the server."><div className="mcp-manager__resource-grid">{[['workspace://README.md','Document'],['project://config','Structured'],['prompt://review','Prompt'],['resource://schema','Schema']].slice(0,current.resources || 2).map(([name,type])=><div key={name}><Icon name={type === 'Prompt' ? 'spark' : 'archive'} size={14} /><span><strong>{name}</strong><small>{type} · read-only preview</small></span></div>)}</div><button className="studio-button" type="button" onClick={() => void runtime.mcp.sync(current.name).then(() => onAction(current.name + ' resource/tool catalog synced in runtime')).catch((error) => onAction(error instanceof Error ? error.message : 'MCP catalog sync failed'))}><Icon name="refresh" size={13} /> Refresh catalog</button></Section>}

          {tab === 'Auth' && <Section title="Authentication" description="Represent connection readiness without exposing a secret value."><div className="mcp-manager__auth-card"><div><span className="eyebrow">Current method</span><strong>{current.auth}</strong><small>{current.auth === 'OAuth' ? 'External consent flow' : current.auth === 'Local' ? 'No secret required' : 'Secret stored outside UI'}</small></div><div className="mcp-manager__masked-secret"><Icon name="lock" size={14} /><span>••••••••••••</span></div><div className="platform-actions"><button className="studio-button" type="button" onClick={() => onAction(current.name + ' authentication is runtime-owned; configure the server transport/credentials outside this UI')}>{current.auth === 'OAuth' ? 'Authorize' : 'Configure'}</button><button className="studio-button studio-button--active" type="button" onClick={() => void runtime.mcp.tools(current.name).then(() => onAction(current.name + ' runtime connection responded')).catch((error) => onAction(error instanceof Error ? error.message : 'MCP connection check failed'))}>Check status</button></div></div></Section>}

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
