import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { runtime } from '../../services/runtime'
import Icon from '../../components/Icon'

type Tab = 'Task' | 'Context' | 'Delegation' | 'Safety' | 'Run'

type SubagentDraft = {
  id: string
  name: string
  role: string
  model: string
  status: 'Ready' | 'Running' | 'Idle' | 'Draft'
  task: string
  instructions: string
  contextBudget: number
  maxTurns: number
  toolset: string
  memory: 'None' | 'Session' | 'Project'
  handoff: 'Summary' | 'Artifacts' | 'Full transcript'
  canDelegate: boolean
  canWrite: boolean
  canNetwork: boolean
  requiresApproval: boolean
}

const initialSubagents: SubagentDraft[] = [
  {
    id: 'code-search',
    name: 'Code Searcher',
    role: 'Repository research',
    model: 'GPT-5.4 Mini',
    status: 'Ready',
    task: 'Map the relevant implementation surface before the parent agent changes code.',
    instructions: 'Inspect structure, identify authoritative files, and return exact evidence with no mutations.',
    contextBudget: 24000,
    maxTurns: 12,
    toolset: 'Research',
    memory: 'Session',
    handoff: 'Summary',
    canDelegate: false,
    canWrite: false,
    canNetwork: false,
    requiresApproval: true,
  },
  {
    id: 'reviewer',
    name: 'Security Reviewer',
    role: 'Policy and regression review',
    model: 'GPT-5.4',
    status: 'Ready',
    task: 'Review proposed changes for security, architecture and destructive-action risk.',
    instructions: 'Compare changed files against policy and report evidence-backed findings.',
    contextBudget: 18000,
    maxTurns: 10,
    toolset: 'Repository',
    memory: 'Project',
    handoff: 'Summary',
    canDelegate: false,
    canWrite: false,
    canNetwork: false,
    requiresApproval: true,
  },
  {
    id: 'tester',
    name: 'Test Engineer',
    role: 'Verification',
    model: 'Qwen3 Coder',
    status: 'Running',
    task: 'Execute bounded verification for the current implementation slice.',
    instructions: 'Run only the declared checks, capture failures, and return reproducible evidence.',
    contextBudget: 32000,
    maxTurns: 18,
    toolset: 'Execution',
    memory: 'Session',
    handoff: 'Artifacts',
    canDelegate: false,
    canWrite: true,
    canNetwork: false,
    requiresApproval: true,
  },
  {
    id: 'researcher',
    name: 'Web Researcher',
    role: 'External evidence',
    model: 'DeepSeek',
    status: 'Idle',
    task: 'Compare external sources and preserve provenance for a research question.',
    instructions: 'Search, compare, cite and distinguish source evidence from interpretation.',
    contextBudget: 28000,
    maxTurns: 14,
    toolset: 'Research',
    memory: 'Session',
    handoff: 'Full transcript',
    canDelegate: true,
    canWrite: false,
    canNetwork: true,
    requiresApproval: false,
  },
]

const tabLabels: Tab[] = ['Task', 'Context', 'Delegation', 'Safety', 'Run']

export default function SubagentBuilder({ onAction }: { onAction: (message: string) => void }) {
  const [items, setItems] = useState(initialSubagents)
  const [selectedId, setSelectedId] = useState(initialSubagents[0].id)
  const [tab, setTab] = useState<Tab>('Task')
  const [query, setQuery] = useState('')
  const [runtimeSyncing, setRuntimeSyncing] = useState(true)

  const current = items.find((item) => item.id === selectedId) ?? items[0]

  useEffect(() => {
    let cancelled = false
    void runtime.subagents.list().then((agents) => {
      if (cancelled || agents.length === 0) return
      const mapped = agents.map((agent, index) => ({
        id: typeof agent.agent_id === 'string' ? agent.agent_id : typeof agent.id === 'string' ? agent.id : `remote-${index + 1}`,
        name: typeof agent.name === 'string' ? agent.name : `Runtime specialist ${index + 1}`,
        role: typeof agent.role === 'string' ? agent.role : 'Runtime agent',
        model: typeof agent.model === 'string' ? agent.model : 'Auto route',
        status: 'Ready' as const,
        task: typeof agent.task === 'string' ? agent.task : 'Runtime-managed specialist',
        instructions: typeof agent.instructions === 'string' ? agent.instructions : '',
        contextBudget: typeof agent.context_budget === 'number' ? agent.context_budget : 24000,
        maxTurns: typeof agent.max_turns === 'number' ? agent.max_turns : 12,
        toolset: typeof agent.toolset === 'string' ? agent.toolset : 'Runtime',
        memory: 'Session' as const,
        handoff: 'Summary' as const,
        canDelegate: agent.can_delegate === true,
        canWrite: agent.can_write === true,
        canNetwork: agent.can_network === true,
        requiresApproval: agent.requires_approval !== false,
      }))
      setItems(mapped)
      setSelectedId((currentId) => mapped.some((item) => item.id === currentId) ? currentId : mapped[0].id)
    }).catch(() => {
      // Keep the local specialist catalog while runtime is unavailable.
    }).finally(() => { if (!cancelled) setRuntimeSyncing(false) })
    return () => { cancelled = true }
  }, [])
  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? items.filter((item) => [item.name, item.role, item.model, item.task].join(' ').toLowerCase().includes(q)) : items
  }, [items, query])

  function patch(value: Partial<SubagentDraft>) {
    setItems((list) => list.map((item) => item.id === current.id ? { ...item, ...value } : item))
  }

  function create() {
    const id = 'subagent-' + Date.now()
    const next: SubagentDraft = {
      ...initialSubagents[0],
      id,
      name: 'New specialist',
      role: 'Custom role',
      status: 'Draft',
      task: 'Define the delegated objective.',
    }
    setItems((list) => [next, ...list])
    setSelectedId(id)
    setTab('Task')
    void runtime.subagents.create({
      agent_id: next.id,
      role: next.role,
      capabilities: [
        ...(next.canWrite ? ['write'] : []),
        ...(next.canNetwork ? ['network'] : []),
        ...(next.canDelegate ? ['delegate'] : []),
        ...(next.requiresApproval ? ['approval'] : []),
      ],
      providers: [],
      skills: [],
      sandbox_profile: 'default',
      budget: {
        max_tokens: next.contextBudget,
        max_wall_seconds: Math.max(60, next.maxTurns * 120),
        max_tool_calls: Math.max(1, next.maxTurns * 4),
        max_depth: 2,
      },
    }).then(() => onAction('New subagent created in runtime')).catch((error) => onAction(error instanceof Error ? error.message : 'Runtime subagent creation failed'))
  }

  function run() {
    patch({ status: 'Running' })
    setTab('Run')
    onAction(current.name + ' started in preview')
  }

  function stop() {
    patch({ status: 'Ready' })
    onAction(current.name + ' stopped in preview')
  }

  return (
    <div className="subagent-builder">
      <aside className="subagent-builder__rail">
        <div className="subagent-builder__rail-head">
          <div><span className="eyebrow">Delegation control · {runtimeSyncing ? 'syncing' : 'runtime'}</span><strong>Specialists</strong></div>
          <button className="icon-button" type="button" aria-label="Create subagent" title="Create subagent" onClick={create}><Icon name="plus" size={15} /></button>
        </div>
        <div className="subagent-builder__search"><Icon name="search" size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search specialists…" /></div>
        <div className="subagent-builder__list">
          {visibleItems.map((item) => <button type="button" key={item.id} className={item.id === current.id ? 'subagent-builder__item subagent-builder__item--active' : 'subagent-builder__item'} onClick={() => setSelectedId(item.id)}>
            <span className="subagent-builder__icon"><Icon name="bot" size={14} /></span>
            <span><strong>{item.name}</strong><small>{item.model} · {item.role}</small></span>
            <span className={item.status === 'Running' ? 'status-dot status-dot--live' : 'status-dot status-dot--offline'} />
          </button>)}
        </div>
      </aside>

      <section className="subagent-builder__workspace">
        <header className="subagent-builder__header">
          <div><span className="eyebrow">{current.status} · isolated context</span><h2>{current.name}</h2><p>{current.role} · {current.model}</p></div>
          <div className="subagent-builder__actions">
            <button className="studio-button" type="button" onClick={() => onAction('Subagent message composer opened in preview')}><Icon name="message" size={13} /> Message</button>
            {current.status === 'Running'
              ? <button className="studio-button" type="button" onClick={stop}><Icon name="stop" size={13} /> Stop</button>
              : <button className="studio-button studio-button--active" type="button" onClick={run}><Icon name="play" size={13} /> Run</button>}
          </div>
        </header>

        <nav className="subagent-builder__tabs" role="tablist" aria-label="Subagent builder">
          {tabLabels.map((item) => <button type="button" key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'subagent-builder__tab subagent-builder__tab--active' : 'subagent-builder__tab'} onClick={() => setTab(item)}>{item}</button>)}
        </nav>

        <div className="subagent-builder__content">
          {tab === 'Task' && <BuilderSection title="Delegated task" description="Define the exact objective this specialist owns and the instructions it receives.">
            <Field label="Name"><input value={current.name} onChange={(event) => patch({ name: event.target.value || 'Untitled specialist' })} /></Field>
            <Field label="Role"><input value={current.role} onChange={(event) => patch({ role: event.target.value })} /></Field>
            <Field label="Task objective"><textarea value={current.task} onChange={(event) => patch({ task: event.target.value })} rows={5} /></Field>
            <Field label="Specialist instructions"><textarea value={current.instructions} onChange={(event) => patch({ instructions: event.target.value })} rows={8} /></Field>
            <div className="subagent-builder__summary"><Stat label="Model" value={current.model} /><Stat label="Toolset" value={current.toolset} /><Stat label="Max turns" value={String(current.maxTurns)} /><Stat label="Status" value={current.status} /></div>
          </BuilderSection>}

          {tab === 'Context' && <BuilderSection title="Context isolation" description="Keep the delegated context bounded and explicit so subagents do not silently inherit unrelated session state.">
            <div className="subagent-builder__grid subagent-builder__grid--2">
              <Range label="Context budget" value={current.contextBudget} min={8000} max={64000} step={2000} suffix={Math.round(current.contextBudget / 1000) + 'k'} onChange={(value) => patch({ contextBudget: value })} />
              <Range label="Maximum turns" value={current.maxTurns} min={1} max={30} step={1} suffix={String(current.maxTurns)} onChange={(value) => patch({ maxTurns: value })} />
              <Field label="Memory scope"><Select value={current.memory} onChange={(value) => patch({ memory: value as SubagentDraft['memory'] })} options={['None', 'Session', 'Project']} /></Field>
              <Field label="Toolset"><Select value={current.toolset} onChange={(value) => patch({ toolset: value })} options={['Research', 'Repository', 'Execution', 'Browser', 'Media']} /></Field>
            </div>
            <div className="subagent-builder__context-card"><Icon name="archive" size={15} /><div><strong>Isolated window</strong><p>{Math.round(current.contextBudget / 1000)}k token budget · {current.maxTurns} turns · {current.memory} memory.</p></div><span className="state-pill state-pill--completed">Bounded</span></div>
          </BuilderSection>}

          {tab === 'Delegation' && <BuilderSection title="Handoff & delegation" description="Control whether the specialist can create more work and what comes back to the parent agent.">
            <div className="subagent-builder__grid subagent-builder__grid--2">
              <Field label="Handoff format"><Select value={current.handoff} onChange={(value) => patch({ handoff: value as SubagentDraft['handoff'] })} options={['Summary', 'Artifacts', 'Full transcript']} /></Field>
              <Field label="Model"><input value={current.model} onChange={(event) => patch({ model: event.target.value })} /></Field>
            </div>
            <Toggle label="Allow subagent delegation" value={current.canDelegate} onChange={(value) => patch({ canDelegate: value })} />
            <div className="subagent-builder__handoff">
              <div><span className="eyebrow">Parent receives</span><strong>{current.handoff}</strong><small>Result package remains explicit at the UI boundary.</small></div>
              <div className="subagent-builder__handoff-arrow"><Icon name="branch" size={17} /></div>
              <div><span className="eyebrow">Parent task</span><strong>Current session</strong><small>No implicit transcript injection is assumed.</small></div>
            </div>
          </BuilderSection>}

          {tab === 'Safety' && <BuilderSection title="Execution safety" description="Preview the specialist's authorization envelope independently from the parent agent.">
            <Toggle label="Workspace writes" value={current.canWrite} onChange={(value) => patch({ canWrite: value })} />
            <Toggle label="Network access" value={current.canNetwork} onChange={(value) => patch({ canNetwork: value })} />
            <Toggle label="Approval before sensitive action" value={current.requiresApproval} onChange={(value) => patch({ requiresApproval: value })} />
            <div className="subagent-builder__policy-card">
              <div><Icon name="shield" size={15} /><div><strong>Fail-closed preview</strong><p>Write, network and destructive operations remain policy-bound. This UI does not grant runtime permissions.</p></div></div>
              <span className="state-pill state-pill--pending">Runtime-owned</span>
            </div>
          </BuilderSection>}

          {tab === 'Run' && <BuilderSection title="Run state & handoff" description="Inspect the current run envelope and the evidence package the parent agent will receive.">
            <div className="subagent-builder__run-hero">
              <div className="subagent-builder__run-orb"><Icon name="bot" size={23} /></div>
              <div><span className="eyebrow">Current state</span><strong>{current.status}</strong><p>{current.task}</p></div>
              <div className="subagent-builder__run-actions">{current.status === 'Running' ? <button className="studio-button" type="button" onClick={stop}><Icon name="stop" size={13} /> Stop run</button> : <button className="studio-button studio-button--active" type="button" onClick={run}><Icon name="play" size={13} /> Start run</button>}</div>
            </div>
            <div className="subagent-builder__run-grid"><Stat label="Context" value={Math.round(current.contextBudget / 1000) + 'k'} /><Stat label="Turns" value={String(current.maxTurns)} /><Stat label="Handoff" value={current.handoff} /><Stat label="Approval" value={current.requiresApproval ? 'Required' : 'Optional'} /></div>
            <div className="subagent-builder__timeline">{['Task assigned','Context sealed','Tools scoped','Execution started','Handoff prepared'].map((step,index)=><div key={step}><span>{String(index + 1).padStart(2,'0')}</span><strong>{step}</strong><small>{index < 3 ? 'complete' : current.status === 'Running' ? 'active' : 'pending'}</small></div>)}</div>
          </BuilderSection>}
        </div>
      </section>
    </div>
  )
}

function BuilderSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="subagent-builder__section"><header><span className="eyebrow">Subagent configuration</span><h3>{title}</h3><p>{description}</p></header><div className="subagent-builder__section-body">{children}</div></section>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="subagent-builder__field"><span>{label}</span>{children}</label>
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
}

function Range({ label, value, min, max, step, suffix, onChange }: { label: string; value: number; min: number; max: number; step: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="subagent-builder__range"><span><span>{label}</span><strong>{suffix}</strong></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <button className={value ? 'subagent-builder__toggle subagent-builder__toggle--active' : 'subagent-builder__toggle'} type="button" aria-pressed={value} onClick={() => onChange(!value)}><span><strong>{label}</strong><small>{value ? 'Enabled' : 'Disabled'}</small></span><span className="switch"><span /></span></button>
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="subagent-builder__stat"><span>{label}</span><strong>{value}</strong></div>
}
