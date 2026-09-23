import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'

interface Shortcut {
  id: string
  command: string
  category: string
  key: string
}

const initialShortcuts: Shortcut[] = [
  { id: 'palette', command: 'Command Palette', category: 'Navigation', key: 'Ctrl+K' },
  { id: 'chat', command: 'New conversation', category: 'Chat', key: 'Ctrl+N' },
  { id: 'sidebar', command: 'Toggle sidebar', category: 'Workspace', key: 'Ctrl+B' },
  { id: 'dock', command: 'Toggle bottom dock', category: 'Workspace', key: 'Ctrl+J' },
  { id: 'find', command: 'Find in editor', category: 'Editor', key: 'Ctrl+F' },
  { id: 'save', command: 'Save', category: 'Editor', key: 'Ctrl+S' },
  { id: 'run', command: 'Run agent', category: 'Agent', key: 'Ctrl+Enter' },
  { id: 'stop', command: 'Stop agent', category: 'Agent', key: 'Esc' },
  { id: 'approve', command: 'Approve current action', category: 'Security', key: 'Ctrl+Y' },
]

const profiles = ['AgentiCOS', 'VS Code', 'Vim', 'Emacs']

export default function KeymapEditor() {
  const [shortcuts, setShortcuts] = useState(initialShortcuts)
  const [profile, setProfile] = useState(profiles[0])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState('')

  const normalized = query.trim().toLowerCase()
  const visible = useMemo(() => normalized
    ? shortcuts.filter((item) => [item.command, item.category, item.key].join(' ').toLowerCase().includes(normalized))
    : shortcuts, [normalized, shortcuts])

  const conflicts = useMemo(() => {
    const counts = shortcuts.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.key.toLowerCase()]: (acc[item.key.toLowerCase()] ?? 0) + 1 }), {})
    return new Set(Object.entries(counts).filter(([, count]) => count > 1).map(([key]) => key))
  }, [shortcuts])

  function setKey(id: string, key: string) {
    setShortcuts((current) => current.map((item) => item.id === id ? { ...item, key } : item))
    setEditing('')
  }

  function reset() {
    setShortcuts(initialShortcuts)
    setEditing('')
  }

  return (
    <div className="keymap-editor">
      <div className="keymap-editor__toolbar">
        <select value={profile} onChange={(event) => setProfile(event.target.value)} aria-label="Keymap profile">{profiles.map((item) => <option key={item}>{item}</option>)}</select>
        <label className="control-center-search"><Icon name="search" size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search commands…" /></label>
        <button type="button" className="studio-button" onClick={reset}><Icon name="refresh" size={13} /> Reset profile</button>
      </div>
      <div className="keymap-table">
        <div className="keymap-table__head"><span>Command</span><span>Category</span><span>Shortcut</span><span>State</span></div>
        {visible.map((item) => {
          const conflict = conflicts.has(item.key.toLowerCase())
          return <div className="keymap-row" key={item.id}><div><strong>{item.command}</strong><small>{item.id}</small></div><span>{item.category}</span>{editing === item.id ? <input autoFocus defaultValue={item.key} onKeyDown={(event) => { if (event.key === 'Enter') setKey(item.id, event.currentTarget.value); if (event.key === 'Escape') setEditing('') }} /> : <button type="button" className={conflict ? 'keycap keycap--conflict' : 'keycap'} onClick={() => setEditing(item.id)}>{item.key}</button>}<span className={conflict ? 'keymap-state keymap-state--conflict' : 'keymap-state'}>{conflict ? 'Conflict' : 'OK'}</span></div>
        })}
      </div>
    </div>
  )
}
