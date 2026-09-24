import { useEffect, useRef } from 'react'
import Icon, { type IconName } from './Icon'
import { useExclusiveOverlay } from '../hooks/useExclusiveOverlay'
import { readUiPreferences, updateUiPreferences } from '../services/ui-preferences'

export interface ContextMenuState {
  x: number
  y: number
}

interface WorkspaceContextMenuProps {
  anchor: ContextMenuState
  onClose: () => void
  onCreateConversation: () => void
  onOpenPalette: () => void
  onOpenSettings: () => void
  onAction: (message: string) => void
}

interface MenuItem {
  id: string
  label: string
  icon: IconName
  dividerAfter?: boolean
  run: () => void
}

export default function WorkspaceContextMenu({ anchor, onClose, onCreateConversation, onOpenPalette, onOpenSettings, onAction }: WorkspaceContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  useExclusiveOverlay('context-menu', true, onClose)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const preferences = readUiPreferences()

  function toggleStatusbar() {
    const next = !preferences.statusBarVisible
    updateUiPreferences({ statusBarVisible: next })
    onAction(next ? 'Status bar shown' : 'Status bar hidden')
  }

  function toggleProfileBar() {
    const next = !preferences.leftSidebarVisible
    updateUiPreferences({ leftSidebarVisible: next })
    onAction(next ? 'Profile bar shown' : 'Profile bar hidden')
  }

  function toggleSessionTabs() {
    const next = !preferences.sessionTabsVisible
    updateUiPreferences({ sessionTabsVisible: next })
    onAction(next ? 'Session tabs shown' : 'Session tabs hidden')
  }

  const items: MenuItem[] = [
    { id: 'new-session', label: 'New session', icon: 'plus', run: onCreateConversation },
    { id: 'new-window', label: 'New window', icon: 'layout', run: () => onAction('New window opens through the desktop runtime') },
    { id: 'palette', label: 'Command palette', icon: 'command', dividerAfter: true, run: onOpenPalette },
    { id: 'statusbar', label: 'Toggle status bar', icon: 'panel-right', run: toggleStatusbar },
    { id: 'profilebar', label: 'Show or hide the profile bar', icon: 'panel-left', run: toggleProfileBar },
    { id: 'tabs', label: 'Show or hide session tabs', icon: 'copy', dividerAfter: true, run: toggleSessionTabs },
    { id: 'settings', label: 'Settings', icon: 'settings', run: onOpenSettings },
    { id: 'update', label: 'Update AgentiCOS', icon: 'cloud', run: () => onAction('Updates are managed by the desktop runtime') },
  ]

  const menuWidth = 258
  const left = Math.min(anchor.x, window.innerWidth - menuWidth - 10)
  const top = Math.min(anchor.y, window.innerHeight - 360)

  return (
    <div ref={menuRef} className="workspace-context-menu" role="menu" aria-label="Workspace context menu" style={{ left, top }}>
      {items.map((item) => (
        <div key={item.id}>
          <button type="button" role="menuitem" onClick={() => { onClose(); item.run() }}>
            <Icon name={item.icon} size={14} />
            <span>{item.label}</span>
          </button>
          {item.dividerAfter && <div className="workspace-context-menu__divider" aria-hidden="true" />}
        </div>
      ))}
    </div>
  )
}
