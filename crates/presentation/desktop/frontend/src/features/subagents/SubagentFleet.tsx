import { useState } from 'react'
import Icon from '../../components/Icon'

const subagents = [
  ['code-search', 'Code Searcher', 'GPT-5.4 Mini', 'Research', 'Ready'],
  ['reviewer', 'Security Reviewer', 'GPT-5.4', 'Review', 'Ready'],
  ['tester', 'Test Engineer', 'Qwen3 Coder', 'Execution', 'Running'],
  ['researcher', 'Web Researcher', 'DeepSeek', 'Web', 'Idle'],
] as const

export default function SubagentFleet({ onAction }: { onAction: (message: string) => void }) {
  const [selected, setSelected] = useState(subagents[0][0])
  const current = subagents.find((item) => item[0] === selected) ?? subagents[0]
  return (
    <div className="subagent-fleet">
      <aside className="subagent-fleet__list">
        <div className="capability-list__head"><span>Subagents</span><span className="count-pill">{subagents.length}</span></div>
        {subagents.map(([id, name, model, task, state]) => <button type="button" key={id} className={selected === id ? 'capability-row capability-row--active' : 'capability-row'} onClick={() => setSelected(id)}><span className="capability-icon"><Icon name="bot" size={14} /></span><span><strong>{name}</strong><small>{model} · {task}</small></span><span className={state === 'Running' ? 'status-dot status-dot--live' : 'status-dot status-dot--offline'} /></button>)}
        <button className="studio-button studio-button--active" type="button" onClick={() => onAction('New subagent builder opened in preview')}><Icon name="plus" size={13} /> New subagent</button>
      </aside>
      <section className="subagent-fleet__main">
        <header className="capability-head"><div><span className="eyebrow">Isolated context window</span><h2>{current[1]}</h2><p>{current[3]} specialist · {current[2]}</p></div><div className="capability-head__actions"><button className="studio-button" type="button" onClick={() => onAction('Subagent message sent in preview')}><Icon name="message" size={13} /> Message</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Subagent started in preview')}><Icon name="play" size={13} /> Run</button></div></header>
        <div className="subagent-overview-grid"><div className="metric-card"><span>Context</span><strong>18.2k</strong><small>isolated window</small></div><div className="metric-card"><span>Toolset</span><strong>Research</strong><small>scoped access</small></div><div className="metric-card"><span>Model</span><strong>{current[2]}</strong><small>configured per agent</small></div><div className="metric-card"><span>State</span><strong>{current[4]}</strong><small>parent task remains active</small></div></div>
        <section className="surface-block"><div className="surface-block__heading"><span>Parallel workstreams</span><span className="mono-text">3 planned</span></div><div className="subagent-streams">{['Repository map','Security pass','Test plan'].map((item,index)=><div key={item}><span>{String(index+1).padStart(2,'0')}</span><strong>{item}</strong><small>{index===1?'Awaiting result':'In progress'}</small></div>)}</div></section>
        <div className="platform-actions"><button className="studio-button" type="button" onClick={() => onAction('Subagent context opened in preview')}>Inspect context</button><button className="studio-button" type="button" onClick={() => onAction('Subagent tool policy opened in preview')}><Icon name="shield" size={13} /> Tool policy</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Handoff prepared in preview')}><Icon name="branch" size={13} /> Handoff</button></div>
      </section>
    </div>
  )
}
