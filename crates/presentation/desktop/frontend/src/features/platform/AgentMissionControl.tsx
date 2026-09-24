import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { MetricCard, Panel, Tag } from './PlatformPrimitives'

type AgentMode = 'Plan' | 'Ask' | 'Code' | 'Debug' | 'Research' | 'Review' | 'Release'
type Isolation = 'Current workspace' | 'Git worktree' | 'Cloud environment'
type ContextPreset = 'Focused' | 'Balanced' | 'Deep' | 'Grounded'
type ApprovalProfile = 'Guarded' | 'Interactive' | 'Autonomous-safe' | 'Release-strict'
type VerificationProfile = 'Targeted' | 'Full suite' | 'Release gate'
type MissionStatus = 'Draft' | 'Ready' | 'Queued' | 'Running' | 'Blocked'

const modes: Array<[AgentMode, string, string]> = [
  ['Plan', 'Read-only decomposition', 'Architecture, scope, dependencies'],
  ['Ask', 'Read-only investigation', 'Explain code without mutations'],
  ['Code', 'Implementation', 'Edit, test and iterate'],
  ['Debug', 'Evidence-first diagnosis', 'Trace, reproduce, isolate'],
  ['Research', 'External evidence', 'Web, docs and repository sources'],
  ['Review', 'Quality gate', 'Diff, risks, tests and regressions'],
  ['Release', 'Release operator', 'Gates, evidence and rollback'],
]

const routes = [
  ['Auto Route', 'Policy chooses provider/model based on task'],
  ['Fast', 'Latency-first route for lightweight turns'],
  ['Reasoning', 'Deep reasoning route for complex tasks'],
  ['Local', 'Local or private provider boundary'],
]

const toolGroups = [
  ['Read', 'Files, search, symbols', true],
  ['Edit', 'Patches and file writes', true],
  ['Command', 'Terminal and build commands', false],
  ['Browser', 'Browser automation and visual checks', true],
  ['MCP', 'External tool servers', false],
] as const

const verification = [
  ['Scope resolved', 'Project + task boundaries sealed', 'done'],
  ['Policy checked', 'Permissions and approval rules evaluated', 'done'],
  ['Worktree isolated', 'Parallel changes protected from main workspace', 'ready'],
  ['Tests planned', 'Target checks selected from task intent', 'ready'],
  ['Evidence package', 'Diff + logs + screenshots + test results', 'queued'],
]

const contextSources = ['Repository map', 'Project rules', 'Git diff', 'Pinned memory', 'Prior sessions', 'Web sources']

export function AgentMissionControl({ onAction }: { onAction: (message: string) => void }) {
  const [mode, setMode] = useState<AgentMode>('Code')
  const [route, setRoute] = useState('Auto Route')
  const [isolation, setIsolation] = useState<Isolation>('Git worktree')
  const [contextPreset, setContextPreset] = useState<ContextPreset>('Balanced')
  const [parallel, setParallel] = useState(false)
  const [schedule, setSchedule] = useState(false)
  const [selectedModel, setSelectedModel] = useState('Qwen3 Coder')
  const [query, setQuery] = useState('Implement the next frontend slice and verify it without regressing existing surfaces.')
  const [missionName, setMissionName] = useState('Frontend modernization')
  const [approvalProfile, setApprovalProfile] = useState<ApprovalProfile>('Guarded')
  const [verificationProfile, setVerificationProfile] = useState<VerificationProfile>('Full suite')
  const [maxTurns, setMaxTurns] = useState(48)
  const [timeLimit, setTimeLimit] = useState(30)
  const [costLimit, setCostLimit] = useState(4)
  const [missionStatus, setMissionStatus] = useState<MissionStatus>('Draft')
  const [enabledContextSources, setEnabledContextSources] = useState<string[]>(contextSources.slice(0, 4))

  const activeMode = useMemo(() => modes.find(([id]) => id === mode) ?? modes[2], [mode])

  function preview(action: string) {
    onAction(action + ' staged in preview')
  }

  function toggleContextSource(source: string) {
    setEnabledContextSources((current) => current.includes(source) ? current.filter((item) => item !== source) : [...current, source])
  }

  function runPreflight() {
    setMissionStatus(query.trim().length >= 24 ? 'Ready' : 'Blocked')
    preview('Preflight evaluation')
  }

  function launchMission() {
    const next: MissionStatus = schedule ? 'Queued' : 'Running'
    setMissionStatus(query.trim().length >= 24 ? next : 'Blocked')
    preview(schedule ? 'Mission schedule created' : 'Mission launch')
  }

  return (
    <div className="mission-control">
      <header className="mission-control__hero">
        <div>
          <span className="eyebrow">Agent orchestration</span>
          <h1>Agent Mission Control</h1>
          <p>Launch one bounded mission with an explicit mode, model route, context policy, tool scope, isolation strategy and verification contract.</p>
        </div>
        <div className="mission-control__hero-actions">
          <Tag label="Presentation-only" />
          <button className={parallel ? 'studio-button studio-button--active' : 'studio-button'} type="button" onClick={() => setParallel((value) => !value)}>
            <Icon name="users" size={13} /> {parallel ? 'Arena enabled' : 'Single agent'}
          </button>
          <button className={schedule ? 'studio-button studio-button--active' : 'studio-button'} type="button" onClick={() => setSchedule((value) => !value)}>
            <Icon name="calendar" size={13} /> {schedule ? 'Scheduled' : 'Run now'}
          </button>
        </div>
      </header>

      <div className="platform-metrics mission-control__metrics">
        <MetricCard label="Mode" value={mode} sub={activeMode[1]} />
        <MetricCard label="Model" value={selectedModel} sub={route} />
        <MetricCard label="Context" value="54.2k" sub={contextPreset + ' · 128k cap'} />
        <MetricCard label="Isolation" value={isolation === 'Git worktree' ? 'Worktree' : isolation === 'Cloud environment' ? 'Cloud' : 'Local'} sub={parallel ? 'Parallel lane enabled' : 'Single lane'} />
      </div>

      <div className="mission-control__layout">
        <Panel title="1 · Mission">
          <div className="mission-control__prompt">
            <textarea value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Mission instructions" />
            <div className="mission-control__prompt-meta"><span>{query.length} chars</span><span>Task scope: current project</span></div>
          </div>
          <div className="mission-control__quick">
            <button className="studio-button" type="button" onClick={() => setQuery('Inspect the repository architecture, identify the safest next frontend slice, then implement it with evidence.')}>Architecture-first</button>
            <button className="studio-button" type="button" onClick={() => setQuery('Review the current diff, find regressions, run targeted verification, and prepare a concise evidence report.')}>Review-first</button>
            <button className="studio-button" type="button" onClick={() => setQuery('Research current agent UX patterns, compare evidence, and propose only features that fit the existing architecture.')}>Research-first</button>
          </div>
        </Panel>

        <Panel title="2 · Agent mode">
          <div className="mission-control__modes">
            {modes.map(([id, title, detail]) => (
              <button type="button" key={id} className={mode === id ? 'mission-mode mission-mode--active' : 'mission-mode'} onClick={() => setMode(id)}>
                <span className="mission-mode__icon"><Icon name={id === 'Debug' ? 'alert' : id === 'Research' ? 'search' : id === 'Release' ? 'check-circle' : id === 'Ask' ? 'info' : id === 'Review' ? 'check' : id === 'Plan' ? 'layers' : 'code'} size={13} /></span>
                <span><strong>{id}</strong><small>{title} · {detail}</small></span>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mission-control__config-grid">
        <Panel title="3 · Model & route">
          <div className="mission-control__field-stack">
            <label><span>Model</span><select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}><option>Qwen3 Coder</option><option>GPT-5.3-Codex</option><option>Claude Sonnet 5</option><option>Gemini 3 Pro</option><option>Auto</option></select></label>
            <label><span>Route policy</span><select value={route} onChange={(event) => setRoute(event.target.value)}>{routes.map(([name]) => <option key={name}>{name}</option>)}</select></label>
            <div className="mission-control__route-grid">{routes.map(([name, detail]) => <button type="button" className={route === name ? 'route-card route-card--active' : 'route-card'} key={name} onClick={() => setRoute(name)}><strong>{name}</strong><small>{detail}</small></button>)}</div>
          </div>
        </Panel>

        <Panel title="4 · Context policy">
          <div className="mission-control__preset-row">{(['Focused','Balanced','Deep','Grounded'] as ContextPreset[]).map((preset) => <button key={preset} type="button" className={contextPreset === preset ? 'studio-button studio-button--active' : 'studio-button'} onClick={() => setContextPreset(preset)}>{preset}</button>)}</div>
          <div className="mission-control__context-list">
            {['Repository map + relevant files','Project rules + AGENTS.md','Current Git diff','Pinned memory + prior session evidence','Web/document sources when required'].map((item, index) => <div key={item}><span className="mission-check"><Icon name="check" size={11} /></span><span>{item}</span><small>{index < 3 ? 'included' : 'conditional'}</small></div>)}
          </div>
          <div className="mission-control__budget"><span>Context budget</span><b>54.2k / 128k</b><div><i style={{ width: '42%' }} /></div></div>
        </Panel>
      </div>

      <div className="mission-control__config-grid">
        <Panel title="5 · Tools & permissions">
          <div className="mission-control__tool-list">{toolGroups.map(([name, detail, allowed]) => <div key={name}><div><strong>{name}</strong><span>{detail}</span></div><span className={allowed ? 'state-pill state-pill--completed' : 'state-pill state-pill--pending'}>{allowed ? 'Allowed' : 'Approval'}</span></div>)}</div>
          <div className="platform-actions"><button className="studio-button" type="button" onClick={() => preview('Permission profile opened')}>Edit policy</button><button className="studio-button" type="button" onClick={() => preview('Toolset picker opened')}>Choose toolset</button></div>
        </Panel>

        <Panel title="6 · Isolation & collaboration">
          <div className="mission-control__isolation">{(['Current workspace','Git worktree','Cloud environment'] as Isolation[]).map((value) => <button type="button" key={value} className={isolation === value ? 'isolation-card isolation-card--active' : 'isolation-card'} onClick={() => setIsolation(value)}><Icon name={value === 'Current workspace' ? 'home' : value === 'Git worktree' ? 'branch' : 'cloud'} size={15} /><strong>{value}</strong><small>{value === 'Current workspace' ? 'Fastest · no filesystem isolation' : value === 'Git worktree' ? 'Parallel-safe · isolated Git state' : 'Long-running · remote environment'}</small></button>)}</div>
          <div className="mission-control__collab">{parallel ? <><span><Icon name="users" size={13} /> Parallel agent lanes</span><strong>2 candidates · isolated worktrees</strong></> : <><span><Icon name="bot" size={13} /> Single mission</span><strong>One agent · one execution lane</strong></>}</div>
        </Panel>
      </div>

      <div className="mission-control__config-grid">
        <Panel title="7 · Mission policy & budgets">
          <div className="mission-control__field-stack">
            <label><span>Mission name</span><input value={missionName} onChange={(event) => setMissionName(event.target.value)} aria-label="Mission name" /></label>
            <label><span>Approval profile</span><select value={approvalProfile} onChange={(event) => setApprovalProfile(event.target.value as ApprovalProfile)}>{(['Guarded', 'Interactive', 'Autonomous-safe', 'Release-strict'] as ApprovalProfile[]).map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Verification depth</span><select value={verificationProfile} onChange={(event) => setVerificationProfile(event.target.value as VerificationProfile)}>{(['Targeted', 'Full suite', 'Release gate'] as VerificationProfile[]).map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Max tool turns</span><input type="number" min="1" max="500" value={maxTurns} onChange={(event) => setMaxTurns(Math.max(1, Math.min(500, Number(event.target.value))))} /></label>
            <label><span>Wall-time budget</span><input type="number" min="1" max="240" value={timeLimit} onChange={(event) => setTimeLimit(Math.max(1, Math.min(240, Number(event.target.value))))} /></label>
            <label><span>Cost ceiling</span><input type="number" min="0" max="1000" step="0.5" value={costLimit} onChange={(event) => setCostLimit(Math.max(0, Math.min(1000, Number(event.target.value))))} /></label>
          </div>
          <div className="mission-control__policy-summary" aria-live="polite">
            <span><Icon name="shield" size={12} /> {approvalProfile}</span>
            <span><Icon name="check-circle" size={12} /> {verificationProfile}</span>
            <span><Icon name="activity" size={12} /> {maxTurns} turns · {timeLimit}m</span>
            <span><Icon name="network" size={12} /> ${costLimit.toFixed(2)} ceiling</span>
          </div>
        </Panel>

        <Panel title="8 · Context sources">
          <div className="mission-control__source-grid">
            {contextSources.map((source) => {
              const enabled = enabledContextSources.includes(source)
              return <button type="button" key={source} className={enabled ? 'source-toggle source-toggle--active' : 'source-toggle'} onClick={() => toggleContextSource(source)} aria-pressed={enabled}>
                <Icon name={enabled ? 'check' : 'archive'} size={12} /><span>{source}</span><small>{enabled ? 'included' : 'excluded'}</small>
              </button>
            })}
          </div>
          <div className="mission-control__source-footer"><span>{enabledContextSources.length} sources active</span><button className="studio-button" type="button" onClick={() => setEnabledContextSources(contextSources)}>Include all</button><button className="studio-button" type="button" onClick={() => setEnabledContextSources([])}>Clear</button></div>
        </Panel>
      </div>
      <Panel title="9 · Preflight & verification contract">
        <div className="mission-control__verification">
          {verification.map(([title, detail, state]) => {
            const resolved = missionStatus === 'Blocked' ? 'blocked' : missionStatus === 'Running' || missionStatus === 'Queued' ? 'done' : state
            return <div key={title} className="mission-control__verification-row"><span className={resolved === 'done' ? 'verification-dot verification-dot--done' : resolved === 'ready' ? 'verification-dot verification-dot--ready' : 'verification-dot'}><Icon name={resolved === 'done' ? 'check' : 'clock'} size={11} /></span><div><strong>{title}</strong><small>{detail}</small></div><span className="mono-text">{resolved}</span></div>
          })}
        </div>
        <div className="mission-control__launch">
          <div><span className="eyebrow">{missionName || 'Unnamed mission'} · {missionStatus}</span><strong>{schedule ? 'Scheduled mission' : parallel ? 'Parallel mission' : 'Single mission'} · {mode} · {selectedModel}</strong><small>{isolation} · {contextPreset} context · {route} · {approvalProfile} · {verificationProfile}</small></div>
          <div className="platform-actions"><button className="studio-button" type="button" onClick={() => preview('Mission plan opened')}>Preview plan</button><button className="studio-button" type="button" onClick={runPreflight}>Preflight</button><button className="studio-button studio-button--active" type="button" onClick={launchMission}>{schedule ? 'Queue mission' : 'Launch mission'}</button></div>
        </div>
        <div className="mission-control__boundary"><Icon name="shield" size={13} /><span>UI contract only: launch, queue, tools, model routing and repository isolation are staged visually and do not execute until the corresponding Tauri/Rust services are connected.</span></div>
      </Panel>
    </div>
  )
}
