import { useState } from 'react'
import Icon from '../../components/Icon'

const agents = [
  ['CA-104', 'Frontend verification', 'agenticos/frontend', 'Ubuntu 24.04', 'Running', '2 artifacts'],
  ['CA-103', 'Dependency migration', 'agenticos/core', 'Node 22 + Rust', 'Completed', '6 artifacts'],
  ['CA-102', 'Nightly audit', 'agenticos', 'Scheduled', 'Queued', '0 artifacts'],
] as const

export default function CloudAgentsWorkspace({ onAction }: { onAction: (message: string) => void }) {
  const [selected, setSelected] = useState(agents[0][0])
  const [remoteControl, setRemoteControl] = useState(false)
  const current = agents.find((item) => item[0] === selected) ?? agents[0]
  return (
    <div className="cloud-agent-workspace">
      <div className="cloud-agent-summary"><div className="metric-card"><span>Concurrent agents</span><strong>3</strong><small>isolated workstreams</small></div><div className="metric-card"><span>Environments</span><strong>2</strong><small>ready</small></div><div className="metric-card"><span>Artifacts</span><strong>8</strong><small>screenshots · video · logs</small></div><div className="metric-card"><span>Remote desktop</span><strong>{remoteControl ? 'Control' : 'View'}</strong><small>presentation preview</small></div></div>
      <div className="cloud-agent-layout">
        <aside className="capability-list">{agents.map(([id, title, repo, env, state]) => <button type="button" key={id} className={selected === id ? 'capability-row capability-row--active' : 'capability-row'} onClick={() => setSelected(id)}><span className="capability-icon"><Icon name="cloud" size={14} /></span><span><strong>{title}</strong><small>{id} · {repo}</small></span><span className={state === 'Running' ? 'status-dot status-dot--live' : 'status-dot status-dot--offline'} /></button>)}</aside>
        <section className="cloud-agent-detail"><header className="capability-head"><div><span className="eyebrow">Remote environment</span><h2>{current[1]}</h2><p>{current[2]} · {current[3]}</p></div><div className="capability-head__actions"><button className="studio-button" type="button" onClick={() => setRemoteControl((value) => !value)}><Icon name="layout" size={13} /> {remoteControl ? 'Control desktop' : 'View desktop'}</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Cloud agent follow-up opened in preview')}><Icon name="message" size={13} /> Follow up</button></div></header><div className="desktop-preview"><div className="desktop-preview__bar"><span /><span /><span /><strong>{remoteControl ? 'control mode' : 'read-only preview'}</strong></div><div className="desktop-preview__screen"><div><Icon name="terminal" size={22} /><span>Agent desktop</span><small>Browser · filesystem · terminal</small></div></div></div><div className="cloud-agent-artifacts">{['Screenshot','Verification log','Demo video','Change summary'].map((item) => <button key={item} type="button" onClick={() => onAction(item + ' opened in preview')}><Icon name="archive" size={13} /><span>{item}</span><Icon name="chevron-right" size={12} /></button>)}</div></section>
      </div>
    </div>
  )
}
