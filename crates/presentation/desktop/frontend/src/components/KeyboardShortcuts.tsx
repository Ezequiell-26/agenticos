import { useEffect, useRef } from 'react'
import Icon from './Icon'
import './KeyboardShortcuts.css'

interface KeyboardShortcutsProps {
  open: boolean
  onClose: () => void
}

const groups = [
  {
    title: 'Workspace',
    items: [
      ['⌘ / Ctrl + K', 'Open command palette'],
      ['⌘ / Ctrl + Shift + F', 'Global search'],
      ['⌘ / Ctrl + Shift + Enter', 'Toggle focus mode'],
      ['⌘ / Ctrl + B', 'Toggle workspace sidebar'],
      ['⌘ / Ctrl + Shift + B', 'Toggle agent panel'],
      ['⌘ / Ctrl + J', 'Toggle bottom dock'],
    ],
  },
  {
    title: 'Navigation',
    items: [
      ['⌘ / Ctrl + 1…9', 'Jump to primary workspace'],
      ['?', 'Open keyboard shortcuts'],
      ['Esc', 'Close active overlay'],
    ],
  },
  {
    title: 'Interaction',
    items: [
      ['↑ / ↓', 'Move through lists and command results'],
      ['Enter', 'Open selected item'],
      ['Shift + Enter', 'Preserve focus while acting'],
    ],
  },
] as const

export default function KeyboardShortcuts({ open, onClose }: KeyboardShortcutsProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="shortcuts-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-dialog-title"
        aria-describedby="shortcuts-dialog-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="shortcuts-dialog__head">
          <div>
            <span className="eyebrow">Workspace controls</span>
            <h2 id="shortcuts-dialog-title">Keyboard shortcuts</h2>
            <p id="shortcuts-dialog-description">Primary AgentiCOS controls available from anywhere in the desktop workspace.</p>
          </div>
          <button ref={closeRef} className="icon-button" type="button" aria-label="Close keyboard shortcuts" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="shortcuts-dialog__body">
          {groups.map((group) => (
            <section className="shortcut-group" key={group.title} aria-labelledby={group.title.replace(/\s/g, '-').toLowerCase()}>
              <div className="shortcut-group__head">
                <strong id={group.title.replace(/\s/g, '-').toLowerCase()}>{group.title}</strong>
                <span className="mono-text">{group.items.length} shortcuts</span>
              </div>
              <div className="shortcut-group__items">
                {group.items.map(([shortcut, detail]) => (
                  <div className="shortcut-row" key={shortcut + detail}>
                    <kbd>{shortcut}</kbd>
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="shortcuts-dialog__foot">
          <span><Icon name="shield" size={12} /> Shortcuts never execute runtime operations by themselves.</span>
          <button className="studio-button studio-button--active" type="button" onClick={onClose}>Done</button>
        </footer>
      </section>
    </div>
  )
}
