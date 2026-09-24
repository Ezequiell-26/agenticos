import { useEffect, useState, type ReactNode } from 'react'
import Icon from '../../components/Icon'
import { runtime } from '../../services/runtime'

type AgentTab = 'Overview' | 'Behavior' | 'Tools' | 'Policies' | 'Tests'

const agents: ReadonlyArray<readonly [string, string, string, string, string]> = [
  ['Builder', 'Implementation specialist', 'Qwen3 Coder', '18 tools', 'Production'],
  ['Reviewer', 'Quality and regression analyst', 'GPT-OSS 120B', '11 tools', 'Production'],
  ['Researcher', 'Evidence and source specialist', 'DeepSeek', '9 tools', 'Experimental'],
  ['Planner', 'Architecture and task decomposition', 'Auto route', '6 tools', 'Draft'],
] as const

const toolsets = ['Core safe', 'Repository', 'Browser', 'Research', 'Execution']
const tests = [
  ['Code correctness', '48 cases', '93.8%'],
  ['Tool discipline', '32 cases', '96.4%'],
  ['Verification handoff', '24 cases', '91.7%'],
]

export default function AgentStudio({ onAction }: { onAction: (message: string) => void }) {
  const [profiles, setProfiles] = useState(agents)
  const [selected, setSelected] = useState(agents[0][0])
  const [tab, setTab] = useState<AgentTab>('Overview')
  const [runtimeSyncing, setRuntimeSyncing] = useState(true)
  const [enabledTools, setEnabledTools] = useState(() => new Set(toolsets.slice(0, 3)))
  const current = profiles.find((agent) => agent[0] === selected) ?? profiles[0]

  useEffect(() => {
    let cancelled = false
    void runtime.subagents.list().then((remote) => {
      if (cancelled || remote.length === 0) return
      const mapped = remote.map((agent, index) => {
        const id = typeof agent.agent_id === 'string' ? agent.agent_id : `runtime-${index + 1}`
        const role = typeof agent.role === 'string' ? agent.role : 'Runtime agent'
        const capabilities = Array.isArray(agent.capabilities) ? agent.capabilities.filter((item): item is string => typeof item === 'string') : []
        return [id, role, 'Runtime-selected', capabilities.length + ' capabilities', 'Runtime'] as const
      })
      setProfiles(mapped)
      setSelected((currentSelected) => mapped.some((agent) => agent[0] === currentSelected) ? currentSelected : mapped[0][0])
    }).catch(() => {
      // Keep the local catalog while the runtime is unavailable.
    }).finally(() => { if (!cancelled) setRuntimeSyncing(false) })
    return () => { cancelled = true }
  }, [])

  async function saveCurrent() {
    try {
      await runtime.subagents.create({
        agent_id: current[0],
        role: current[1],
        capabilities: Array.from(enabledTools).map((tool) => tool.toLowerCase().replace(/\s+/g, '-')),
        providers: [],
        skills: [],
        sandbox_profile: 'default',
        budget: { max_tokens: 32000, max_wall_seconds: 1800, max_tool_calls: 128, max_depth: 4 },
      })
      onAction(current[0] + ' saved to runtime')
    } catch (error) {
      onAction(error instanceof Error ? error.message : 'Runtime agent save failed')
    }
  }

  async function duplicateCurrent() {
    try {
      const id = current[0].toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-copy-' + Date.now()
      await runtime.subagents.create({
        agent_id: id,
        role: current[1],
        capabilities: Array.from(enabledTools).map((tool) => tool.toLowerCase().replace(/\s+/g, '-')),
        providers: [],
        skills: [],
        sandbox_profile: 'default',
        budget: { max_tokens: 32000, max_wall_seconds: 1800, max_tool_calls: 128, max_depth: 4 },
      })
      const refreshed = await runtime.subagents.list()
      const mapped = refreshed.map((agent, index) => [typeof agent.agent_id === 'string' ? agent.agent_id : 'runtime-' + (index + 1), typeof agent.role === 'string' ? agent.role : 'Runtime agent', 'Runtime-selected', Array.isArray(agent.capabilities) ? agent.capabilities.length + ' capabilities' : '0 capabilities', 'Runtime'] as const)
      setProfiles(mapped)
      setSelected(id)
      onAction('Duplicated agent saved to runtime')
    } catch (error) {
      onAction(error instanceof Error ? error.message : 'Runtime agent duplication failed')
    }
  }

  async function testCurrent() {
    try {
      await runtime.reasoning.plan('Test agent profile ' + current[0] + ': validate role, capability boundaries and safe execution behavior.')
      onAction(current[0] + ' runtime preflight completed')
    } catch (error) {
      onAction(error instanceof Error ? error.message : 'Runtime agent test failed')
    }
  }

  function toggleTool(tool: string) {
    setEnabledTools((state) => {
      const next = new Set(state)
      next.has(tool) ? next.delete(tool) : next.add(tool)
      return next
    })
    onAction(tool + ' toolset toggled for ' + current[0])
  }

  return (
    <div className="agent-studio">
      <aside className="agent-studio__list">
        <div className="agent-studio__list-head"><span>Profiles</span><span className="count-pill">{profiles.length}</span></div>
        {profiles.map(([name, detail, model, tools, state]) => <button type="button" key={name} className={selected === name ? 'agent-studio__row agent-studio__row--active' : 'agent-studio__row'} onClick={() => setSelected(name)}><span className="agent-studio__avatar"><Icon name="bot" size={14} /></span><div><strong>{name}</strong><small>{detail}</small><span>{model} · {tools}</span></div><span className={state === 'Production' ? 'status-dot status-dot--live' : 'status-dot status-dot--offline'} /></button>)}
        <button className="studio-button" type="button" onClick={() => void duplicateCurrent()}><Icon name="code" size={13} /> Duplicate</button>
      </aside>

      <section className="agent-studio__main">
        <header className="agent-studio__head"><div><span className="eyebrow">{runtimeSyncing ? 'Syncing runtime' : current[4]}</span><h2>{current[0]}</h2><p>{current[1]}</p></div><div className="agent-studio__head-actions"><button className="studio-button" type="button" onClick={() => void testCurrent()}><Icon name="play" size={13} /> Test</button><button className="studio-button studio-button--active" type="button" onClick={() => void saveCurrent()}><Icon name="check" size={13} /> Save</button></div></header>
        <div className="agent-studio__tabs" role="tablist" aria-label="Agent profile" aria-orientation="horizontal">
          {(['Overview','Behavior','Tools','Policies','Tests'] as AgentTab[]).map((item, index, tabs) => <button type="button" key={item} id={'agent-studio-tab-' + item.toLowerCase()} role="tab" tabIndex={tab === item ? 0 : -1} aria-selected={tab === item} aria-controls="agent-studio-tabpanel" className={tab === item ? 'agent-studio__tab agent-studio__tab--active' : 'agent-studio__tab'} onClick={() => setTab(item)} onKeyDown={(event) => {
            const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
            if (nextIndex >= 0) { event.preventDefault(); const next = tabs[nextIndex]; setTab(next); window.requestAnimationFrame(() => document.getElementById('agent-studio-tab-' + next.toLowerCase())?.focus()) }
          }}>{item}</button>)}
        </div>
        <div id="agent-studio-tabpanel" className="agent-studio__content" role="tabpanel" aria-labelledby={'agent-studio-tab-' + tab.toLowerCase()} tabIndex={0}>
          {tab === 'Overview' && <div className="agent-profile-editor"><div className="agent-profile-hero"><div className="agent-profile-orb"><Icon name="bot" size={28} /></div><div><strong>{current[0]}</strong><span>{current[1]}</span><small>{current[2]} · {current[3]}</small></div></div><div className="agent-control-grid"><Metric label="Planning" value="Guarded" /><Metric label="Verification" value="Required" /><Metric label="Context" value="Explicit" /><Metric label="Handoff" value="Enabled" /></div><div className="agent-slider-grid"><Range label="Creativity" value="35" /><Range label="Autonomy" value="58" /><Range label="Tool budget" value="72" /></div></div>}
          {tab === 'Behavior' && <div className="agent-form-grid"><Field label="Instruction"><textarea defaultValue={'You are a specialist agent. Work in explicit phases: inspect, plan, execute, verify, handoff.'} /></Field><Field label="Response style"><select defaultValue="Technical"><option>Technical</option><option>Concise</option><option>Detailed</option><option>Teaching</option></select></Field><Field label="Default mode"><select defaultValue="Agent"><option>Agent</option><option>Plan</option><option>Ask</option><option>Debug</option></select></Field><Field label="Failure policy"><select defaultValue="Fail closed"><option>Fail closed</option><option>Retry bounded</option><option>Stop and ask</option></select></Field></div>}
          {tab === 'Tools' && <div className="agent-toolset-list">{toolsets.map((tool) => <button type="button" key={tool} className={enabledTools.has(tool) ? 'agent-toolset agent-toolset--active' : 'agent-toolset'} onClick={() => toggleTool(tool)}><span><Icon name="tool" size={13} /></span><div><strong>{tool}</strong><small>{enabledTools.has(tool) ? 'Enabled for profile' : 'Available'}</small></div><Icon name={enabledTools.has(tool) ? 'check' : 'more'} size={13} /></button>)}</div>}
          {tab === 'Policies' && <div className="agent-policy-list"><Row name="Read workspace" value="Auto" /><Row name="Write files" value="Confirm" /><Row name="Network" value="Confirm" /><Row name="Destructive" value="Block" /><Row name="Secrets" value="Never exposed" /></div>}
          {tab === 'Tests' && <div className="agent-tests"><div className="agent-test-summary"><strong>91.7%</strong><span>Composite preview score</span><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Agent evaluation preflight started in runtime')}><Icon name="play" size={13} /> Run preflight</button></div>{tests.map(([name, cases, score]) => <div className="agent-test-row" key={name}><div><strong>{name}</strong><small>{cases}</small></div><span>{score}</span><Icon name="chevron-right" size={13} /></div>)}</div>}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="agent-control-card"><span>{label}</span><strong>{value}</strong></div> }
function Range({ label, value }: { label: string; value: string }) { return <label className="agent-range"><span>{label}<strong>{value}%</strong></span><input type="range" min="0" max="100" defaultValue={value} /></label> }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="agent-field"><span>{label}</span>{children}</label> }
function Row({ name, value }: { name: string; value: string }) { return <div className="agent-policy-row"><span>{name}</span><strong>{value}</strong></div> }
