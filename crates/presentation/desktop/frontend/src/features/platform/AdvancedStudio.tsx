import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { Panel, Metric, Shell, Tag, Toast } from './PlatformPrimitives'

type ActionProps = { onAction: (message: string) => void }

const models = [
  ['Qwen3 Coder', 'Coding', '256k', 'Fast', '$0.00'],
  ['DeepSeek', 'Reasoning', '128k', 'Medium', '$0.00'],
  ['GPT-OSS 120B', 'General', '128k', 'Fast', '$0.00'],
  ['Claude Sonnet', 'General', '200k', 'Medium', 'Paid'],
] as const

const routes = [
  ['Primary', 'Qwen3 Coder', 'Coding', 'Priority 1', 'Healthy'],
  ['Fast lane', 'GPT-OSS 120B', 'Simple tasks', 'Priority 2', 'Healthy'],
  ['Reasoning', 'DeepSeek', 'Complex analysis', 'Priority 3', 'Healthy'],
  ['Fallback', 'Claude Sonnet', 'Provider failure', 'Priority 4', 'Standby'],
] as const

const versions = [
  ['v0.4.0', 'Production', 'Provider routing + security policies', 'Today'],
  ['v0.3.2', 'Archived', 'Subagent context controls', 'Yesterday'],
  ['v0.3.1', 'Archived', 'MCP capability registry', 'Sep 22'],
  ['v0.3.0', 'Archived', 'Agent Builder baseline', 'Sep 21'],
] as const

const audit = [
  ['16:42:18', 'Agent', 'agent.run', 'Frontend architecture review', 'Completed'],
  ['16:41:52', 'Builder', 'tool.call', 'filesystem.read_file', 'Allowed'],
  ['16:41:21', 'Policy', 'approval.request', 'Provider routing change', 'Pending'],
  ['16:40:07', 'System', 'checkpoint.create', 'CP-029', 'Created'],
  ['16:38:44', 'Reviewer', 'review.complete', 'Regression scan', 'Passed'],
] as const

export function AdvancedStudio({ mode, onAction }: ActionProps & { mode: 'playground' | 'routing' | 'token-observatory' | 'versions' | 'audit' }) {
  const [modelA, setModelA] = useState(models[0][0])
  const [modelB, setModelB] = useState(models[1][0])
  const [selectedRoute, setSelectedRoute] = useState(routes[0][0])
  const [budget, setBudget] = useState(70)
  const [activeVersion, setActiveVersion] = useState(versions[0][0])
  const [filter, setFilter] = useState('')

  const filteredAudit = useMemo(() => {
    const q = filter.toLowerCase().trim()
    return q ? audit.filter((row) => row.join(' ').toLowerCase().includes(q)) : audit
  }, [filter])

  if (mode === 'playground') return (
    <Shell>
      <header className="platform-header">
        <div><span className="eyebrow">Model intelligence</span><h1>Model Playground</h1><p>Compare models against the same prompt without coupling the presentation layer to a provider runtime.</p></div>
        <button className="studio-button studio-button--active" type="button" onClick={() => onAction('Parallel model comparison staged in preview')}><Icon name="play" size={14} /> Run comparison</button>
      </header>
      <div className="platform-grid platform-grid--2">
        <Panel title="Comparison setup">
          <label className="field-label">Model A<select value={modelA} onChange={(e) => setModelA(e.target.value)}>{models.map((m) => <option key={m[0]}>{m[0]}</option>)}</select></label>
          <label className="field-label">Model B<select value={modelB} onChange={(e) => setModelB(e.target.value)}>{models.map((m) => <option key={m[0]}>{m[0]}</option>)}</select></label>
          <label className="field-label">Prompt<textarea defaultValue="Inspect the current frontend architecture and identify the next reversible improvement." /></label>
          <div className="platform-actions"><Tag label="same prompt" /><Tag label="isolated runs" /><Tag label="preview data" /></div>
        </Panel>
        <Panel title="Comparison metrics">
          <Metric label="Context" value="59.9k / 128k" /><Metric label="Tool calling" value="Supported" /><Metric label="Estimated cost" value="Free / Paid" /><Metric label="Latency" value="Awaiting run" />
          <div className="callout"><Icon name="info" size={14} /><span>Results remain presentation-only until provider execution is connected.</span></div>
        </Panel>
      </div>
      <div className="platform-grid platform-grid--2">
        {[modelA, modelB].map((model) => <Panel key={model} title={model}><div className="metric-list"><Metric label="Response" value="Not run" /><Metric label="Tokens" value="—" /><Metric label="Latency" value="—" /><Metric label="Quality" value="—" /></div><div className="diff-preview-block">Run the same prompt to populate a comparable result.</div></Panel>)}
      </div>
      <Toast message="" />
    </Shell>
  )

  if (mode === 'routing') return (
    <Shell>
      <header className="platform-header">
        <div><span className="eyebrow">Provider control plane</span><h1>Routing Studio</h1><p>Define model roles, priorities and fallback behavior as an explicit visual policy.</p></div>
        <button className="studio-button studio-button--active" type="button" onClick={() => onAction('Routing policy staged in preview')}><Icon name="check" size={14} /> Save policy</button>
      </header>
      <div className="routing-flow"><div className="routing-node"><span>REQUEST</span><strong>Agent task</strong></div><Icon name="chevron-right" size={16} /><div className="routing-node routing-node--active"><span>ROUTER</span><strong>Adaptive policy</strong></div><Icon name="chevron-right" size={16} /><div className="routing-node"><span>MODEL</span><strong>{selectedRoute}</strong></div></div>
      <div className="platform-grid platform-grid--2">
        <Panel title="Route priority">{routes.map((route) => <button type="button" key={route[0]} className={selectedRoute === route[0] ? 'task-row task-row--active' : 'task-row'} onClick={() => setSelectedRoute(route[0])}><div><strong>{route[0]}</strong><span>{route[1]} · {route[2]}</span></div><span className="state-pill state-pill--completed">{route[4]}</span></button>)}</Panel>
        <Panel title="Routing rules"><Metric label="Primary" value="Priority + capability" /><Metric label="Fallback" value="Automatic" /><Metric label="Quota aware" value="Enabled" /><Metric label="Health aware" value="Enabled" /><div className="callout"><Icon name="shield" size={14} /><span>No provider credentials or live health state are exposed by this UI.</span></div></Panel>
      </div>
      <Toast message="" />
    </Shell>
  )

  if (mode === 'token-observatory') return (
    <Shell>
      <header className="platform-header">
        <div><span className="eyebrow">Context intelligence</span><h1>Token Observatory</h1><p>Inspect context pressure, budgets, compaction and source allocation before runtime enforcement is connected.</p></div>
        <button className="studio-button studio-button--active" type="button" onClick={() => onAction('Context compaction staged in preview')}><Icon name="archive" size={14} /> Compact preview</button>
      </header>
      <div className="analytics-grid"><div className="platform-metric-card"><span>Context used</span><strong>59.9k</strong><small>46.8% of 128k</small></div><div className="platform-metric-card"><span>Static noise</span><strong>8.2k</strong><small>Candidate for trimming</small></div><div className="platform-metric-card"><span>Duplicates</span><strong>4.7k</strong><small>Candidate for deduplication</small></div><div className="platform-metric-card"><span>Budget headroom</span><strong>68.1k</strong><small>Before model limit</small></div></div>
      <Panel title="Dynamic budget"><div className="budget-slider"><input type="range" min="20" max="100" value={budget} onChange={(e) => setBudget(Number(e.target.value))} /><strong>{budget}%</strong></div><div className="token-stack"><span style={{ width: '14%' }}>System 8.2k</span><span style={{ width: '10%' }}>Memory 4.1k</span><span style={{ width: '12%' }}>Tools 7.3k</span><span style={{ width: '36%' }}>Files 21.4k</span><span style={{ width: '23%' }}>History 13.8k</span></div></Panel>
      <div className="platform-grid platform-grid--2"><Panel title="Optimization pipeline"><div className="pipeline-step"><strong>01 · Trim static noise</strong><span>Remove ANSI/log/formatting overhead</span><Tag label="trimcp candidate" /></div><div className="pipeline-step"><strong>02 · Deduplicate</strong><span>Collapse repeated memory/context</span><Tag label="sqz candidate" /></div><div className="pipeline-step"><strong>03 · Structural compaction</strong><span>Compress context while preserving semantics</span><Tag label="gcf-rust / Ogham candidate" /></div><div className="pipeline-step"><strong>04 · Dynamic trim</strong><span>Trim older turns when physical limits are reached</span><Tag label="runtime policy" /></div></Panel><Panel title="Source allocation"><Metric label="Files" value="35.7%" /><Metric label="History" value="23.0%" /><Metric label="Tools" value="12.2%" /><Metric label="System" value="13.7%" /><Metric label="Other" value="15.4%" /></Panel></div>
      <Toast message="" />
    </Shell>
  )

  if (mode === 'versions') return (
    <Shell>
      <header className="platform-header">
        <div><span className="eyebrow">Change control</span><h1>Agent Versions</h1><p>Track immutable agent configurations, drafts, production releases and rollback previews.</p></div>
        <button className="studio-button studio-button--active" type="button" onClick={() => onAction('New agent version staged in preview')}><Icon name="plus" size={14} /> New version</button>
      </header>
      <div className="version-layout"><div className="version-list">{versions.map((version) => <button type="button" key={version[0]} className={activeVersion === version[0] ? 'task-row task-row--active' : 'task-row'} onClick={() => setActiveVersion(version[0])}><div><strong>{version[0]}</strong><span>{version[2]}</span></div><span className="state-pill state-pill--completed">{version[1]}</span></button>)}</div><Panel title={activeVersion}><Metric label="Configuration" value="Immutable snapshot" /><Metric label="Model" value="Qwen3 Coder" /><Metric label="Tools" value="18 enabled" /><Metric label="Memory policy" value="Scoped" /><div className="platform-actions"><button className="studio-button" type="button" onClick={() => onAction('Version diff opened in preview')}>Compare diff</button><button className="studio-button" type="button" onClick={() => onAction('Rollback preview opened')}>Rollback preview</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Version promoted in preview')}>Promote</button></div></Panel></div>
      <Panel title="Configuration diff"><pre className="diff-preview-block">model: qwen3-coder → gpt-oss-120b
contextBudget: 128k → 96k
approvalPolicy: sensitive → sensitive
toolset: core-safe → core-safe + browser</pre></Panel>
      <Toast message="" />
    </Shell>
  )

  return (
    <Shell>
      <header className="platform-header">
        <div><span className="eyebrow">Governance</span><h1>Audit Log</h1><p>Chronological evidence of agent, tool, policy and workspace events.</p></div>
        <div className="platform-header__actions"><input className="studio-input" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter events..." aria-label="Filter audit events" /></div>
      </header>
      <Panel title="Audit events"><div className="log-table">{filteredAudit.map((row) => <div className="log-row" key={row[0] + row[2]}><span>{row[0]}</span><span>{row[1]}</span><strong>{row[2]}</strong><span>{row[3]}</span><Tag label={row[4]} /></div>)}</div></Panel>
      <div className="platform-grid platform-grid--2"><Panel title="Event categories"><Metric label="Agent actions" value="42" /><Metric label="Tool calls" value="128" /><Metric label="Policy checks" value="64" /><Metric label="Approvals" value="9" /></Panel><Panel title="Retention"><Metric label="Local evidence" value="30 days" /><Metric label="Secrets" value="Redacted" /><Metric label="Export" value="JSON / CSV" /><Metric label="Backend" value="Not connected" /></Panel></div>
      <Toast message="" />
    </Shell>
  )
}
