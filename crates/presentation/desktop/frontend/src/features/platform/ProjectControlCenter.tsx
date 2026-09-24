import { useEffect, useMemo, useState } from 'react'
import type { RuntimeApiRecord, RuntimeProject } from '../../types/runtime'
import { runtime } from '../../services/runtime'
import Icon from '../../components/Icon'
import { MetricCard, Panel, Tag } from './PlatformPrimitives'

type Tab = 'overview' | 'projects' | 'workspace' | 'tasks' | 'git' | 'environment'
type StaticRow = readonly [string, string, string, string]

const projects: ReadonlyArray<StaticRow> = [
  ['AgentiCOS', 'Rust runtime + Tauri + React', 'main', 'Active'],
  ['CCOS', 'C++ / Qt editor', 'feature/editor', 'Linked'],
  ['KinetixFitt', 'Fitness product workspace', 'develop', 'Linked'],
]

const tasks: ReadonlyArray<StaticRow> = [
  ['TASK-042', 'Frontend control-plane expansion', 'Builder', 'Running'],
  ['TASK-043', 'Navigation organization audit', 'Reviewer', 'Queued'],
  ['TASK-044', 'Verification evidence pack', 'QA', 'Blocked'],
  ['TASK-045', 'Runtime adapter planning', 'Architect', 'Planned'],
]

const git: ReadonlyArray<readonly [string, string, string]> = [
  ['Branch', 'main', 'protected'],
  ['Working tree', 'Clean preview', '0 changes'],
  ['Ahead / behind', '0 / 0', 'origin/main'],
  ['Checkpoint', 'CP-031', 'restorable'],
]

const env: ReadonlyArray<readonly [string, string, string]> = [
  ['Local Desktop', 'Tauri workstation', 'Ready'],
  ['Mission Worktree', 'Isolated Git checkout', 'Ready'],
  ['Cloud Agent VM', 'Remote long-running', 'Preview'],
  ['Remote SSH', 'User-managed host', 'Preview'],
]

export function ProjectControlCenter({ onAction }: { onAction: (message: string) => void }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [project, setProject] = useState(projects[0][0])
  const [filter, setFilter] = useState('')
  const [runtimeProjects, setRuntimeProjects] = useState<RuntimeProject[]>([])
  const [runtimeJobs, setRuntimeJobs] = useState<RuntimeApiRecord[]>([])
  const [runtimeRuns, setRuntimeRuns] = useState<RuntimeApiRecord[]>([])
  const [runtimeProviders, setRuntimeProviders] = useState<RuntimeApiRecord[]>([])
  const [health, setHealth] = useState<RuntimeApiRecord | null>(null)
  const [readiness, setReadiness] = useState<RuntimeApiRecord | null>(null)
  const [sandbox, setSandbox] = useState<RuntimeApiRecord | null>(null)
  const [runtimeSyncing, setRuntimeSyncing] = useState(true)

  useEffect(() => {
    let cancelled = false
    void runtime.projects.list()
      .then((remote) => {
        if (cancelled || remote.length === 0) return
        setRuntimeProjects(remote)
        setProject((current) => remote.some((item) => item.name === current) ? current : remote[0].name)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRuntimeSyncing(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.allSettled([
      runtime.jobs.list(),
      runtime.runs.list(),
      runtime.providers.list(),
      runtime.health.get(),
      runtime.health.ready(),
      runtime.sandbox.status(),
    ]).then((results) => {
      if (cancelled) return
      const [jobs, runs, providers, healthResult, readyResult, sandboxResult] = results
      if (jobs.status === 'fulfilled') setRuntimeJobs(jobs.value)
      if (runs.status === 'fulfilled') setRuntimeRuns(runs.value as RuntimeApiRecord[])
      if (providers.status === 'fulfilled') setRuntimeProviders(providers.value as RuntimeApiRecord[])
      if (healthResult.status === 'fulfilled') setHealth(healthResult.value as RuntimeApiRecord)
      if (readyResult.status === 'fulfilled') setReadiness(readyResult.value as RuntimeApiRecord)
      if (sandboxResult.status === 'fulfilled') setSandbox(sandboxResult.value)
    }).finally(() => {
      if (!cancelled) setRuntimeSyncing(false)
    })
    return () => { cancelled = true }
  }, [])

  const liveProject = runtimeProjects.find((item) => item.name === project)
  const selected = liveProject
    ? ([liveProject.name, liveProject.description, liveProject.default_branch, liveProject.status] as const)
    : (projects.find((item) => item[0] === project) ?? projects[0])
  const runningJobs = runtimeJobs.filter((job) => ['running', 'in_progress', 'claimed', 'executing'].includes(String(job.state ?? job.status).toLowerCase())).length
  const blockedJobs = runtimeJobs.filter((job) => ['blocked', 'failed', 'error'].includes(String(job.state ?? job.status).toLowerCase())).length
  const activeProviders = runtimeProviders.filter((provider) => provider.configured === true).length
  const visibleTasks = useMemo(() => tasks.filter((task) => task.join(' ').toLowerCase().includes(filter.toLowerCase())), [filter])
  const act = (message: string) => onAction(message + ' staged in preview')

  return (
    <div className="project-control">
      <header className="project-control__hero">
        <div>
          <span className="eyebrow">{runtimeSyncing ? 'Workspace control · syncing' : 'Workspace control · runtime'}</span>
          <h1>Project Control Center</h1>
          <p>One workspace view for project identity, agent profile, current branch, tasks, environment and recovery state.</p>
        </div>
        <div className="project-control__actions">
          <Tag label="Workspace-scoped" />
          <button className="studio-button" type="button" onClick={() => act('Switch project')}>Switch project</button>
          <button className="studio-button studio-button--active" type="button" onClick={() => act('Open project settings')}>
            <Icon name="settings" size={13} /> Project settings
          </button>
        </div>
      </header>

      <div className="platform-metrics">
        <MetricCard label="Project" value={selected[0]} sub={selected[1]} />
        <MetricCard label="Branch" value={selected[2]} sub={selected[3]} />
        <MetricCard label="Tasks" value={String(runtimeJobs.length || tasks.length)} sub={runtimeJobs.length ? String(runningJobs) + ' running · ' + String(blockedJobs) + ' blocked' : 'Runtime not loaded'} />
        <MetricCard label="Environment" value={sandbox ? 'Sandbox' : 'Worktree'} sub={sandbox ? String(sandbox.status ?? sandbox.state ?? 'Runtime connected') : runtimeSyncing ? 'Synchronizing' : 'Snapshot ready'} />
      </div>

      <div className="project-control__tabs">
        {(['overview', 'projects', 'workspace', 'tasks', 'git', 'environment'] as const).map((item) => (
          <button key={item} type="button" className={tab === item ? 'project-tab project-tab--active' : 'project-tab'} onClick={() => setTab(item)}>{item}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="project-control__grid">
          <Panel title="Current workspace">
            <div className="project-identity">
              <span className="workspace-avatar">A</span>
              <div>
                <span className="eyebrow">{selected[0]}</span>
                <h2>{selected[1]}</h2>
                <p>{selected[2]} · protected branch · worktree isolation · {runtimeSyncing ? 'runtime syncing' : activeProviders + ' provider' + (activeProviders === 1 ? '' : 's') + ' connected'}</p>
              </div>
            </div>
            <div className="project-facts">
              <div><span>Agent profile</span><strong>Builder · Guarded</strong></div>
              <div><span>Model route</span><strong>Auto · coder</strong></div>
              <div><span>Context</span><strong>66.1k / 128k</strong></div>
              <div><span>Verification</span><strong>3 pending gates</strong></div>
            </div>
            <div className="platform-actions">
              <button className="studio-button" type="button" onClick={() => act('Open developer workspace')}>Code</button>
              <button className="studio-button" type="button" onClick={() => act('Open Git control')}>Git</button>
              <button className="studio-button studio-button--active" type="button" onClick={() => act('Open mission control')}>Mission</button>
            </div>
          </Panel>
          <Panel title="Workspace health">
            <div className="health-list">
              {[
                ['Runtime', health?.status ?? 'Offline preview', health?.status === 'ok' || health?.status === 'healthy' ? 'Ready' : runtimeSyncing ? 'Pending' : 'Warning'],
                ['Git', 'Clean preview', 'Ready'],
                ['Context', readiness ? String(readiness.status ?? 'ready') + ' · ' + (readiness.provider_configured ? 'provider configured' : 'no provider') : 'Budget pending', readiness?.healthy_provider ? 'Ready' : 'Pending'],
                ['Policies', 'Fail-closed', 'Ready'],
                ['Evidence', runtimeRuns.length ? String(runtimeRuns.length) + ' runs visible' : 'No runs loaded', runtimeRuns.length ? 'Ready' : 'Pending'],
              ].map(([name, detail, state]) => (
                <div key={name}><span><strong>{name}</strong><small>{detail}</small></span><Tag label={state} /></div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {tab === 'projects' && (
        <Panel title="Project registry">
          <div className="project-list">
            {(runtimeProjects.length ? runtimeProjects.map((item) => [item.name, item.description, item.default_branch, item.status] as const) : projects).map((item) => (
              <button type="button" key={item[0]} className={project === item[0] ? 'project-row project-row--active' : 'project-row'} onClick={() => setProject(item[0])}>
                <span><strong>{item[0]}</strong><small>{item[1]} · {item[2]}</small></span>
                <Tag label={item[3]} /><Icon name="chevron-right" size={12} />
              </button>
            ))}
          </div>
          <div className="platform-actions">
            <button className="studio-button" type="button" onClick={() => act('Create project')}>New project</button>
            <button className="studio-button" type="button" onClick={() => act('Link project')}>Link</button>
          </div>
        </Panel>
      )}

      {tab === 'workspace' && (
        <div className="project-control__grid">
          <Panel title="Open workspace surfaces">
            <div className="surface-launch-grid">
              {['Developer', 'Mission', 'Execution', 'Intelligence', 'Governance', 'Integrations'].map((name) => (
                <button key={name} type="button" className="surface-launch-card" onClick={() => act('Open ' + name + ' workspace')}>
                  <Icon name={name === 'Governance' ? 'shield' : name === 'Integrations' ? 'network' : name === 'Intelligence' ? 'spark' : name === 'Execution' ? 'terminal' : name === 'Mission' ? 'play' : 'code'} size={16} />
                  <strong>{name}</strong><small>{name === 'Developer' ? 'Code' : name === 'Mission' ? 'Agent' : name === 'Execution' ? 'Run' : name === 'Intelligence' ? 'Context' : name === 'Governance' ? 'Safety' : 'Connect'}</small>
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Layout profile">
            <div className="layout-profile">
              <div><span>Sidebar</span><strong>Visible · 270px</strong></div>
              <div><span>Inspector</span><strong>Visible · 320px</strong></div>
              <div><span>Bottom dock</span><strong>Hidden</strong></div>
              <div><span>Density</span><strong>Comfortable</strong></div>
              <div><span>Theme</span><strong>Monochrome</strong></div>
            </div>
            <button className="wide-action" type="button" onClick={() => act('Open workspace customization')}>Customize workspace</button>
          </Panel>
        </div>
      )}

      {tab === 'tasks' && (
        <div className="project-control__grid">
          <Panel title="Task queue">
            <div className="task-filter"><Icon name="search" size={12} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter tasks…" aria-label="Filter project tasks" /></div>
            <div className="project-task-list">
              {visibleTasks.map(([id, title, owner, state]) => (
                <div key={id}><span><strong>{title}</strong><small>{id} · {owner}</small></span><Tag label={state} /><button className="studio-button" type="button" onClick={() => act('Open ' + id)}>Open</button></div>
              ))}
            </div>
          </Panel>
          <Panel title="Task policy">
            <div className="layout-profile">
              <div><span>Ownership</span><strong>Explicit</strong></div>
              <div><span>Parallelism</span><strong>Worktree isolated</strong></div>
              <div><span>Retries</span><strong>Bounded</strong></div>
              <div><span>Completion</span><strong>Evidence required</strong></div>
            </div>
            <div className="platform-actions">
              <button className="studio-button" type="button" onClick={() => act('Create task')}>New task</button>
              <button className="studio-button studio-button--active" type="button" onClick={() => act('Open task execution')}>Execution</button>
            </div>
          </Panel>
        </div>
      )}

      {tab === 'git' && (
        <div className="project-control__grid">
          <Panel title="Repository state">
            <div className="repo-facts">{git.map(([name, value, detail]) => <div key={name}><span>{name}</span><strong>{value}</strong><small>{detail}</small></div>)}</div>
            <div className="platform-actions">
              <button className="studio-button" type="button" onClick={() => act('Open Git Control Center')}>Git control</button>
              <button className="studio-button" type="button" onClick={() => act('Create checkpoint')}>Checkpoint</button>
              <button className="studio-button studio-button--active" type="button" onClick={() => act('Open collaboration review')}>Review</button>
            </div>
          </Panel>
          <Panel title="Safe repository workflow">
            <div className="workflow-line">{['Inspect', 'Plan', 'Edit', 'Verify', 'Review', 'Commit', 'Release'].map((step, index) => <div key={step} className={index < 5 ? 'workflow-step workflow-step--done' : 'workflow-step'}><span>{index < 5 ? '✓' : index + 1}</span><strong>{step}</strong></div>)}</div>
          </Panel>
        </div>
      )}

      {tab === 'environment' && (
        <Panel title="Environment targets">
          <div className="environment-grid-mini">
            {env.map(([name, detail, state]) => (
              <div key={name}><Icon name={name.includes('Worktree') ? 'branch' : name.includes('Cloud') ? 'cloud' : name.includes('SSH') ? 'network' : 'home'} size={15} /><strong>{name}</strong><small>{detail}</small><Tag label={state} /><button className="studio-button" type="button" onClick={() => act('Open ' + name)}>Open</button></div>
            ))}
          </div>
          <div className="platform-actions">
            <button className="studio-button" type="button" onClick={() => act('Open Environment Lab')}>Environment Lab</button>
            <button className="studio-button studio-button--active" type="button" onClick={() => act('Run environment preflight')}>Preflight</button>
          </div>
        </Panel>
      )}

      <div className="project-control__guard">
        <Icon name="shield" size={13} />
        <span>Project Control Center uses runtime data where contracts exist. Project, branch, environment and task mutations without backend contracts remain presentation intents.</span>
      </div>
    </div>
  )
}
