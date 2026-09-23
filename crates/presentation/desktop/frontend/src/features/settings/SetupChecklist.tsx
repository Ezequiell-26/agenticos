import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'

interface SetupItem {
  id: string
  title: string
  detail: string
  state: 'Ready' | 'Needs setup' | 'Optional'
}

const initialItems: SetupItem[] = [
  { id: 'workspace', title: 'Workspace', detail: 'Project folder detected and ready.', state: 'Ready' },
  { id: 'runtime', title: 'Runtime', detail: 'Rust/Tauri runtime boundary available.', state: 'Ready' },
  { id: 'provider', title: 'Provider', detail: 'Connect at least one model provider.', state: 'Needs setup' },
  { id: 'permissions', title: 'Permissions', detail: 'Review project execution policy.', state: 'Ready' },
  { id: 'browser', title: 'Browser', detail: 'Optional browser automation backend.', state: 'Optional' },
  { id: 'mcp', title: 'MCP', detail: 'Optional external tools and resources.', state: 'Optional' },
  { id: 'voice', title: 'Voice', detail: 'Optional TTS/STT and media configuration.', state: 'Optional' },
]

export default function SetupChecklist() {
  const [items, setItems] = useState(initialItems)
  const ready = useMemo(() => items.filter((item) => item.state === 'Ready').length, [items])
  const required = items.filter((item) => item.state !== 'Optional').length
  const completeRequired = items.filter((item) => item.state === 'Ready').length
  const percent = Math.round((completeRequired / required) * 100)

  function markReady(id: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, state: 'Ready' } : item))
  }

  return (
    <div className="setup-checklist">
      <div className="setup-checklist__summary">
        <div><span>Setup</span><strong>{percent}%</strong></div>
        <div><span>Ready</span><strong>{ready}</strong></div>
        <div><span>Required</span><strong>{required}</strong></div>
      </div>
      <div className="setup-checklist__progress"><span style={{ width: percent + '%' }} /></div>
      <div className="setup-checklist__list">
        {items.map((item) => (
          <div className="setup-checklist__row" key={item.id}>
            <span className={item.state === 'Ready' ? 'setup-check setup-check--ready' : 'setup-check'}>
              {item.state === 'Ready' ? <Icon name="check" size={11} /> : <span />}
            </span>
            <div><strong>{item.title}</strong><small>{item.detail}</small></div>
            <span className={item.state === 'Ready' ? 'state-pill state-pill--completed' : item.state === 'Needs setup' ? 'state-pill state-pill--pending' : 'state-pill'}>{item.state}</span>
            {item.state === 'Needs setup' && <button type="button" className="studio-button" onClick={() => markReady(item.id)}>Mark configured</button>}
          </div>
        ))}
      </div>
    </div>
  )
}
