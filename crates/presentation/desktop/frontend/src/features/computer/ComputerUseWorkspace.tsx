import { useState } from 'react'
import Icon from '../../components/Icon'

const sessions: ReadonlyArray<readonly [string, string, string, string]> = [
  ['CU-01', 'Browser QA', 'Browser', 'Ready'],
  ['CU-02', 'Desktop smoke test', 'Desktop', 'Running'],
  ['CU-03', 'Accessibility audit', 'Browser', 'Queued'],
] as const

export default function ComputerUseWorkspace({ onAction }: { onAction: (message: string) => void }) {
  const [selected, setSelected] = useState(sessions[0][0])
  const [recording, setRecording] = useState(true)
  const current = sessions.find((item) => item[0] === selected) ?? sessions[0]
  return (
    <div className="computer-use-workspace">
      <aside className="capability-list">{sessions.map(([id,title,type,state]) => <button type="button" key={id} className={selected === id ? 'capability-row capability-row--active' : 'capability-row'} onClick={() => setSelected(id)}><span className="capability-icon"><Icon name={type === 'Browser' ? 'globe' : 'layout'} size={14} /></span><span><strong>{title}</strong><small>{id} · {type}</small></span><span className={state === 'Running' ? 'status-dot status-dot--live' : 'status-dot status-dot--offline'} /></button>)}</aside>
      <section className="computer-use-main">
        <header className="capability-head"><div><span className="eyebrow">Computer Use</span><h2>{current[1]}</h2><p>{current[2]} session · local presentation boundary</p></div><div className="capability-head__actions"><button className={recording ? 'studio-button studio-button--active' : 'studio-button'} type="button" onClick={() => setRecording((value) => !value)}><Icon name="activity" size={13} /> {recording ? 'Recording' : 'Record'}</button><button className="studio-button" type="button" onClick={() => onAction('Computer permission review opened in preview')}><Icon name="shield" size={13} /> Permissions</button></div></header>
        <div className="computer-toolbar"><button type="button" onClick={() => onAction('Back staged in preview')}><Icon name="chevron-left" size={13} /></button><button type="button" onClick={() => onAction('Refresh staged in preview')}><Icon name="history" size={13} /></button><span className="mono-text">https://localhost/preview</span><button type="button" onClick={() => onAction('Screenshot captured in preview')}><Icon name="archive" size={13} /> Screenshot</button></div>
        <div className="computer-screen"><div className="computer-screen__app"><div className="computer-screen__window-head"><strong>AgentiCOS test environment</strong><span>isolated preview</span></div><div className="computer-screen__body"><div className="computer-screen__sidebar">Files<br/>Terminal<br/>Browser<br/>Tests</div><div className="computer-screen__canvas"><div className="cursor-dot" /><div className="fake-button">Run verification</div><div className="fake-input">type here…</div></div></div></div></div>
        <div className="computer-action-log">{['navigate','screenshot','click @verify','read console','capture artifact'].map((item,index)=><div key={item}><span>{String(index+1).padStart(2,'0')}</span><strong>{item}</strong><small>{index === 4 ? 'ready' : 'recorded'}</small></div>)}</div>
      </section>
    </div>
  )
}
