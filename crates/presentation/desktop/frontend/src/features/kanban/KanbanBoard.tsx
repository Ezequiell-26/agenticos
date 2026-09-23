import { useState } from 'react'
import Icon from '../../components/Icon'

type Column = 'Backlog' | 'Ready' | 'In progress' | 'Review' | 'Done'
const seed: Record<Column,string[]> = {
  Backlog: ['Design import flow','Audit provider quotas'],
  Ready: ['Add browser smoke test','Create release checklist'],
  'In progress': ['Frontend capability map','Chat recovery polish'],
  Review: ['Security posture panel'],
  Done: ['Central navigation registry'],
}

export default function KanbanBoard({ onAction }: { onAction: (message: string) => void }) {
  const [columns, setColumns] = useState(seed)
  const [active, setActive] = useState('Frontend capability map')
  const move = (from: Column, to: Column, title: string) => {
    if (from === to) return
    setColumns((current) => {
      const next = {...current, [from]: current[from].filter((item) => item !== title), [to]: [...current[to], title]}
      return next
    })
    onAction(title + ' moved to ' + to + ' in preview')
  }
  const locations = Object.entries(columns) as [Column,string[]][]
  return (
    <div className="kanban-board"><header className="capability-head"><div><span className="eyebrow">Work management</span><h2>Kanban</h2><p>Agent-owned tasks, dependencies, handoffs and review state.</p></div><button className="studio-button studio-button--active" type="button" onClick={() => onAction('New kanban task opened in preview')}><Icon name="plus" size={13} /> Add task</button></header><div className="kanban-columns">{locations.map(([column,items])=><section key={column} className="kanban-column"><div className="kanban-column__head"><strong>{column}</strong><span>{items.length}</span></div>{items.map((item)=><button type="button" key={item} className={active===item ? 'kanban-card kanban-card--active' : 'kanban-card'} onClick={() => setActive(item)}><strong>{item}</strong><small>{column === 'In progress' ? 'Builder · active run' : column === 'Review' ? 'Reviewer · awaiting result' : 'Task · agent-ready'}</small><span>{column !== 'Done' && <Icon name="chevron-right" size={12} />}</span></button>)}{column !== 'Done' && items.length > 0 && <button className="kanban-move" type="button" onClick={() => move(column, column === 'Backlog' ? 'Ready' : column === 'Ready' ? 'In progress' : column === 'In progress' ? 'Review' : 'Done', items[0])}>Move next</button>}</section>)}</div></div>
  )
}
