import type { AgentStatusSnapshot } from '../types/runtime'
import type { RailMode } from '../navigation'
import Icon from './Icon'
import { navigationItems } from '../navigation'

interface WorkspaceCommandStripProps {
  mode: RailMode
  status: AgentStatusSnapshot
  focusMode: boolean
  onToggleFocus: () => void
  onNavigate: (mode: RailMode) => void
  onAction: (message: string) => void
}

/* Keep shell orientation separate from runtime authority. */
export default function WorkspaceCommandStrip({ mode, status, focusMode, onToggleFocus, onNavigate, onAction }: WorkspaceCommandStripProps) {
  const surface = navigationItems.find((item) => item.id === mode)
  const connected = status.provider !== 'Runtime offline'

  return (
    <div className="workspace-command-strip" aria-label="Workspace context and quick controls">
      <div className="workspace-command-strip__left">
        <div className="workspace-context-chip workspace-context-chip--project">
          <span className="workspace-context-chip__icon"><Icon name="folder" size={12} /></span>
          <span><strong>AgentiCOS</strong><small>personal workspace</small></span>
        </div>
        <button className="workspace-context-chip" type="button" onClick={() => onAction('Project switcher opened in preview')} title="Current project">
          <span><Icon name="layers" size={12} /></span>
          <span><strong>agenticos</strong><small>current project</small></span>
          <Icon name="chevron-right" size={11} />
        </button>
        <button className="workspace-context-chip" type="button" onClick={() => onAction('Branch switcher opened in preview')} title="Current branch">
          <span><Icon name="git" size={12} /></span>
          <span><strong>main</strong><small>working tree</small></span>
        </button>
        <div className="workspace-context-chip workspace-context-chip--status" title="Runtime status">
          <span className={connected ? 'status-dot status-dot--live' : 'status-dot status-dot--offline'} />
          <span><strong>{connected ? 'Runtime online' : 'Runtime offline'}</strong><small>{status.state}</small></span>
        </div>
        <div className="workspace-context-chip workspace-context-chip--wide" title="Current surface">
          <span><Icon name={surface?.icon ?? 'home'} size={12} /></span>
          <span><strong>{surface?.label ?? 'Command Center'}</strong><small>{surface?.group ?? 'build'} surface</small></span>
        </div>
      </div>
      <div className="workspace-command-strip__right">
        <div className="workspace-command-strip__signal" aria-label="Workspace policy summary">
          <span className="workspace-signal-item"><Icon name="archive" size={12} /><strong>128k</strong><small>context policy</small></span>
          <span className="workspace-signal-item"><Icon name="check-circle" size={12} /><strong>3</strong><small>verification gates</small></span>
          <span className="workspace-signal-item"><Icon name="shield" size={12} /><strong>Guarded</strong><small>agent policy</small></span>
        </div>
        <button className={focusMode ? 'workspace-command-button workspace-command-button--active' : 'workspace-command-button'} type="button" onClick={onToggleFocus} title="Focus workspace · Ctrl/Cmd+Shift+Enter" aria-pressed={focusMode}>
          <Icon name={focusMode ? 'minimize' : 'maximize'} size={13} /> {focusMode ? 'Exit focus' : 'Focus'}
        </button>
        <button className="workspace-command-button" type="button" onClick={() => onNavigate('agent-mission')} title="Open Agent Mission Control"><Icon name="play" size={13} /> Mission</button>
        <button className="workspace-command-button" type="button" onClick={() => onNavigate('git-control')} title="Open Git Control Center"><Icon name="git" size={13} /> Git</button>
        <button className="workspace-command-button" type="button" onClick={() => onNavigate('remote-control')} title="Open Remote Control Center"><Icon name="cloud" size={13} /> Remote</button>
      </div>
    </div>
  )
}
