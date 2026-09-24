import { useMemo, useState } from 'react'
import type { AgentStatusSnapshot } from '../types/runtime'
import type { RailMode } from '../navigation'
import Icon from './Icon'

type DockTab = 'Terminal' | 'Problems' | 'Timeline' | 'Output'

interface WorkspaceDockProps {
  open: boolean
  mode: RailMode
  status: AgentStatusSnapshot
  running: boolean
  messageCount: number
  onClose: () => void
}

const timeline = [
  ['Planning', 'Scope, context and constraints resolved', 'done'],
  ['Approval', 'Policy gate checked before mutation', 'done'],
  ['Execution', 'Agent and tool activity is streamed here', 'active'],
  ['Verification', 'Tests, diff review and rollback evidence', 'pending'],
] as const

const problems = [
  ['P-104', 'Unverified browser visual pass', 'Workspace', 'warning'],
  ['P-117', 'Runtime endpoint not connected', 'Services', 'info'],
  ['P-121', 'Windows/Tauri rendering still pending', 'Desktop', 'info'],
] as const

export default function WorkspaceDock({ open, mode, status, running, messageCount, onClose }: WorkspaceDockProps) {
  const [tab, setTab] = useState<DockTab>('Timeline')
  const [maximized, setMaximized] = useState(false)
  const [terminalInput, setTerminalInput] = useState('')
  const [terminalLines, setTerminalLines] = useState<string[]>([
    'AgentiCOS terminal preview',
    'No process is attached to this UI-only surface.',
    'Type "help" for available preview commands.',
  ])

  const runStateLabel = useMemo(() => status.state.replace('-', ' '), [status.state])

  if (!open) return null

  function runPreviewCommand() {
    const command = terminalInput.trim()
    if (!command) return
    const output = command === 'help'
      ? ['help          list preview commands', 'status        show agent/session status', 'clear         clear terminal']
      : command === 'status'
        ? [
            'agent         ' + status.agentName,
            'state         ' + runStateLabel,
            'provider      ' + status.provider,
            'model         ' + status.model,
          ]
        : command === 'clear'
          ? []
          : ['preview      command "' + command + '" not connected to runtime']

    setTerminalLines((current) => command === 'clear' ? [] : [...current, '$ ' + command, ...output])
    setTerminalInput('')
  }

  return (
    <section className={'workspace-dock ' + (maximized ? 'workspace-dock--maximized' : '')} aria-label="Workspace bottom dock">
      <header className="workspace-dock__header">
        <div className="workspace-dock__tabs" role="tablist" aria-label="Workspace dock">
          {(['Terminal', 'Problems', 'Timeline', 'Output'] as DockTab[]).map((item) => (
            <button
              key={item}
              className={tab === item ? 'workspace-dock__tab workspace-dock__tab--active' : 'workspace-dock__tab'}
              type="button"
              role="tab"
              aria-selected={tab === item}
              aria-controls={'workspace-dock-panel-' + item.toLowerCase()}
              id={'workspace-dock-tab-' + item.toLowerCase()}
              onClick={() => setTab(item)}
            >
              <Icon name={item === 'Terminal' ? 'terminal' : item === 'Problems' ? 'shield' : item === 'Timeline' ? 'activity' : 'archive'} size={13} />
              {item}
              {item === 'Problems' && <span className="workspace-dock__count">3</span>}
              {item === 'Output' && <span className="workspace-dock__count">{messageCount}</span>}
            </button>
          ))}
        </div>
        <div className="workspace-dock__meta">
          <span className="dock-context"><Icon name="folder" size={12} /> {mode}</span>
          <span className="dock-context"><span className={running ? 'status-dot status-dot--live' : 'status-dot status-dot--offline'} /> {runStateLabel}</span>
          <button className="icon-button" type="button" aria-label={maximized ? 'Restore dock size' : 'Maximize dock'} title={maximized ? 'Restore dock' : 'Maximize dock'} onClick={() => setMaximized((value) => !value)}>
            <Icon name={maximized ? 'minimize' : 'maximize'} size={14} />
          </button>
          <button className="icon-button" type="button" aria-label="Close bottom dock" title="Close dock" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>
      </header>

      <div className="workspace-dock__body">
        {tab === 'Terminal' && (
          <div id="workspace-dock-panel-terminal" className="dock-terminal" role="tabpanel" aria-labelledby="workspace-dock-tab-terminal" tabIndex={0}>
            <div className="dock-terminal__output">
              {terminalLines.map((line, index) => <div className={line.startsWith('$') ? 'dock-terminal__command' : ''} key={index}>{line || ' '}</div>)}
            </div>
            <form className="dock-terminal__input" onSubmit={(event) => { event.preventDefault(); runPreviewCommand() }}>
              <span>$</span>
              <input value={terminalInput} onChange={(event) => setTerminalInput(event.target.value)} aria-label="Terminal command" placeholder="Type a preview command…" />
              <kbd>Enter</kbd>
            </form>
          </div>
        )}

        {tab === 'Problems' && (
          <div id="workspace-dock-panel-problems" className="dock-problems" role="tabpanel" aria-labelledby="workspace-dock-tab-problems" tabIndex={0}>
            <div className="dock-section-heading"><span>Problems</span><span className="mono-text">frontend evidence</span></div>
            {problems.map(([id, title, area, level]) => (
              <button className="dock-problem-row" type="button" key={id}>
                <span className={'dock-problem-icon dock-problem-icon--' + level}>{level === 'warning' ? '!' : 'i'}</span>
                <span className="dock-problem-copy"><strong>{title}</strong><small>{id} · {area}</small></span>
                <Icon name="chevron-right" size={13} />
              </button>
            ))}
          </div>
        )}

        {tab === 'Timeline' && (
          <div id="workspace-dock-panel-timeline" className="dock-timeline" role="tabpanel" aria-labelledby="workspace-dock-tab-timeline" tabIndex={0}>
            <div className="dock-section-heading"><span>Agent lifecycle</span><span className="mono-text">preview trace</span></div>
            <div className="dock-timeline-grid">
              {timeline.map(([title, detail, state], index) => (
                <div className={'dock-timeline-step dock-timeline-step--' + state} key={title}>
                  <div className="dock-timeline-step__marker">{state === 'done' ? <Icon name="check" size={12} /> : state === 'active' ? <Icon name="play" size={10} /> : <span>{index + 1}</span>}</div>
                  <div><strong>{title}</strong><small>{detail}</small></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'Output' && (
          <div id="workspace-dock-panel-output" className="dock-output" role="tabpanel" aria-labelledby="workspace-dock-tab-output" tabIndex={0}>
            <div className="dock-section-heading"><span>Session output</span><span className="mono-text">{messageCount} messages</span></div>
            <div className="dock-output__grid">
              <div><span>Current session</span><strong>Connected UI surface</strong><small>{messageCount} visible messages</small></div>
              <div><span>Agent</span><strong>{status.agentName}</strong><small>{status.state}</small></div>
              <div><span>Model</span><strong>{status.model}</strong><small>{status.provider}</small></div>
              <div><span>Transport</span><strong>Service boundary</strong><small>Runtime-owned</small></div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}