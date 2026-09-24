import { useMemo, useState } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import Icon from './Icon'
import type { RailMode } from '../navigation'

type NotificationLevel = 'action' | 'info' | 'warning'

interface NotificationItem {
  id: string
  level: NotificationLevel
  title: string
  detail: string
  time: string
  route: RailMode
  read: boolean
}

const storageKey = 'agenticos.ui.notifications.read'

const seed: NotificationItem[] = [
  { id: 'apr-018', level: 'action', title: 'Approval requested', detail: 'A protected branch mutation is waiting for review.', time: '2m ago', route: 'approvals', read: false },
  { id: 'run-042', level: 'info', title: 'Verification complete', detail: 'The latest frontend evidence package is ready.', time: '14m ago', route: 'frontend-coverage', read: false },
  { id: 'prov-104', level: 'warning', title: 'Provider notice', detail: 'A model route reported a temporary availability change.', time: '31m ago', route: 'providers', read: true },
  { id: 'remote-042', level: 'info', title: 'Remote session', detail: 'A connected device returned to an idle state.', time: '1h ago', route: 'remote-control', read: true },
]

function readIds() {
  try {
    const raw = window.localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set<string>()
  }
}

function persistIds(ids: Set<string>) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify([...ids]))
  } catch {
    // Notification read state is optional presentation persistence.
  }
}

interface NotificationDrawerProps {
  open: boolean
  onClose: () => void
  onOpenCenter: () => void
  onNavigate: (mode: RailMode) => void
}

export default function NotificationDrawer({ open, onClose, onOpenCenter, onNavigate }: NotificationDrawerProps) {
  const [items, setItems] = useState<NotificationItem[]>(() => {
    const read = readIds()
    return seed.map((item) => read.has(item.id) ? { ...item, read: true } : item)
  })
  const [filter, setFilter] = useState<'All' | 'Unread' | 'Action'>('All')
  const dialogRef = useFocusTrap(open, null)

  const visible = useMemo(() => {
    if (filter === 'Unread') return items.filter((item) => !item.read)
    if (filter === 'Action') return items.filter((item) => item.level === 'action')
    return items
  }, [filter, items])

  const unreadCount = items.filter((item) => !item.read).length

  function markRead(id: string) {
    setItems((current) => {
      const next = current.map((item) => item.id === id ? { ...item, read: true } : item)
      const read = readIds()
      read.add(id)
      persistIds(read)
      return next
    })
  }

  function markAllRead() {
    setItems((current) => current.map((item) => ({ ...item, read: true })))
    const read = readIds()
    items.forEach((item) => read.add(item.id))
    persistIds(read)
  }

  if (!open) return null

  return (
    <div className="notification-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="notification-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-drawer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="notification-drawer__head">
          <div>
            <span className="eyebrow">Workspace attention</span>
            <h2 id="notification-drawer-title">Notifications</h2>
            <p>{unreadCount} unread · local presentation state</p>
          </div>
          <button className="icon-button" type="button" aria-label="Close notifications" onClick={onClose}><Icon name="x" size={15} /></button>
        </header>

        <div className="notification-drawer__filters" role="tablist" aria-label="Notification filters" aria-orientation="horizontal">
          {(['All', 'Unread', 'Action'] as const).map((item) => (
            <button key={item} type="button" role="tab" tabIndex={filter === item ? 0 : -1} aria-selected={filter === item} onClick={() => setFilter(item)}>
              {item}{item === 'Unread' && unreadCount > 0 ? ' ' + unreadCount : ''}
            </button>
          ))}
        </div>

        <div className="notification-drawer__list" role="list" aria-label="Notification list">
          {visible.length === 0 ? (
            <div className="notification-drawer__empty"><Icon name="check" size={18} /><strong>No notifications in this view</strong><span>Your attention inbox is clear.</span></div>
          ) : visible.map((item) => (
            <article className={item.read ? 'notification-item notification-item--read' : 'notification-item'} key={item.id}>
              <span className={'notification-item__icon notification-item__icon--' + item.level}><Icon name={item.level === 'action' ? 'shield' : item.level === 'warning' ? 'alert' : 'activity'} size={14} /></span>
              <button className="notification-item__body" type="button" onClick={() => { markRead(item.id); onNavigate(item.route); onClose() }}>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
                <small>{item.time}</small>
              </button>
              {!item.read && <button className="notification-item__read" type="button" aria-label={'Mark ' + item.title + ' as read'} title="Mark as read" onClick={() => markRead(item.id)}><Icon name="check" size={12} /></button>}
            </article>
          ))}
        </div>

        <footer className="notification-drawer__foot">
          <button className="soft-button" type="button" onClick={markAllRead} disabled={!unreadCount}>Mark all read</button>
          <button className="studio-button studio-button--active" type="button" onClick={() => { onClose(); onOpenCenter() }}>Open notification center</button>
        </footer>
      </section>
    </div>
  )
}
