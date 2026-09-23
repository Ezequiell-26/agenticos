import { useState } from 'react'
import Icon from '../../components/Icon'

type CanvasTab = 'Canvas' | 'Preview' | 'Code' | 'History'

const templates = [
  ['agent-map', 'Agent architecture map', 'Workflow graph'],
  ['ui-board', 'UI concept board', 'Interactive React artifact'],
  ['research', 'Research canvas', 'Sources + synthesis'],
  ['runbook', 'Execution runbook', 'Steps + evidence'],
] as const

export default function CanvasStudio({ onAction }: { onAction: (message: string) => void }) {
  const [selected, setSelected] = useState(templates[0][0])
  const [tab, setTab] = useState<CanvasTab>('Canvas')
  const [draft, setDraft] = useState('Map the current AgentiCOS workflow from request to verified handoff.')
  const current = templates.find((item) => item[0] === selected) ?? templates[0]

  return (
    <div className="capability-studio">
      <aside className="capability-list">
        <div className="capability-list__head"><span>Canvases</span><span className="count-pill">{templates.length}</span></div>
        {templates.map(([id, title, detail]) => <button key={id} type="button" className={selected === id ? 'capability-row capability-row--active' : 'capability-row'} onClick={() => setSelected(id)}><span className="capability-icon"><Icon name="layout" size={14} /></span><span><strong>{title}</strong><small>{detail}</small></span><Icon name="chevron-right" size={12} /></button>)}
        <button className="studio-button" type="button" onClick={() => onAction('New canvas created in preview')}><Icon name="plus" size={13} /> New canvas</button>
      </aside>
      <section className="capability-main">
        <header className="capability-head"><div><span className="eyebrow">Interactive artifact</span><h2>{current[1]}</h2><p>{current[2]} · local presentation preview</p></div><div className="capability-head__actions"><button className="studio-button" type="button" onClick={() => onAction('Canvas attached to chat in preview')}><Icon name="message" size={13} /> Attach</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Canvas checkpoint staged in preview')}><Icon name="git" size={13} /> Checkpoint</button></div></header>
        <div className="capability-tabs" role="tablist" aria-label="Canvas views">{(['Canvas','Preview','Code','History'] as CanvasTab[]).map((item) => <button type="button" key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'capability-tab capability-tab--active' : 'capability-tab'} onClick={() => setTab(item)}>{item}</button>)}</div>
        <div className="capability-content">
          {tab === 'Canvas' && <div className="canvas-workspace"><div className="canvas-toolbar"><span>Drag-ready workspace</span><span className="mono-text">artifact://{current[0]}</span></div><div className="canvas-grid"><div className="canvas-card canvas-card--primary"><span className="eyebrow">Input</span><strong>User goal</strong><small>Request → context</small></div><div className="canvas-connector" /><div className="canvas-card"><span className="eyebrow">Agent</span><strong>Planner</strong><small>Plan + delegate</small></div><div className="canvas-connector" /><div className="canvas-card"><span className="eyebrow">Verification</span><strong>Review</strong><small>Checks + evidence</small></div></div><label className="capability-field"><span>Canvas instruction</span><textarea value={draft} onChange={(event) => setDraft(event.target.value)} /></label></div>}
          {tab === 'Preview' && <div className="canvas-preview"><div className="canvas-preview__hero"><span className="eyebrow">Preview surface</span><strong>{current[1]}</strong><p>Interactive React artifacts can render beside a conversation in the future runtime.</p><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Preview refreshed in preview')}><Icon name="history" size={13} /> Refresh preview</button></div></div>}
          {tab === 'Code' && <pre className="code-preview">{'export function CanvasArtifact() {\\n  return <AgentWorkflow />\\n}'}</pre>}
          {tab === 'History' && <div className="history-list">{['v4 · current','v3 · layout pass','v2 · context pass','v1 · initial'].map((item) => <button type="button" key={item} onClick={() => onAction(item + ' opened in preview')}><span>{item}</span><Icon name="chevron-right" size={12} /></button>)}</div>}
        </div>
      </section>
    </div>
  )
}
