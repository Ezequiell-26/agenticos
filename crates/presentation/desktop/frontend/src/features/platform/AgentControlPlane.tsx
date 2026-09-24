import './AgentControlPlane.css'
import { useEffect, useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { runtime } from '../../services/runtime'
import { Panel, Metric, Tag } from './PlatformPrimitives'

type Props = { onAction: (message: string) => void }

type AgentRow = readonly [string, string, string, string, string, string]

const agents: ReadonlyArray<AgentRow> = [
  ['Builder', 'Implementation', 'Qwen3 Coder', '18', 'Balanced', 'Workspace'],
  ['Reviewer', 'Quality gate', 'GPT-OSS 120B', '11', 'Strict', 'Workspace'],
  ['Researcher', 'Evidence', 'DeepSeek', '9', 'Grounded', 'Research'],
  ['Release Bot', 'Release automation', 'Auto route', '13', 'Fail-closed', 'CI'],
]

const controls = [
  ['Planning depth', 'How much decomposition the agent performs before acting.', 'Deep'],
  ['Autonomy', 'Maximum action freedom before human approval.', 'Guarded'],
  ['Context policy', 'Sources eligible for automatic context assembly.', 'Curated'],
  ['Failure strategy', 'Behavior after a failed tool or verification step.', 'Recover + checkpoint'],
  ['Handoff policy', 'Required package when work moves between agents.', 'Evidence required'],
  ['Memory write', 'Conditions under which run outcomes become memory.', 'Review first'],
]

const budgets = [
  ['Context window', '128k', '72% allocated'],
  ['Output budget', '16k', '9.4k reserved'],
  ['Tool turns', '48', '31 used'],
  ['Wall time', '30m', '18m remaining'],
]

export function AgentControlPlane({ onAction }: Props) {
  const [liveAgents, setLiveAgents] = useState(agents)
  const [selected, setSelected] = useState(agents[0][0])
  const [tab, setTab] = useState<'policy' | 'budget' | 'behavior'>('policy')
  const [armed, setArmed] = useState(false)
  const [runtimeSyncing, setRuntimeSyncing] = useState(true)

  useEffect(() => {
    let cancelled = false
    void runtime.subagents.list().then((remote) => {
      if (cancelled || remote.length === 0) return
      const mapped = remote.map((agent, index) => {
        const id = typeof agent.agent_id === 'string' ? agent.agent_id : 'runtime-' + (index + 1)
        const role = typeof agent.role === 'string' ? agent.role : 'Runtime agent'
        const toolCount = Array.isArray(agent.capabilities) ? agent.capabilities.length : 0
        return [id, role, 'Runtime-selected', String(toolCount), 'Runtime', 'Runtime'] as const
      })
      setLiveAgents(mapped)
      setSelected((currentId) => mapped.some((agent) => agent[0] === currentId) ? currentId : mapped[0][0])
    }).catch(() => {}).finally(() => { if (!cancelled) setRuntimeSyncing(false) })
    return () => { cancelled = true }
  }, [])

  async function testAgent() {
    try {
      await runtime.reasoning.plan('Test execution profile for agent ' + selectedAgent[0] + '. Validate decomposition, boundaries and verification requirements.')
      onAction(selectedAgent[0] + ' runtime preflight completed')
    } catch (error) {
      onAction(error instanceof Error ? error.message : 'Runtime agent test failed')
    }
  }
  const selectedAgent = useMemo(() => liveAgents.find((item) => item[0] === selected) ?? liveAgents[0], [liveAgents, selected])

  return (
    <section className="agent-control-plane">
      <div className="platform-grid platform-grid--4">
        <Metric label="Active agents" value={String(liveAgents.length)} />
        <Metric label="Guarded actions" value="17" />
        <Metric label="Pending approvals" value="Runtime" />
        <Metric label="Context headroom" value="28%" />
      </div>

      <div className="agent-control-layout">
        <Panel title="Agent fleet">
          <div className="platform-list">
            {liveAgents.map(([name, role, model, tools, mode, scope]) => (
              <button type="button" key={name} className={selected === name ? 'agent-control-row agent-control-row--active' : 'agent-control-row'} onClick={() => setSelected(name)}>
                <span className="agent-control-row__icon"><Icon name="bot" size={14} /></span>
                <span><strong>{name}</strong><small>{role} · {model}</small></span>
                <span className="agent-control-row__meta"><Tag label={mode} /><small>{tools} tools · {scope}</small></span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title={selectedAgent[0]}>
          <div className="agent-control-identity">
            <div><span className="eyebrow">{selectedAgent[1]}</span><h2>{selectedAgent[0]}</h2><p>Explicit execution profile. Runtime enforcement remains outside this presentation layer.</p></div>
            <span className="state-pill state-pill--completed">{runtimeSyncing ? 'Syncing' : 'Runtime configured'}</span>
          </div>
          <div className="agent-control-tabs" role="tablist" aria-label="Agent configuration">
            {(['policy', 'budget', 'behavior'] as const).map((item) => (
              <button key={item} type="button" className={tab === item ? 'studio-button studio-button--active' : 'studio-button'} onClick={() => setTab(item)} role="tab" aria-selected={tab === item}>{item}</button>
            ))}
          </div>

          {tab === 'policy' && <div className="agent-control-fields">{controls.map(([label, detail, value]) => <div className="agent-control-field" key={label}><div><strong>{label}</strong><span>{detail}</span></div><button type="button" className="studio-button" onClick={() => onAction(label + ' editor opened in preview')}>{value}<Icon name="chevron-right" size={12} /></button></div>)}</div>}

          {tab === 'budget' && <div className="platform-grid platform-grid--2">{budgets.map(([label, value, detail]) => <div className="agent-budget-card" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small><div className="agent-budget-bar"><i style={{ width: label === 'Context window' ? '72%' : label === 'Output budget' ? '59%' : label === 'Tool turns' ? '65%' : '40%' }} /></div></div>)}</div>}

          {tab === 'behavior' && <div className="agent-behavior-stack"><div><strong>Before action</strong><span>Resolve scope → inspect policy → estimate risk → request approval when required.</span></div><div><strong>After action</strong><span>Capture result → attach artifact → update task state → emit audit event.</span></div><div><strong>On failure</strong><span>Stop unsafe continuation → preserve evidence → propose recovery → checkpoint before retry.</span></div></div>}

          <div className="platform-actions">
            <button className="studio-button" type="button" onClick={() => onAction('Agent configuration diff opened in preview')}>View diff</button>
            <button className="studio-button" type="button" onClick={() => void testAgent()}><Icon name="play" size={13} /> Test agent</button>
            <button className={armed ? 'studio-button studio-button--active' : 'studio-button'} type="button" onClick={() => { setArmed((value) => !value); onAction(armed ? 'Deployment preview disarmed' : 'Deployment preview armed') }}><Icon name="shield" size={13} /> {armed ? 'Disarm release' : 'Arm release preview'}</button>
          </div>
        </Panel>
      </div>

      <div className="platform-grid platform-grid--2">
        <Panel title="Execution contract">
          <div className="agent-contract-list">
            <div><span>Workspace scope</span><strong>Current project only</strong></div>
            <div><span>Network</span><strong>Policy-gated</strong></div>
            <div><span>Secrets</span><strong>Never exposed to model UI</strong></div>
            <div><span>Destructive actions</span><strong>Human approval</strong></div>
            <div><span>Verification</span><strong>Required before completion</strong></div>
            <div><span>Rollback</span><strong>Checkpoint preferred</strong></div>
          </div>
        </Panel>
        <Panel title="Agent lifecycle">
          <div className="agent-lifecycle">
            {['Draft', 'Test', 'Review', 'Approved', 'Published', 'Retired'].map((step, index) => <div key={step} className={index < 4 ? 'agent-lifecycle__step agent-lifecycle__step--done' : 'agent-lifecycle__step'}><span>{index + 1}</span><strong>{step}</strong></div>)}
          </div>
          <div className="platform-actions"><button className="studio-button" type="button" onClick={() => onAction('Rollback preview opened')}>Rollback preview</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Publish preview staged')}>Publish preview</button></div>
        </Panel>
      </div>
    </section>
  )
}
