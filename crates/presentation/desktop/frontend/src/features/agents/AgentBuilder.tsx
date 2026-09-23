import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'

type BuilderTab = 'Identity' | 'Model' | 'Instructions' | 'Capabilities' | 'Policies' | 'Test & Release'
type Scope = 'Global' | 'Project' | 'Session'
type Permission = 'Allow' | 'Ask' | 'Deny'

type AgentDraft = {
  id: string
  name: string
  description: string
  role: string
  status: 'Draft' | 'Production' | 'Experimental'
  icon: 'bot' | 'spark'
  scope: Scope
  provider: string
  model: string
  fallback: string
  temperature: number
  reasoning: 'Fast' | 'Balanced' | 'Deep'
  maxOutput: number
  systemPrompt: string
  style: 'Technical' | 'Concise' | 'Detailed' | 'Teaching'
  planning: 'Guarded' | 'Standard' | 'Autonomous'
  verification: 'Required' | 'Recommended' | 'Off'
  memory: 'None' | 'Session' | 'Project' | 'Persistent'
  contextBudget: number
  enabledCapabilities: string[]
  permissions: Record<string, Permission>
  toolset: string
  mcp: string
  browser: boolean
  terminal: boolean
  subagents: boolean
  evaluationSuite: string
  releaseChannel: 'Draft' | 'Staged' | 'Published'
}

const baseAgents: AgentDraft[] = [
  {
    id: 'builder',
    name: 'Builder',
    description: 'Implementation specialist for repository changes and controlled execution.',
    role: 'Implementation specialist',
    status: 'Production',
    icon: 'bot',
    scope: 'Project',
    provider: 'Auto route',
    model: 'Qwen3 Coder',
    fallback: 'GPT-OSS 120B',
    temperature: 0.2,
    reasoning: 'Balanced',
    maxOutput: 8192,
    systemPrompt: 'Inspect first. Plan a reversible change. Execute only inside explicit boundaries. Verify every slice before handoff.',
    style: 'Technical',
    planning: 'Guarded',
    verification: 'Required',
    memory: 'Project',
    contextBudget: 64000,
    enabledCapabilities: ['Repository', 'Code search', 'Git', 'Verification'],
    permissions: {
      'Workspace read': 'Allow',
      'Workspace write': 'Ask',
      'Terminal': 'Ask',
      'Network': 'Ask',
      'Destructive': 'Deny',
      'MCP': 'Ask',
    },
    toolset: 'Core safe',
    mcp: 'GitHub',
    browser: true,
    terminal: true,
    subagents: true,
    evaluationSuite: 'Code correctness',
    releaseChannel: 'Published',
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    description: 'Quality and regression analyst focused on evidence, diffs and verification.',
    role: 'Quality specialist',
    status: 'Production',
    icon: 'spark',
    scope: 'Global',
    provider: 'Auto route',
    model: 'GPT-OSS 120B',
    fallback: 'DeepSeek',
    temperature: 0.1,
    reasoning: 'Deep',
    maxOutput: 6144,
    systemPrompt: 'Review changes against architecture, security and verification requirements. Report evidence before conclusions.',
    style: 'Detailed',
    planning: 'Guarded',
    verification: 'Required',
    memory: 'Project',
    contextBudget: 48000,
    enabledCapabilities: ['Diff review', 'Security', 'Testing', 'Evidence'],
    permissions: {
      'Workspace read': 'Allow',
      'Workspace write': 'Deny',
      'Terminal': 'Ask',
      'Network': 'Ask',
      'Destructive': 'Deny',
      'MCP': 'Ask',
    },
    toolset: 'Repository',
    mcp: 'GitHub',
    browser: false,
    terminal: true,
    subagents: false,
    evaluationSuite: 'Tool discipline',
    releaseChannel: 'Published',
  },
  {
    id: 'researcher',
    name: 'Researcher',
    description: 'Evidence specialist for web research, source comparison and provenance.',
    role: 'Research specialist',
    status: 'Experimental',
    icon: 'spark',
    scope: 'Global',
    provider: 'Auto route',
    model: 'DeepSeek',
    fallback: 'Qwen3 Coder',
    temperature: 0.4,
    reasoning: 'Deep',
    maxOutput: 8192,
    systemPrompt: 'Search broadly, compare sources, preserve provenance and distinguish evidence from interpretation.',
    style: 'Teaching',
    planning: 'Standard',
    verification: 'Recommended',
    memory: 'Session',
    contextBudget: 56000,
    enabledCapabilities: ['Web search', 'Source extraction', 'Comparison', 'Citations'],
    permissions: {
      'Workspace read': 'Allow',
      'Workspace write': 'Deny',
      'Terminal': 'Deny',
      'Network': 'Allow',
      'Destructive': 'Deny',
      'MCP': 'Ask',
    },
    toolset: 'Research',
    mcp: 'Search',
    browser: true,
    terminal: false,
    subagents: true,
    evaluationSuite: 'Research grounding',
    releaseChannel: 'Staged',
  },
]

const capabilityCatalog = [
  ['Repository', 'Files, manifests and project structure'],
  ['Code search', 'Semantic and text search over indexed workspace'],
  ['Git', 'Diffs, branches and checkpoint views'],
  ['Verification', 'Tests, checks and evidence collection'],
  ['Web search', 'Search and source discovery'],
  ['Source extraction', 'Readable page and document extraction'],
  ['Browser', 'Interactive browser navigation and forms'],
  ['MCP', 'External capability server access'],
  ['Memory', 'Scoped recall and persistent knowledge'],
  ['Subagents', 'Delegation to isolated specialists'],
  ['Terminal', 'Shell execution within selected policy'],
  ['Artifacts', 'Generated files, reports and handoff packages'],
]

const permissionLabels = ['Workspace read', 'Workspace write', 'Terminal', 'Network', 'Destructive', 'MCP'] as const

export default function AgentBuilder({ onAction }: { onAction: (message: string) => void }) {
  const [agents, setAgents] = useState(baseAgents)
  const [selectedId, setSelectedId] = useState(baseAgents[0].id)
  const [tab, setTab] = useState<BuilderTab>('Identity')
  const [search, setSearch] = useState('')
  const [draftDirty, setDraftDirty] = useState(false)

  const current = agents.find((agent) => agent.id === selectedId) ?? agents[0]
  const visibleAgents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? agents.filter((agent) => [agent.name, agent.description, agent.role, agent.model].join(' ').toLowerCase().includes(q)) : agents
  }, [agents, search])

  function patch(patchValue: Partial<AgentDraft>) {
    setAgents((items) => items.map((agent) => agent.id === current.id ? { ...agent, ...patchValue } : agent))
    setDraftDirty(true)
  }

  function toggleCapability(value: string) {
    const next = current.enabledCapabilities.includes(value)
      ? current.enabledCapabilities.filter((item) => item !== value)
      : [...current.enabledCapabilities, value]
    patch({ enabledCapabilities: next })
  }

  function setPermission(label: string, value: Permission) {
    patch({ permissions: { ...current.permissions, [label]: value } })
  }

  function createAgent() {
    const id = 'agent-' + Date.now()
    const source = baseAgents[0]
    const next: AgentDraft = {
      ...source,
      id,
      name: 'New Agent',
      description: 'New specialist profile ready to configure.',
      role: 'Custom specialist',
      status: 'Draft',
      releaseChannel: 'Draft',
    }
    setAgents((items) => [next, ...items])
    setSelectedId(id)
    setTab('Identity')
    setDraftDirty(true)
    onAction('New agent builder profile created in preview')
  }

  function duplicateAgent() {
    const id = 'agent-' + Date.now()
    const next = { ...current, id, name: current.name + ' Copy', status: 'Draft' as const, releaseChannel: 'Draft' as const }
    setAgents((items) => [next, ...items])
    setSelectedId(id)
    setDraftDirty(true)
    onAction('Agent profile duplicated in preview')
  }

  function saveDraft() {
    setDraftDirty(false)
    onAction(current.name + ' saved in preview')
  }

  function testAgent() {
    setTab('Test & Release')
    onAction(current.name + ' test run staged in preview')
  }

  function updateName(value: string) {
    patch({ name: value || 'Untitled Agent' })
  }

  return (
    <div className="agent-builder">
      <aside className="agent-builder__rail">
        <div className="agent-builder__rail-head">
          <div>
            <span className="eyebrow">Agent control plane</span>
            <strong>Profiles</strong>
          </div>
          <button className="icon-button" type="button" title="Create agent" aria-label="Create agent" onClick={createAgent}>
            <Icon name="plus" size={15} />
          </button>
        </div>
        <div className="agent-builder__search">
          <Icon name="search" size={14} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search agents…" />
        </div>
        <div className="agent-builder__list">
          {visibleAgents.map((agent) => (
            <button
              type="button"
              key={agent.id}
              className={selectedId === agent.id ? 'agent-builder__agent agent-builder__agent--active' : 'agent-builder__agent'}
              onClick={() => { setSelectedId(agent.id); setDraftDirty(false) }}
            >
              <span className="agent-builder__agent-icon"><Icon name={agent.icon} size={15} /></span>
              <span className="agent-builder__agent-copy">
                <strong>{agent.name}</strong>
                <small>{agent.model}</small>
                <em>{agent.status} · {agent.scope}</em>
              </span>
            </button>
          ))}
        </div>
        <div className="agent-builder__rail-footer">
          <button className="studio-button" type="button" onClick={duplicateAgent}><Icon name="copy" size={13} /> Duplicate</button>
          <button className="studio-button" type="button" onClick={() => onAction('Agent import/export opened in preview')}><Icon name="download" size={13} /> Import / Export</button>
        </div>
      </aside>

      <section className="agent-builder__workspace">
        <header className="agent-builder__header">
          <div className="agent-builder__identity">
            <div className="agent-builder__orb"><Icon name={current.icon} size={22} /></div>
            <div>
              <span className="eyebrow">{current.status} · {current.scope} scope</span>
              <h2>{current.name}</h2>
              <p>{current.description}</p>
            </div>
          </div>
          <div className="agent-builder__header-actions">
            {draftDirty && <span className="state-pill state-pill--pending">Unsaved changes</span>}
            <button className="studio-button" type="button" onClick={testAgent}><Icon name="play" size={13} /> Test</button>
            <button className="studio-button studio-button--active" type="button" onClick={saveDraft}><Icon name="check" size={13} /> Save</button>
          </div>
        </header>

        <nav className="agent-builder__tabs" role="tablist" aria-label="Agent builder sections">
          {(['Identity', 'Model', 'Instructions', 'Capabilities', 'Policies', 'Test & Release'] as BuilderTab[]).map((item) => (
            <button type="button" key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'agent-builder__tab agent-builder__tab--active' : 'agent-builder__tab'} onClick={() => setTab(item)}>
              {item}
            </button>
          ))}
        </nav>

        <div className="agent-builder__content">
          {tab === 'Identity' && (
            <BuilderSection title="Identity & scope" description="Define the human-readable identity and where this profile is allowed to apply.">
              <div className="agent-builder__field-grid agent-builder__field-grid--2">
                <Field label="Display name"><input value={current.name} onChange={(event) => updateName(event.target.value)} /></Field>
                <Field label="Role"><input value={current.role} onChange={(event) => patch({ role: event.target.value })} /></Field>
                <Field label="Description"><textarea value={current.description} onChange={(event) => patch({ description: event.target.value })} rows={3} /></Field>
                <Field label="Scope"><Select value={current.scope} onChange={(value) => patch({ scope: value as Scope })} options={['Global', 'Project', 'Session']} /></Field>
                <Field label="Status"><Select value={current.status} onChange={(value) => patch({ status: value as AgentDraft['status'] })} options={['Draft', 'Experimental', 'Production']} /></Field>
                <Field label="Default style"><Select value={current.style} onChange={(value) => patch({ style: value as AgentDraft['style'] })} options={['Technical', 'Concise', 'Detailed', 'Teaching']} /></Field>
              </div>
              <div className="agent-builder__preview-card">
                <div className="agent-builder__preview-avatar"><Icon name={current.icon} size={24} /></div>
                <div><span className="eyebrow">Preview</span><strong>{current.name}</strong><p>{current.role} · {current.model}</p></div>
                <span className="state-pill state-pill--completed">{current.status}</span>
              </div>
            </BuilderSection>
          )}

          {tab === 'Model' && (
            <BuilderSection title="Model & routing" description="Keep model selection and fallback behavior explicit at presentation level. Credentials remain outside this surface.">
              <div className="agent-builder__field-grid agent-builder__field-grid--3">
                <Field label="Provider"><Select value={current.provider} onChange={(value) => patch({ provider: value })} options={['Auto route', 'OpenAI', 'Google', 'Groq', 'Cerebras', 'Local runtime']} /></Field>
                <Field label="Primary model"><input value={current.model} onChange={(event) => patch({ model: event.target.value })} /></Field>
                <Field label="Fallback"><input value={current.fallback} onChange={(event) => patch({ fallback: event.target.value })} /></Field>
                <Field label="Reasoning"><Select value={current.reasoning} onChange={(value) => patch({ reasoning: value as AgentDraft['reasoning'] })} options={['Fast', 'Balanced', 'Deep']} /></Field>
                <Field label="Max output tokens"><input type="number" min={256} max={32768} step={256} value={current.maxOutput} onChange={(event) => patch({ maxOutput: Number(event.target.value) || 256 })} /></Field>
                <RangeField label="Temperature" value={current.temperature} min={0} max={1} step={0.05} suffix={current.temperature.toFixed(2)} onChange={(value) => patch({ temperature: value })} />
              </div>
              <div className="agent-builder__route-strip">
                <RouteCard label="Primary" value={current.model} meta={current.provider} />
                <RouteCard label="Fallback" value={current.fallback} meta="On error / timeout" />
                <RouteCard label="Service tier" value="Auto" meta="Preview policy" />
              </div>
            </BuilderSection>
          )}

          {tab === 'Instructions' && (
            <BuilderSection title="Instructions & behavior" description="Shape the agent's operating loop before any runtime contract is attached.">
              <div className="agent-builder__field-grid agent-builder__field-grid--2">
                <Field label="System instructions"><textarea className="agent-builder__prompt" value={current.systemPrompt} onChange={(event) => patch({ systemPrompt: event.target.value })} rows={10} /></Field>
                <div className="agent-builder__stack">
                  <Field label="Planning mode"><Select value={current.planning} onChange={(value) => patch({ planning: value as AgentDraft['planning'] })} options={['Guarded', 'Standard', 'Autonomous']} /></Field>
                  <Field label="Verification"><Select value={current.verification} onChange={(value) => patch({ verification: value as AgentDraft['verification'] })} options={['Required', 'Recommended', 'Off']} /></Field>
                  <Field label="Memory scope"><Select value={current.memory} onChange={(value) => patch({ memory: value as AgentDraft['memory'] })} options={['None', 'Session', 'Project', 'Persistent']} /></Field>
                  <RangeField label="Context budget" value={current.contextBudget} min={8000} max={128000} step={4000} suffix={Math.round(current.contextBudget / 1000) + 'k'} onChange={(value) => patch({ contextBudget: value })} />
                </div>
              </div>
              <div className="agent-builder__callout"><Icon name="info" size={14} /><span>Identity, instructions and memory scope are presentation configuration. Runtime precedence and enforcement remain outside this component.</span></div>
            </BuilderSection>
          )}

          {tab === 'Capabilities' && (
            <BuilderSection title="Capabilities & tool access" description="Assemble a profile from explicit capabilities, toolsets and optional external surfaces.">
              <div className="agent-builder__capability-grid">
                {capabilityCatalog.map(([name, detail]) => {
                  const active = current.enabledCapabilities.includes(name)
                  return (
                    <button key={name} type="button" className={active ? 'agent-builder__capability agent-builder__capability--active' : 'agent-builder__capability'} onClick={() => toggleCapability(name)}>
                      <span className="agent-builder__capability-icon"><Icon name={name === 'Browser' || name === 'Web search' ? 'globe' : name === 'Terminal' ? 'terminal' : name === 'Git' ? 'git' : name === 'Memory' ? 'database' : name === 'Subagents' ? 'users' : 'tool'} size={14} /></span>
                      <span><strong>{name}</strong><small>{detail}</small></span>
                      <Icon name={active ? 'check' : 'plus'} size={13} />
                    </button>
                  )
                })}
              </div>
              <div className="agent-builder__field-grid agent-builder__field-grid--3">
                <Field label="Toolset"><Select value={current.toolset} onChange={(value) => patch({ toolset: value })} options={['Core safe', 'Repository', 'Research', 'Browser', 'Execution', 'Media']} /></Field>
                <Field label="MCP server"><Select value={current.mcp} onChange={(value) => patch({ mcp: value })} options={['None', 'GitHub', 'Search', 'Browser', 'Filesystem']} /></Field>
                <ToggleField label="Browser automation" value={current.browser} onChange={(value) => patch({ browser: value })} />
                <ToggleField label="Terminal access" value={current.terminal} onChange={(value) => patch({ terminal: value })} />
                <ToggleField label="Subagent delegation" value={current.subagents} onChange={(value) => patch({ subagents: value })} />
                <ToggleField label="Artifact generation" value={current.enabledCapabilities.includes('Artifacts')} onChange={() => toggleCapability('Artifacts')} />
              </div>
            </BuilderSection>
          )}

          {tab === 'Policies' && (
            <BuilderSection title="Policy matrix" description="Configure the visual policy before runtime authorization is connected.">
              <div className="agent-builder__policy-grid">
                {permissionLabels.map((label) => (
                  <div className="agent-builder__policy-row" key={label}>
                    <div><strong>{label}</strong><small>{policyDetail(label)}</small></div>
                    <div className="agent-builder__segmented" role="group" aria-label={label + ' permission'}>
                      {(['Allow', 'Ask', 'Deny'] as Permission[]).map((value) => (
                        <button type="button" key={value} className={current.permissions[label] === value ? 'agent-builder__segmented-button agent-builder__segmented-button--active' : 'agent-builder__segmented-button'} onClick={() => setPermission(label, value)}>{value}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="agent-builder__policy-summary">
                <PolicyStat label="Auto allowed" value={String(Object.values(current.permissions).filter((value) => value === 'Allow').length)} tone="safe" />
                <PolicyStat label="Needs approval" value={String(Object.values(current.permissions).filter((value) => value === 'Ask').length)} tone="warn" />
                <PolicyStat label="Blocked" value={String(Object.values(current.permissions).filter((value) => value === 'Deny').length)} tone="danger" />
              </div>
            </BuilderSection>
          )}

          {tab === 'Test & Release' && (
            <BuilderSection title="Test, compare & release" description="Validate a profile against a repeatable suite, then stage publication without mutating runtime state.">
              <div className="agent-builder__test-hero">
                <div><span className="eyebrow">Composite preview</span><strong>93.8%</strong><p>Latest local presentation score · 12 runs · 3 suites</p></div>
                <div className="agent-builder__score"><span>93</span><small>/100</small></div>
                <button className="studio-button studio-button--active" type="button" onClick={() => onAction('Agent evaluation suite started in preview')}><Icon name="play" size={13} /> Run evaluations</button>
              </div>
              <div className="agent-builder__release-grid">
                <div className="agent-builder__release-card"><span className="eyebrow">Evaluation suite</span><strong>{current.evaluationSuite}</strong><small>48 deterministic preview cases</small><button className="studio-button" type="button" onClick={() => onAction('Evaluation case browser opened in preview')}>Browse cases</button></div>
                <div className="agent-builder__release-card"><span className="eyebrow">Release channel</span><strong>{current.releaseChannel}</strong><small>Changes are staged locally</small><Select value={current.releaseChannel} onChange={(value) => patch({ releaseChannel: value as AgentDraft['releaseChannel'] })} options={['Draft', 'Staged', 'Published']} /></div>
                <div className="agent-builder__release-card"><span className="eyebrow">Compatibility</span><strong>12 / 12 contracts</strong><small>Presentation schema is valid</small><button className="studio-button" type="button" onClick={() => onAction('Compatibility report opened in preview')}><Icon name="check-circle" size={13} /> Inspect</button></div>
              </div>
              <div className="agent-builder__change-list">
                {[
                  ['Identity', current.name + ' · ' + current.scope],
                  ['Model route', current.model + ' → ' + current.fallback],
                  ['Capabilities', current.enabledCapabilities.length + ' enabled'],
                  ['Policy', Object.values(current.permissions).filter((value) => value === 'Ask').length + ' approvals required'],
                ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong><Icon name="chevron-right" size={13} /></div>)}
              </div>
            </BuilderSection>
          )}
        </div>
      </section>
    </div>
  )
}

function BuilderSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="agent-builder__section"><header><div><span className="eyebrow">Configuration</span><h3>{title}</h3><p>{description}</p></div></header><div className="agent-builder__section-body">{children}</div></section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="agent-builder__field"><span>{label}</span>{children}</label>
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option value={option} key={option}>{option}</option>)}</select>
}

function RangeField({ label, value, min, max, step, suffix, onChange }: { label: string; value: number; min: number; max: number; step: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="agent-builder__range"><span><span>{label}</span><strong>{suffix}</strong></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" className={value ? 'agent-builder__toggle agent-builder__toggle--active' : 'agent-builder__toggle'} onClick={() => onChange(!value)} aria-pressed={value}><span><strong>{label}</strong><small>{value ? 'Enabled' : 'Disabled'}</small></span><span className="switch"><span /></span></button>
}

function RouteCard({ label, value, meta }: { label: string; value: string; meta: string }) {
  return <div className="agent-builder__route-card"><span className="eyebrow">{label}</span><strong>{value}</strong><small>{meta}</small></div>
}

function PolicyStat({ label, value, tone }: { label: string; value: string; tone: 'safe' | 'warn' | 'danger' }) {
  return <div className={`agent-builder__policy-stat agent-builder__policy-stat--${tone}`}><span>{label}</span><strong>{value}</strong></div>
}

function policyDetail(label: string) {
  const details: Record<string, string> = {
    'Workspace read': 'Inspect files, manifests and indexed context.',
    'Workspace write': 'Modify repository files inside approved scope.',
    'Terminal': 'Execute shell commands through the selected backend.',
    'Network': 'Reach external providers, sources and services.',
    'Destructive': 'Delete, reset, force or irreversible operations.',
    'MCP': 'Call external MCP capabilities and resources.',
  }
  return details[label] ?? 'Policy-controlled capability.'
}
