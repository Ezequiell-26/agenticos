import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { MetricCard, Panel, Tag } from './PlatformPrimitives'
import './RemoteControlCenter.css'

type Tab = 'Sessions' | 'Devices' | 'Approvals' | 'Notifications' | 'Preferences'
const sessions = [
  ['REMOTE-042','agenticos / frontend','Builder','Windows Workstation','Working','2m ago'],
  ['REMOTE-041','agenticos / backend','Reviewer','MacBook Studio','Needs approval','5m ago'],
  ['REMOTE-040','ccos / desktop','QA Agent','Linux Node-07','Idle','18m ago'],
] as const
const devices = [
  ['Windows Workstation','Trusted','Last seen now','Browser + desktop'],
  ['MacBook Studio','Trusted','Last seen 5m ago','Browser'],
  ['Linux Node-07','Paired','Last seen 18m ago','Desktop'],
] as const
const approvals = [
  ['APR-018','Modify protected branch','High','REMOTE-041','Awaiting human'],
  ['APR-017','Open external browser session','Medium','REMOTE-042','Approved'],
  ['APR-016','Run network-enabled tool','Medium','REMOTE-040','Expired'],
] as const
const notifications = [
  ['Agent completed verification','REMOTE-042','1m ago','Info'],
  ['Approval requested','APR-018','5m ago','Action'],
  ['Remote session disconnected','REMOTE-039','24m ago','Warning'],
] as const

export default function RemoteControlCenter({ onAction }: { onAction: (message: string) => void }) {
  const [tab,setTab]=useState<Tab>('Sessions')
  const [selectedSession,setSelectedSession]=useState<string>(sessions[0][0])
  const [pushEnabled,setPushEnabled]=useState(true)
  const [reconnectEnabled,setReconnectEnabled]=useState(true)
  const current=useMemo(()=>sessions.find((session)=>session[0]===selectedSession)??sessions[0],[selectedSession])
  const act=(message:string)=>onAction(message+' staged in preview')

  return <div className="remote-control-center">
    <header className="remote-control-center__hero">
      <div><span className="eyebrow">Remote operations</span><h1>Remote Control Center</h1><p>Monitor agent sessions, inspect remote workspace state, approve sensitive actions and resume work from another device.</p></div>
      <div className="remote-control-center__actions"><Tag label="Browser handoff"/><button className="studio-button" type="button" onClick={()=>act('Pair device')}><Icon name="users" size={13}/> Pair device</button><button className="studio-button" type="button" onClick={()=>act('Refresh remote sessions')}><Icon name="refresh" size={13}/> Refresh</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Open remote session')}><Icon name="external" size={13}/> Open remote</button></div>
    </header>

    <div className="platform-metrics"><MetricCard label="Remote sessions" value="3" sub="1 active · 1 approval"/><MetricCard label="Awaiting approval" value="1" sub="Human gate required"/><MetricCard label="Paired devices" value="3" sub="2 trusted"/><MetricCard label="Push notifications" value={pushEnabled?'On':'Off'} sub="Remote alerts"/></div>

    <div className="remote-control-center__tabs" role="tablist" aria-label="Remote control views">
      {(['Sessions','Devices','Approvals','Notifications','Preferences'] as Tab[]).map((item)=><button key={item} type="button" role="tab" aria-selected={tab===item} className={tab===item?'remote-tab remote-tab--active':'remote-tab'} onClick={()=>setTab(item)}>{item}</button>)}
    </div>

    {tab==='Sessions'&&<div className="remote-control-center__grid">
      <Panel title="Remote sessions"><div className="remote-list">{sessions.map((session)=><button key={session[0]} type="button" className={selectedSession===session[0]?'remote-row remote-row--active':'remote-row'} onClick={()=>setSelectedSession(session[0])}><span className="remote-row__icon"><Icon name="cloud" size={14}/></span><span><strong>{session[0]}</strong><small>{session[1]} · {session[2]}</small></span><Tag label={session[4]}/><small>{session[5]}</small></button>)}</div></Panel>
      <Panel title={current[0]}><div className="remote-preview">
        <div className="remote-preview__top"><span><i className="remote-live-dot"/> Remote viewport</span><span className="mono-text">preview · {current[4]}</span></div>
        <div className="remote-preview__canvas"><div className="remote-window"><div className="remote-window__bar"><span>AgentiCOS · {current[1]}</span><span>● connected</span></div><div className="remote-window__body"><div className="remote-window__rail"><span/><span/><span/><span/><span/></div><div className="remote-window__main"><span className="eyebrow">Remote workspace</span><strong>{current[2]}</strong><small>{current[1]}</small><div className="remote-window__events"><span>Plan approved</span><span>Tool call verified</span><span>Artifact ready</span></div></div></div></div></div>
        <div className="remote-preview__actions"><button className="studio-button" type="button" onClick={()=>act('Inspect remote events')}><Icon name="activity" size={13}/> Events</button><button className="studio-button" type="button" onClick={()=>act('Request remote screenshot')}><Icon name="archive" size={13}/> Screenshot</button><button className="studio-button" type="button" onClick={()=>act('Open remote artifacts')}><Icon name="archive" size={13}/> Artifacts</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Resume remote session')}><Icon name="play" size={13}/> Resume</button></div>
      </div></Panel>
    </div>}

    {tab==='Devices'&&<Panel title="Trusted devices"><div className="remote-list remote-list--devices">{devices.map((device)=><div className="remote-device-row" key={device[0]}><span className="remote-device-icon"><Icon name="cloud" size={15}/></span><div><strong>{device[0]}</strong><small>{device[2]} · {device[3]}</small></div><Tag label={device[1]}/><button className="studio-button" type="button" onClick={()=>act('Open '+device[0])}>Open</button></div>)}</div></Panel>}

    {tab==='Approvals'&&<Panel title="Remote approval queue"><div className="remote-approval-list">{approvals.map((approval)=><div className="remote-approval-row" key={approval[0]}><span className="remote-approval-risk"><Icon name="shield" size={13}/></span><div><strong>{approval[1]}</strong><small>{approval[0]} · {approval[3]}</small></div><Tag label={approval[4]}/><span className="mono-text">{approval[2]}</span><button className={approval[4]==='Awaiting human'?'studio-button studio-button--active':'studio-button'} type="button" onClick={()=>act('Review '+approval[0])}>{approval[4]==='Awaiting human'?'Review':'Inspect'}</button></div>)}</div><div className="remote-guard"><Icon name="shield" size={13}/><span>Approval actions remain runtime-authoritative; this surface only models the human decision workflow.</span></div></Panel>}

    {tab==='Notifications'&&<Panel title="Remote activity inbox"><div className="remote-notification-list">{notifications.map((notification)=><button type="button" key={notification[0]} className="remote-notification-row" onClick={()=>act('Open '+notification[0])}><span className="remote-notification-icon"><Icon name="bell" size={13}/></span><div><strong>{notification[0]}</strong><small>{notification[1]} · {notification[2]}</small></div><Tag label={notification[3]}/><Icon name="chevron-right" size={12}/></button>)}</div></Panel>}

    {tab==='Preferences'&&<div className="remote-control-center__grid remote-control-center__grid--single"><Panel title="Remote session preferences"><div className="remote-preference-list"><div><span><strong>Push notifications</strong><small>Notify when a run finishes or needs approval.</small></span><button className={pushEnabled?'remote-switch remote-switch--on':'remote-switch'} type="button" role="switch" aria-checked={pushEnabled} onClick={()=>setPushEnabled((value)=>!value)}><span/></button></div><div><span><strong>Auto reconnect</strong><small>Attempt to resume the selected remote session after a disconnect.</small></span><button className={reconnectEnabled?'remote-switch remote-switch--on':'remote-switch'} type="button" role="switch" aria-checked={reconnectEnabled} onClick={()=>setReconnectEnabled((value)=>!value)}><span/></button></div><div><span><strong>Approval notifications</strong><small>Always surface human-gated actions before remote execution continues.</small></span><button className="remote-switch remote-switch--on" type="button" role="switch" aria-checked="true" onClick={()=>act('Approval notifications toggled')}><span/></button></div></div><div className="remote-guard"><Icon name="shield" size={13}/><span>Secrets, device credentials and authorization tokens are not stored in this UI state.</span></div></Panel></div>}
  </div>
}
