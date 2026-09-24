
import { useState } from 'react'
import type { AgentStatusSnapshot } from '../types/runtime'
import Icon from './Icon'
import PanelResizeHandle from './PanelResizeHandle'

type AgentTab = 'Agent' | 'Context' | 'Task' | 'Safety'

interface AgentPanelProps {
  status: AgentStatusSnapshot
  running: boolean
  onRun: () => void
  onStop: () => void
}

const contextItems = [
  ['Workspace files', '42.8k', 'Included'],
  ['Open files', '8.4k', 'Included'],
  ['Project rules', '3.2k', 'Included'],
  ['Pinned memory', '2.7k', 'Included'],
]

const taskSteps = [
  ['Interpret objective', 'Complete'],
  ['Assemble context', 'Complete'],
  ['Plan changes', 'Complete'],
  ['Execute tools', 'Running'],
  ['Verify result', 'Queued'],
]

export default function AgentPanel({ status, running, onRun, onStop }: AgentPanelProps) {
  const [tab, setTab] = useState<AgentTab>('Agent')
  const connected = status.provider !== 'Runtime offline'

  return (
    <aside className="agent-panel">
      <PanelResizeHandle axis="inspector" />
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Agent inspector</div>
          <h2>{status.agentName}</h2>
        </div>
        <div className="agent-presence" title={connected ? 'Runtime connected' : 'Runtime offline'}>
          <span className={connected ? 'status-dot status-dot--live' : 'status-dot status-dot--offline'} />
        </div>
      </div>

      <div className="agent-tabs" role="tablist" aria-label="Agent inspector" aria-orientation="horizontal">
        {(['Agent', 'Context', 'Task', 'Safety'] as AgentTab[]).map((item, index, tabs) => (
          <button key={item} id={'agent-tab-' + item.toLowerCase()} type="button" role="tab" tabIndex={tab === item ? 0 : -1} aria-selected={tab === item} aria-controls={'agent-panel-' + item.toLowerCase()} className={tab === item ? 'agent-tab agent-tab--active' : 'agent-tab'} onClick={() => setTab(item)} onKeyDown={(event) => {
            const currentIndex = tabs.indexOf(item)
            const nextIndex = event.key === 'ArrowRight'
              ? (currentIndex + 1) % tabs.length
              : event.key === 'ArrowLeft'
                ? (currentIndex - 1 + tabs.length) % tabs.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
            if (nextIndex >= 0) {
              event.preventDefault()
              const next = tabs[nextIndex]
              setTab(next)
              window.requestAnimationFrame(() => document.getElementById('agent-tab-' + next.toLowerCase())?.focus())
            }
          }}>
            {item}
          </button>
        ))}
      </div>

      {tab === 'Agent' && (
        <div id="agent-panel-agent" className="agent-tabpanel" role="tabpanel" aria-labelledby="agent-tab-agent" tabIndex={0}>
          <div className="agent-card agent-card--hero">
            <div className="agent-card__topline">
              <span className="live-label"><span className="live-pulse" />{running ? 'Working' : 'Ready'}</span>
              <span className="mono-text">{status.state}</span>
            </div>
            <div className="agent-orb" aria-hidden="true"><span className="orb-core" /></div>
            <div className="agent-card__identity"><strong>Builder</strong><span>Implementation specialist</span></div>
            <div className="agent-card__metrics">
              <div><span>Provider</span><strong>{status.provider}</strong></div>
              <div><span>Model</span><strong>{status.model}</strong></div>
            </div>
            <button className={running ? 'run-button run-button--stop' : 'run-button'} onClick={running ? onStop : onRun} type="button">
              <Icon name={running ? 'stop' : 'play'} size={15} />
              {running ? 'Stop session' : 'Open run mode'}
            </button>
          </div>
          <div className="panel-section">
            <div className="panel-section__heading"><span>Operating profile</span><span className="mono-text">Builder</span></div>
            <div className="profile-mini-grid"><span>Planning</span><span>Tools</span><span>Verification</span><span>Handoff</span></div>
          </div>
          <div className="panel-section">
            <div className="panel-section__heading"><span>Runtime signal</span><span className="mono-text">{status.latencyMs ? status.latencyMs + ' ms' : 'offline'}</span></div>
            <div className="context-meter"><span style={{ width: status.latencyMs ? '10%' : '0%' }} /></div>
            <div className="context-foot"><span>{status.latencyMs ? 'Signal received' : 'Awaiting runtime telemetry'}</span><span>UI does not invent usage</span></div>
          </div>
        </div>
      )}

      {tab === 'Context' && (
        <div id="agent-panel-context" className="agent-tabpanel" role="tabpanel" aria-labelledby="agent-tab-context" tabIndex={0}>
          <div className="panel-section">
            <div className="panel-section__heading"><span>Context pack</span><span className="mono-text">62.2k est.</span></div>
            <div className="agent-context-meter"><div className="context-meter"><span style={{ width: '72%' }} /></div><div><span>72% used</span><strong>23.4k free</strong></div></div>
          </div>
          <div className="panel-section">
            <div className="panel-section__heading"><span>Sources</span><Icon name="archive" size={14} /></div>
            <div className="agent-context-list">{contextItems.map(([name, tokens, state]) => <div key={name}><div><strong>{name}</strong><small>{state}</small></div><span className="mono-text">{tokens}</span></div>)}</div>
          </div>
          <div className="panel-section">
            <div className="panel-section__heading"><span>Memory policy</span><span className="mono-text">Pinned first</span></div>
            <div className="callout"><Icon name="history" size={13} /><span>Relevant memory is surfaced before optional history and web sources.</span></div>
          </div>
        </div>
      )}

      {tab === 'Task' && (
        <div id="agent-panel-task" className="agent-tabpanel" role="tabpanel" aria-labelledby="agent-tab-task" tabIndex={0}>
          <div className="agent-task-card><span className="eyebrow">Current objective</span><strong>Complete the current frontend slice without breaking existing contracts.</strong><span>Task TASK-104 · P1 · Builder</span></div>
          <div className="panel-section">
            <div className="panel-section__heading"><span>Execution steps</span><span className="mono-text">{running ? 'active' : 'preview'}</span></div>
            <div className="agent-task-list">{taskSteps.map(([name, state], index) => <div key={name}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{name}</strong><small>{state}</small></div><Icon name={state === 'Complete' ? 'check' : state === 'Running' ? 'activity' : 'clock'} size={12} /></div>)}</div>
          </div>
        </div>
      )}

      {tab === 'Safety' && (
        <div id="agent-panel-safety" className="agent-tabpanel" role="tabpanel" aria-labelledby="agent-tab-safety" tabIndex={0}>
          <div className="safety-banner><Icon name="shield" size={17} /><div><strong>Protected workspace</strong><small>Presentation-only safety indicators. Runtime authorization remains external to this component.</small></div><span>ACTIVE</span></div>
          <div className="panel-section">
            <div className="panel-section__heading"><span>Guardrails</span><Icon name="shield" size={15} /></div>
            <div className="guardrail-list">
              <div><Icon name="check" size={14} /><span>Scoped file changes</span></div>
              <div><Icon name="check" size={14} /><span>Secrets isolated</span></div>
              <div><Icon name="check" size={14} /><span>Destructive actions blocked</span></div>
              <div><Icon name="check" size={14} /><span>Human approval before risky tools</span></div>
            </div>
          </div>
          <div className="panel-section">
            <div className="panel-section__heading"><span>Permission tiers</span><span className="mono-text">fail-closed</span></div>
            <div className="permission-mini-list"><span>Read <strong>Auto</strong></span><span>Write <strong>Confirm</strong></span><span>Network <strong>Confirm</strong></span><span>Destructive <strong>Block</strong></span></div>
          </div>
        </div>
      )}
    </aside>
  )
}
