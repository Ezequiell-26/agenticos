import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { MetricCard, Panel, Tag } from './PlatformPrimitives'

type Tab='overview'|'mcp'|'browser'|'channels'|'sources'|'credentials'|'webhooks'|'environments'
const tabs:Array<[Tab,string,string]>=[
 ['overview','Overview','Connection inventory and policy status'],
 ['mcp','MCP','Tool servers and transports'],
 ['browser','Browser','Automation sessions and permissions'],
 ['channels','Channels','Messaging gateways and delivery'],
 ['sources','Sources','GitHub and engineering integrations'],
 ['credentials','Credentials','Masked connection metadata'],
 ['webhooks','Webhooks','Inbound events and delivery'],
 ['environments','Environments','Local, worktree, cloud and SSH'],
]
const items=[
 ['MCP Filesystem','MCP','Connected','12 tools'],
 ['Browser Operator','Browser','Preview','7 tools'],
 ['GitHub','Source','Connected','Repository + PR'],
 ['Slack Gateway','Channel','Preview','Delivery not connected'],
 ['Webhook /review','Webhook','Enabled','POST /events/review'],
 ['Local Worktree','Environment','Ready','Git isolated'],
]
const transport=[['filesystem','stdio','Connected'],['browser','SSE','Preview'],['github','streamable HTTP','Connected'],['search','HTTP','Preview']]
const channels=[['Telegram','Gateway','Pairing required'],['Discord','Gateway','Delivery not connected'],['Slack','Gateway','Delivery not connected'],['Microsoft Teams','Gateway','Delivery not connected'],['Email','SMTP','Not connected']]
const sources=[['GitHub','Repositories + pull requests','Connected'],['GitLab','Repositories + merge requests','Available'],['Azure DevOps','Repos + work items','Available'],['Linear','Issues + projects','Preview']]
const creds=[['OpenAI','Provider key','Configured','Masked'],['GitHub','OAuth token','Configured','Masked'],['Browser backend','API credential','Not configured','Absent'],['Telegram','Bot token','Not configured','Absent']]
const hooks=[['review-created','Review event','Enabled'],['release-tag','Release event','Enabled'],['alert','Monitoring event','Paused']]

export function IntegrationControlCenter({onAction}:{onAction:(message:string)=>void}){
 const [tab,setTab]=useState<Tab>('overview'),[search,setSearch]=useState(''),[network,setNetwork]=useState<'restricted'|'approved-only'|'open'>('restricted')
 const filtered=useMemo(()=>items.filter(i=>i.join(' ').toLowerCase().includes(search.toLowerCase())),[search])
 const act=(m:string)=>onAction(m+' staged in preview')
 return <div className="integration-control">
  <header className="integration-control__hero"><div><span className="eyebrow">Integration plane</span><h1>Integration Control Center</h1><p>Organize external capabilities, transports, gateways, credentials, events and environments under one integration policy surface.</p></div><div className="integration-control__actions"><Tag label="Policy-gated"/><button className="studio-button" type="button" onClick={()=>act('Scan integrations')}><Icon name="refresh" size={13}/>Scan</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Add integration')}><Icon name="plus" size={13}/>Add integration</button></div></header>
  <div className="platform-metrics"><MetricCard label="Integrations" value="24" sub="Sources + tools + gateways"/><MetricCard label="Connected" value="7" sub="Authoritative runtime pending"/><MetricCard label="Credentials" value="2" sub="Metadata only · masked"/><MetricCard label="Network" value={network} sub="Default integration policy"/></div>
  <div className="integration-control__tabs">{tabs.map(([id,label,detail])=><button key={id} type="button" className={tab===id?'integration-tab integration-tab--active':'integration-tab'} onClick={()=>setTab(id)} title={detail}>{label}</button>)}</div>

  {tab==='overview'&&<div className="integration-control__grid"><Panel title="Connection inventory"><div className="integration-search"><Icon name="search" size={12}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search integrations…" aria-label="Search integrations"/></div><div className="integration-list">{filtered.map(i=><button key={i[0]} type="button" className="integration-row" onClick={()=>act('Open '+i[0])}><span className="integration-row__icon"><Icon name={i[1]==='MCP'?'network':i[1]==='Browser'?'globe':i[1]==='Source'?'git':i[1]==='Channel'?'message':i[1]==='Webhook'?'activity':'cloud'} size={13}/></span><span><strong>{i[0]}</strong><small>{i[1]} · {i[3]}</small></span><Tag label={i[2]}/></button>)}</div></Panel><Panel title="Integration policy"><div className="integration-policy"><div><span>Network</span><strong>{network}</strong></div><div><span>Unknown endpoints</span><strong>Blocked</strong></div><div><span>Credential exposure</span><strong>Never</strong></div><div><span>Inbound events</span><strong>Signature required</strong></div><div><span>External publication</span><strong>Approval required</strong></div><div><span>Failure mode</span><strong>Fail-closed</strong></div></div><div className="integration-policy-buttons">{(['restricted','approved-only','open'] as const).map(v=><button type="button" className={network===v?'studio-button studio-button--active':'studio-button'} key={v} onClick={()=>setNetwork(v)}>{v}</button>)}</div></Panel></div>}

  {tab==='mcp'&&<div className="integration-control__grid"><Panel title="MCP servers"><div className="integration-list">{transport.map(i=><div className="integration-row" key={i[0]}><span className="integration-row__icon"><Icon name="network" size={13}/></span><span><strong>{i[0]}</strong><small>{i[1]} transport</small></span><Tag label={i[2]}/></div>)}</div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Discover MCP servers')}>Discover</button><button className="studio-button" type="button" onClick={()=>act('Open MCP policy')}>Policy</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Add MCP server')}>Add server</button></div></Panel><Panel title="Tool exposure"><div className="integration-policy">{['Filesystem','Browser','GitHub','Search','Database'].map((name,i)=><div key={name}><span>{name}</span><strong>{i===3?'Approval':'Allowed'}</strong></div>)}</div></Panel></div>}

  {tab==='browser'&&<div className="integration-control__grid"><Panel title="Browser sessions"><div className="browser-session"><div><span className="eyebrow">browser-07</span><h3>Verification workspace</h3><p>Console + network + screenshot evidence</p></div><Tag label="Preview"/></div><div className="integration-facts"><div><span>Domain policy</span><strong>Approved origins</strong></div><div><span>Downloads</span><strong>Ask before save</strong></div><div><span>Credentials</span><strong>External</strong></div><div><span>Evidence</span><strong>Screenshots linked</strong></div></div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Open browser workspace')}>Open</button><button className="studio-button" type="button" onClick={()=>act('Start browser recording')}>Record</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Capture browser evidence')}>Evidence</button></div></Panel><Panel title="Browser permissions"><div className="integration-policy">{['Navigation','DOM read','Console','Network inspection','Form submission','File download'].map((name,i)=><div key={name}><span>{name}</span><strong>{i<4?'Allowed':'Approval'}</strong></div>)}</div></Panel></div>}

  {tab==='channels'&&<Panel title="Gateway catalog"><div className="channel-grid">{channels.map(c=><div key={c[0]}><div><Icon name="message" size={14}/><strong>{c[0]}</strong></div><small>{c[1]}</small><Tag label={c[2]}/><button className="studio-button" type="button" onClick={()=>act('Configure '+c[0])}>Configure</button></div>)}</div></Panel>}

  {tab==='sources'&&<Panel title="Engineering sources"><div className="source-grid">{sources.map(s=><div key={s[0]}><strong>{s[0]}</strong><small>{s[1]}</small><Tag label={s[2]}/><button className="studio-button" type="button" onClick={()=>act('Open '+s[0]+' integration')}>Open</button></div>)}</div></Panel>}

  {tab==='credentials'&&<Panel title="Credential metadata"><div className="credential-list">{creds.map(c=><div key={c[0]}><span className="credential-icon"><Icon name="shield" size={13}/></span><span><strong>{c[0]}</strong><small>{c[1]}</small></span><Tag label={c[2]}/><code>{c[3]}</code></div>)}</div><div className="integration-guard">Secrets are not rendered, copied or returned by this surface.</div></Panel>}

  {tab==='webhooks'&&<Panel title="Inbound events"><div className="webhook-list">{hooks.map(h=><div key={h[0]}><span><strong>{h[0]}</strong><small>{h[1]}</small></span><Tag label={h[2]}/><button className="studio-button" type="button" onClick={()=>act('Inspect '+h[0])}>Inspect</button></div>)}</div><div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Replay webhook delivery')}>Replay</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Create webhook')}>Create</button></div></Panel>}

  {tab==='environments'&&<Panel title="Environment targets"><div className="environment-mini-grid">{['Local Desktop','Mission Worktree','Cloud Agent VM','Remote SSH'].map((name,i)=><div key={name}><Icon name={i===0?'home':i===1?'branch':i===2?'cloud':'network'} size={14}/><strong>{name}</strong><small>{i===3?'SSH policy-gated':i===2?'Ephemeral remote':'Ready'}</small><Tag label={i<2?'Ready':'Preview'}/><button className="studio-button" type="button" onClick={()=>act('Open '+name)}>Open</button></div>)}</div></Panel>}

  <div className="integration-control__guard"><Icon name="shield" size={13}/><span>Integration actions are UI intents. Network changes, external calls, secret attachment and gateway delivery require runtime authorization.</span></div>
 </div>
}
