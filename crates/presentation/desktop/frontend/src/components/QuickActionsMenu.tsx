import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import type { RailMode } from '../navigation'

interface QuickActionsMenuProps {
  onCreateConversation: () => void
  onSelectMode: (mode: RailMode) => void
}

type QuickAction = {
  id: string
  label: string
  detail: string
  icon: 'message' | 'check' | 'bot' | 'clock' | 'arrow-down' | 'spark'
}

const actions: QuickAction[] = [
  { id: 'conversation', label: 'New conversation', detail: 'Start a clean agent session', icon: 'message' },
  { id: 'task', label: 'New task', detail: 'Define an objective and dependencies', icon: 'check' },
  { id: 'agent', label: 'New agent', detail: 'Create a specialist agent profile', icon: 'bot' },
  { id: 'workflow', label: 'New workflow', detail: 'Design an automation flow', icon: 'clock' },
  { id: 'import', label: 'Import package', detail: 'Bring rules, context or sessions', icon: 'arrow-down' },
]

export default function QuickActionsMenu({ onCreateConversation, onSelectMode }: QuickActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function run(action: QuickAction) {
    setOpen(false)
    if (action.id === 'conversation') onCreateConversation()
    else if (action.id === 'task') onSelectMode('tasks')
    else if (action.id === 'agent') onSelectMode('agents')
    else if (action.id === 'workflow') onSelectMode('workflows')
    else if (action.id === 'import') onSelectMode('imports')
  }

  return (
    <div className="quick-actions-wrap" ref={menuRef}>
      <button className={open ? 'soft-button soft-button--active' : 'soft-button'} type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="quick-actions-menu" aria-haspopup="menu">
        <Icon name="plus" size={14} /> Create
      </button>
      {open && (
        <div className="quick-actions-menu" id="quick-actions-menu" role="menu">
          <div className="quick-actions-menu__head"><span className="eyebrow">Quick actions</span><strong>Workspace</strong></div>
          {actions.map((action) => (
            <button key={action.id} type="button" role="menuitem" onClick={() => run(action)}>
              <span className="quick-actions-menu__icon"><Icon name={action.icon} size={14} /></span>
              <span><strong>{action.label}</strong><small>{action.detail}</small></span>
              <Icon name="chevron-right" size={12} />
            </button>
          ))}
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onSelectMode('settings') }}>
            <span className="quick-actions-menu__icon"><Icon name="settings" size={14} /></span>
            <span><strong>Open settings</strong><small>Configure the workspace</small></span>
            <Icon name="chevron-right" size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
