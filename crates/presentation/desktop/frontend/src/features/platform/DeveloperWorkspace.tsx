import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { MetricCard, Panel, Tag } from './PlatformPrimitives'

type DevTab = 'build' | 'parallel' | 'design' | 'review' | 'context' | 'automation' | 'skills' | 'environments' | 'activity'

const files = [
  ['src/agents/runtime.rs', 'Rust', 'modified'],
  ['src/kernel/router.rs', 'Rust', 'modified'],
  ['src/domain/contracts.rs', 'Rust', 'clean'],
  ['frontend/src/navigation.ts', 'TypeScript', 'modified'],
  ['docs/architecture/BACKEND-ARCHITECTURE-MAP.md', 'Markdown', 'clean'],
  ['crates/presentation/desktop/frontend/src/components/App.tsx', 'TypeScript', 'modified'],
] as const

const symbols = ['ReactAgent', 'ModelProvider', 'ToolRegistry', 'RuntimeState', 'NavigationItem', 'ContextBudget', 'ExecutionPolicy']
const nextEdits = [
  ['Tighten runtime status semantics', 'App.tsx: runtime chip', 'low', 'preserve existing state'],
  ['Extract provider route type', 'PlatformSurface.tsx: navigation', 'medium', 'remove drift'],
  ['Add regression test fixture', 'QualityWorkbench.tsx: coverage', 'low', 'verification first'],
  ['Add context budget guard', 'ChatSurface.tsx: composer', 'medium', 'fail closed'],
] as const
const patchStack = [
  ['Patch 01', 'Workspace Dock semantics', 'applied', '+18 / -5'],
  ['Patch 02', 'Search focus lifecycle', 'applied', '+42 / -11'],
  ['Patch 03', 'Developer Workspace', 'review', '+1,139 / -108'],
]
const testSuites = [
  ['TypeScript', 'tsc --noEmit', 'required', 'pending'],
  ['Frontend build', 'vite build', 'required', 'pending'],
  ['Interaction', 'keyboard + menus', 'recommended', 'pending'],
  ['Accessibility', 'semantics + focus', 'required', 'pending'],
  ['Visual regression', 'viewport snapshots', 'recommended', 'pending'],
] as const

const lanes = [
  ['Builder', 'Implement feature slice', 'coding', 'worktree/builder', '72%', '+184 / -37', 'Qwen3 Coder'],
  ['Reviewer', 'Audit regression + contracts', 'reviewing', 'worktree/reviewer', '54%', '+0 / -0', 'Reasoner'],
  ['Researcher', 'Gather implementation evidence', 'research', 'worktree/research', '41%', '+0 / -0', 'DeepSeek'],
  ['QA', 'Visual + accessibility verification', 'verifying', 'worktree/qa', '33%', '+12 / -3', 'Vision'],
] as const

const reviewFindings = [
  ['REV-041', 'Medium', 'Focus restore should be verified after nested dialog close', 'CommandPalette.tsx'],
  ['REV-038', 'Low', 'Move repeated preview labels to shared metadata', 'DeveloperWorkspace.tsx'],
  ['SEC-014', 'High', 'External endpoint requires explicit network policy', 'IntegrationControlCenter.tsx'],
] as const

const contextSources = [
  ['Open files', '8.4k', 'included'],
  ['Project rules', '3.2k', 'included'],
  ['Pinned memory', '2.7k', 'included'],
  ['Git diff', '5.1k', 'included'],
  ['Repository map', '18.6k', 'included'],
  ['Web evidence', '6.2k', 'optional'],
] as const

const automations = [
  ['Nightly regression audit', 'Every day · 02:00', 'enabled', 'frontend + tests'],
  ['PR review sweep', 'On pull request', 'enabled', 'review + security'],
  ['Dependency watch', 'Every 6 hours', 'paused', 'package drift'],
  ['Weekly architecture digest', 'Monday · 09:00', 'draft', 'reports + trends'],
] as const

const skills = [
  ['ui-review', 'Visual UX audit + interaction checklist', 'installed'],
  ['safe-refactor', 'Bounded refactor with rollback checkpoints', 'installed'],
  ['browser-qa', 'Browser evidence + accessibility pass', 'installed'],
  ['pr-review', 'Diff, security and regression analysis', 'available'],
  ['migration-planner', 'Multi-step migration planning', 'available'],
] as const

const environments = [
  ['Local Desktop', 'Local filesystem + terminal', 'ready', 'Offline capable'],
  ['Feature Worktree', 'Isolated Git worktree', 'ready', 'Clean branch'],
  ['Cloud Agent', 'Remote sandboxed worker', 'available', 'Awaiting adapter'],
  ['Remote SSH', 'Configured development host', 'policy', 'Approval required'],
] as const

const activity = [
  ['08:52', 'QA', 'Accessibility contract updated', 'verified'],
  ['08:47', 'Builder', 'Workspace Dock interaction hardening', 'changed'],
  ['08:41', 'Reviewer', 'Command Palette focus audit', 'finding'],
  ['08:34', 'Researcher', 'Current agent UX capability scan', 'evidence'],
  ['08:21', 'System', 'Frontend verification workflow started', 'running'],
] as const

export function DeveloperWorkspace({ onAction }: { onAction: (message: string) => void }) {
  const [active, setActive] = useState<(typeof files)[number][0]>(files[0][0])
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<DevTab>('build')
  const [selectedLane, setSelectedLane] = useState<(typeof lanes)[number][0]>(lanes[0][0])
  const [selectedSkill, setSelectedSkill] = useState<(typeof skills)[number][0]>(skills[0][0])
  const [selectedEnvironment, setSelectedEnvironment] = useState<(typeof environments)[number][0]>(environments[0][0])
  const [visualPrompt, setVisualPrompt] = useState('')
  const [browserUrl, setBrowserUrl] = useState('http://localhost:5173')
  const [designSelection, setDesignSelection] = useState<string[]>(['Hero'])
  const [designModeEnabled, setDesignModeEnabled] = useState(true)
  const [voiceQueue, setVoiceQueue] = useState<string[]>([])
  const [autonomy, setAutonomy] = useState<'suggest' | 'supervised' | 'autonomous'>('supervised')
  const [sandbox, setSandbox] = useState<'local' | 'worktree' | 'cloud'>('worktree')
  const [approvalGate, setApprovalGate] = useState(true)
  const [safeEditsOnly, setSafeEditsOnly] = useState(true)

  const filtered = useMemo(() => files.filter((file) => file[0].toLowerCase().includes(query.toLowerCase())), [query])
  const lane = lanes.find((item) => item[0] === selectedLane) ?? lanes[0]
  const environment = environments.find((item) => item[0] === selectedEnvironment) ?? environments[0]
  const designTargets = ['Hero', 'Navigation', 'Composer', 'Sidebar', 'Responsive shell']

  const tabs: Array<[DevTab, string, string]> = [
    ['build', 'Build', 'Editor, search and agent edit loop'],
    ['parallel', 'Parallel', 'Multi-agent lanes and worktrees'],
    ['design', 'Design', 'Browser, visual prompts and UI verification'],
    ['review', 'Review', 'PR findings, checks and security'],
    ['context', 'Context', 'Sources, budgets and compaction'],
    ['automation', 'Automation', 'Schedules, triggers and long-running jobs'],
    ['skills', 'Skills', 'Reusable agent procedures'],
    ['environments', 'Environments', 'Local, worktree, cloud and SSH'],
    ['activity', 'Activity', 'Unified agent and workspace timeline'],
  ]

  return (
    <div className="studio-shell developer-workspace-pro">
      <header className="platform-header developer-workspace-pro__hero">
        <div>
          <span className="eyebrow">AI engineering command center</span>
          <h1>Developer Workspace</h1>
          <p>Build, delegate, inspect, design, review, verify and automate from one agent-native development surface.</p>
          <div className="developer-capability-strip">
            <Tag label="Multi-agent" />
            <Tag label="Worktrees" />
            <Tag label="Browser design" />
            <Tag label="PR review" />
            <Tag label="Context engine" />
            <Tag label="Automations" />
          </div>
        </div>
        <div className="platform-header__actions developer-workspace-pro__actions">
          <label className="developer-compact-control"><span>Autonomy</span><select value={autonomy} onChange={(event) => setAutonomy(event.target.value as typeof autonomy)}><option value="suggest">Suggest</option><option value="supervised">Supervised</option><option value="autonomous">Autonomous</option></select></label>
          <label className="developer-compact-control"><span>Sandbox</span><select value={sandbox} onChange={(event) => setSandbox(event.target.value as typeof sandbox)}><option value="local">Local</option><option value="worktree">Worktree</option><option value="cloud">Cloud</option></select></label>
          <button className={approvalGate ? 'studio-button studio-button--active' : 'studio-button'} type="button" aria-pressed={approvalGate} onClick={() => setApprovalGate((value) => !value)}><Icon name="shield" size={13} /> {approvalGate ? 'Approval gate on' : 'Approval gate off'}</button><button className={safeEditsOnly ? 'studio-button studio-button--active' : 'studio-button'} type="button" aria-pressed={safeEditsOnly} onClick={() => setSafeEditsOnly((value) => !value)}><Icon name="lock" size={13} /> {safeEditsOnly ? 'Safe edits only' : 'Broad edits'}</button>
          <button className="studio-button studio-button--active" type="button" onClick={() => onAction('Start engineering mission staged in preview')}><Icon name="play" size={14} /> Start mission</button>
        </div>
      </header>

      <div className="platform-metrics developer-workspace-pro__metrics">
        <MetricCard label="Active agents" value="4" sub="2 coding · 2 support" />
        <MetricCard label="Parallel lanes" value="4" sub="Isolated worktrees" />
        <MetricCard label="Context" value="68%" sub="Budget currently used" />
        <MetricCard label="Verification" value="18 / 24" sub="6 checks pending" />
        <MetricCard label="Review findings" value="3" sub="1 high · 1 medium · 1 low" />
        <MetricCard label="Automations" value="2" sub="Running or scheduled" />
      </div>

      <div className="developer-workspace-pro__tabs" role="tablist" aria-label="Developer workspace">
        {tabs.map(([id, label, detail]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={'developer-panel-' + id}
            className={tab === id ? 'developer-pro-tab developer-pro-tab--active' : 'developer-pro-tab'}
            title={detail}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'build' && (
        <div className="developer-pro-layout" id="developer-panel-build" role="tabpanel">
          <Panel title="Repository">
            <div className="developer-toolbar developer-toolbar--pro">
              <div className="developer-search-pro"><Icon name="search" size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search files, symbols and paths…" aria-label="Search repository" /></div>
              <button className="studio-button" type="button" onClick={() => onAction('Command palette opened in preview')}><Icon name="command" size={13} /> Commands</button>
            </div>
            <div className="developer-file-list developer-file-list--pro">
              {(query ? filtered : files).map((file) => (
                <button key={file[0]} type="button" aria-current={active === file[0] ? 'page' : undefined} className={active === file[0] ? 'developer-file developer-file--active' : 'developer-file'} onClick={() => setActive(file[0])}>
                  <Icon name={file[1] === 'Markdown' ? 'file' : 'file-code'} size={14} />
                  <span>{file[0]}</span>
                  <Tag label={file[2]} />
                </button>
              ))}
            </div>
            <div className="developer-symbol-block">
              <span className="eyebrow">Symbols</span>
              {symbols.map((symbol) => <button key={symbol} className="developer-symbol" type="button" onClick={() => onAction('Symbol ' + symbol + ' selected')}>{symbol}<small>definition · references</small></button>)}
            </div>
          </Panel>
          <Panel title={active}>
            <div className="developer-editor-head">
              <div><strong>{active}</strong><span>main · {sandbox} sandbox · safe edit mode</span></div>
              <div className="developer-editor-actions">
                <button className="studio-button" type="button" onClick={() => onAction('Explain selection staged in preview')}>Explain</button>
                <button className="studio-button" type="button" onClick={() => onAction('Inline edit staged in preview')}>Edit</button>
                <button className="studio-button studio-button--active" type="button" onClick={() => onAction('Patch review staged in preview')}><Icon name="spark" size={13} /> Agent patch</button>
              </div>
            </div>
            <div className="developer-next-edit-strip">
              <div><span className="eyebrow">Next edit suggestions</span><strong>Agent sees 4 high-confidence follow-up opportunities</strong></div>
              <div className="developer-next-edit-list">{nextEdits.map(([title, location, risk]) => <button key={title} type="button" onClick={() => onAction('Suggested edit ' + title + ' selected')}><span><strong>{title}</strong><small>{location}</small></span><Tag label={risk} /></button>)}</div>
            </div>
            <div className="developer-editor-grid">
              <pre className="code-preview developer-code-preview">{'// Agent-assisted preview\n// Work remains behind review and approval boundaries.\n\nfn execute_turn(message: &str) -> Result<AgentResponse> {\n    let context = context_budget.pack(message)?;\n    let response = provider.complete(context)?;\n    event_store.append(response.events())?;\n    Ok(response)\n}'}</pre>
              <aside className="developer-inline-inspector">
                <span className="eyebrow">Agent loop</span>
                <strong>Plan → Edit → Test → Review</strong>
                <div><span>Model</span><b>Auto route</b></div>
                <div><span>Context</span><b>68%</b></div>
                <div><span>Risk</span><b>Medium</b></div>
                <div><span>Checkpoint</span><b>Ready</b></div>
                <button className="studio-button" type="button" onClick={() => onAction('Checkpoint capture staged in preview')}>Create checkpoint</button>
              </aside>
            </div>
            <div className="developer-bottom-grid">
              <div className="developer-patch-stack">
                <div className="developer-bottom-head"><span className="eyebrow">Patch stack</span><button className="studio-button" type="button" onClick={() => onAction('Patch stack diff opened in preview')}>View diff</button></div>
                {patchStack.map(([id, title, state, delta]) => <button key={id} type="button" className="developer-patch-row" onClick={() => onAction(id + ' selected')}><span><strong>{id}</strong><small>{title}</small></span><Tag label={state} /><b>{delta}</b></button>)}
              </div>
              <div className="developer-test-explorer">
                <div className="developer-bottom-head"><span className="eyebrow">Test explorer</span><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Targeted test suite staged in preview')}>Run selected</button></div>
                {testSuites.map(([name, command, gate, state]) => <div key={name} className="developer-test-row"><span className="developer-test-icon"><Icon name={state === 'passed' ? 'check' : 'clock'} size={12} /></span><span><strong>{name}</strong><small>{command}</small></span><Tag label={gate} /><span className="mono-text">{state}</span></div>)}
              </div>
            </div>
          </Panel>
        </div>
      )}

      {tab === 'parallel' && (
        <div className="developer-pro-grid">
          <Panel title="Agent lanes">
            <div className="developer-lane-list">
              {lanes.map(([name, goal, state, worktree, context, delta, model]) => (
                <button key={name} type="button" className={selectedLane === name ? 'developer-lane developer-lane--active' : 'developer-lane'} onClick={() => setSelectedLane(name)}>
                  <span className="developer-lane__avatar"><Icon name="bot" size={14} /></span>
                  <span><strong>{name}</strong><small>{goal}</small><em>{worktree}</em></span>
                  <span className="developer-lane__meta"><Tag label={state} /><b>{context}</b><small>{delta} · {model}</small></span>
                </button>
              ))}
            </div>
          </Panel>
          <Panel title={lane[0]}>
            <div className="developer-lane-detail">
              <div className="developer-lane-detail__hero"><div><span className="eyebrow">Selected lane</span><h2>{lane[1]}</h2><p>Isolated branch with dedicated context, model and verification state.</p></div><Tag label={lane[2]} /></div>
              <div className="developer-detail-grid"><div><span>Worktree</span><strong>{lane[3]}</strong></div><div><span>Context</span><strong>{lane[4]}</strong></div><div><span>Diff</span><strong>{lane[5]}</strong></div><div><span>Model</span><strong>{lane[6]}</strong></div></div>
              <div className="platform-actions"><button className="studio-button" type="button" onClick={() => onAction('Send follow-up to '+lane[0]+' staged in preview')}>Follow up</button><button className="studio-button" type="button" onClick={() => onAction('Open '+lane[3]+' staged in preview')}>Open worktree</button><button className="studio-button" type="button" onClick={() => onAction('Compare agent lanes staged in preview')}>Compare lanes</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Merge candidate review staged in preview')}>Review merge</button></div>
            </div>
          </Panel>
        </div>
      )}

      {tab === 'design' && (
        <div className="developer-pro-grid">
          <Panel title="Visual design mode">
            <div className="developer-design-toolbar"><label>Browser URL<input value={browserUrl} onChange={(event) => setBrowserUrl(event.target.value)} aria-label="Browser URL" /></label><button className={designModeEnabled ? "studio-button studio-button--active" : "studio-button"} type="button" aria-pressed={designModeEnabled} onClick={() => setDesignModeEnabled((value) => !value)}><Icon name="layout" size={13} /> {designModeEnabled ? "Design mode on" : "Design mode off"}</button><button className="studio-button" type="button" onClick={() => onAction('Navigate browser staged in preview')}><Icon name="globe" size={13} /> Open</button><button className="studio-button" type="button" onClick={() => onAction('Screenshot evidence staged in preview')}><Icon name="archive" size={13} /> Capture</button></div>
            <div className="developer-browser-frame">
              <div className="developer-browser-frame__chrome"><span className="developer-browser-dot" /><span>{browserUrl}</span><Tag label={designModeEnabled ? "Design mode" : "Browse mode"} /></div>
              <div className="developer-browser-frame__canvas"><div className="developer-browser-mock"><span className="eyebrow">Live UI preview</span><h2>Point. Draw. Describe.</h2><p>Visual instructions become scoped engineering tasks without leaving the developer workspace.</p><div className="developer-mock-grid"><span>Hero</span><span>Navigation</span><span>Composer</span><span>Responsive</span></div></div></div>
            </div>
            <div className="developer-design-targets">
              <div><span className="eyebrow">Visual targets</span><small>Select one or more elements. Their layout/code context travels with the visual brief.</small></div>
              <div className="developer-target-list">{designTargets.map((target) => {
                const selectedTarget = designSelection.includes(target)
                return <button key={target} type="button" aria-pressed={selectedTarget} className={selectedTarget ? 'developer-target developer-target--active' : 'developer-target'} onClick={() => setDesignSelection((current) => selectedTarget ? current.filter((item) => item !== target) : [...current, target])}>{target}</button>
              })}</div>
            </div>
            <div className="developer-visual-prompt"><textarea value={visualPrompt} onChange={(event) => setVisualPrompt(event.target.value)} placeholder="Describe a visual change, e.g. 'Move this CTA higher, reduce spacing, preserve responsive behavior…'" aria-label="Visual design instruction" /><button className="studio-button studio-button--active" type="button" disabled={!visualPrompt.trim() || designSelection.length === 0} onClick={() => onAction('Visual change for '+designSelection.join(', ')+' staged in preview')}>Apply visual brief</button></div>
            <div className="developer-voice-queue">
              <div><span className="eyebrow">Voice instructions</span><small>{voiceQueue.length ? voiceQueue.length+' instruction'+(voiceQueue.length === 1 ? '' : 's')+' queued' : 'Queue a spoken design change without leaving the browser context.'}</small></div>
              <button className="studio-button" type="button" onClick={() => { const next = 'Reduce spacing around '+(designSelection[0] ?? 'selected element'); setVoiceQueue((current) => [...current, next].slice(-3)); onAction('Voice design instruction queued in preview') }}><Icon name="mic" size={13} /> Queue voice change</button>
              {voiceQueue.length > 0 && <div className="developer-voice-list">{voiceQueue.map((item, index) => <span key={index}>{item}</span>)}</div>}
            </div>
          </Panel>
          <Panel title="Browser verification">
            <div className="developer-verify-list">
              {['Viewport: 1440 × 900', 'Keyboard: full traversal', 'Console: no new errors', 'Network: approved origins', 'Screenshot: captured', 'Contrast: pending audit'].map((item, index) => <div key={item}><Icon name={index < 5 ? 'check' : 'clock'} size={12} /><span>{item}</span><Tag label={index < 5 ? 'verified' : 'pending'} /></div>)}
            </div>
            <div className="platform-actions"><button className="studio-button" type="button" onClick={() => onAction('Run browser QA staged in preview')}>Run QA</button><button className="studio-button" type="button" onClick={() => onAction('Open console staged in preview')}>Console</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Generate evidence packet staged in preview')}>Evidence packet</button></div>
          </Panel>
        </div>
      )}

      {tab === 'review' && (
        <div className="developer-pro-grid">
          <Panel title="Review findings">
            <div className="developer-review-list">
              {reviewFindings.map(([id, severity, title, file]) => <button key={id} type="button" className="developer-review-row" onClick={() => onAction('Open '+file+' review finding staged in preview')}><span className={'developer-severity developer-severity--'+severity.toLowerCase()}>{severity[0]}</span><span><strong>{title}</strong><small>{id} · {file}</small></span><Icon name="chevron-right" size={13} /></button>)}
            </div>
          </Panel>
          <Panel title="Review contract">
            <div className="developer-review-contract">{['Full project context gathered','Security checklist applied','Changed-file tests planned','Regression tests attached','MCP/skill context allowed','Human approval for risky changes'].map((item, index) => <div key={item}><Icon name={index < 5 ? 'check' : 'lock'} size={12} /><span>{item}</span><Tag label={index < 5 ? 'ready' : 'required'} /></div>)}</div>
            <div className="platform-actions"><button className="studio-button" type="button" onClick={() => onAction('Run code review staged in preview')}>Review diff</button><button className="studio-button" type="button" onClick={() => onAction('Security review staged in preview')}>Security</button><button className="studio-button" type="button" onClick={() => onAction('Regression fix batch staged in preview')}>Prepare fixes</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Create review checkpoint staged in preview')}>Checkpoint</button></div>
          </Panel>
        </div>
      )}

      {tab === 'context' && (
        <div className="developer-pro-grid">
          <Panel title="Context assembly">
            <div className="developer-context-list">
              {contextSources.map(([name, tokens, state]) => <div key={name}><span><strong>{name}</strong><small>{state}</small></span><b>{tokens}</b><button type="button" className={state === 'included' ? 'developer-context-toggle developer-context-toggle--active' : 'developer-context-toggle'} onClick={() => onAction((state === 'included' ? 'Exclude ' : 'Include ')+name+' staged in preview')}>{state === 'included' ? 'Included' : 'Optional'}</button></div>)}
            </div>
          </Panel>
          <Panel title="Context budget & compaction">
            <div className="developer-budget"><div><span>Current usage</span><strong>68%</strong></div><div className="developer-budget-bar"><i style={{ width: '68%' }} /></div><small>5.1k tokens remain before automatic compaction threshold.</small></div>
            <div className="developer-detail-grid"><div><span>Compaction</span><strong>Structure-aware</strong></div><div><span>Deduplication</span><strong>Enabled</strong></div><div><span>Provenance</span><strong>Attached</strong></div><div><span>Recovery</span><strong>Prior snapshot</strong></div></div>
            <div className="platform-actions"><button className="studio-button" type="button" onClick={() => onAction('Preview context compaction staged in preview')}>Preview compaction</button><button className="studio-button" type="button" onClick={() => onAction('Optimize context staged in preview')}>Optimize</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Context snapshot staged in preview')}>Snapshot</button></div>
          </Panel>
        </div>
      )}

      {tab === 'automation' && (
        <div className="developer-pro-grid">
          <Panel title="Long-running automations">
            <div className="developer-automation-list">{automations.map(([name, schedule, state, scope]) => <div key={name}><span><strong>{name}</strong><small>{schedule} · {scope}</small></span><Tag label={state} /><button className="studio-button" type="button" onClick={() => onAction('Open automation '+name+' staged in preview')}>Open</button></div>)}</div>
            <div className="platform-actions"><button className="studio-button" type="button" onClick={() => onAction('Create automation staged in preview')}><Icon name="plus" size={12} /> New automation</button><button className="studio-button" type="button" onClick={() => onAction('Automation run history staged in preview')}>History</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Run automation now staged in preview')}>Run now</button></div>
          </Panel>
          <Panel title="Agent continuity">
            <div className="developer-detail-grid"><div><span>Follow-ups</span><strong>Enabled</strong></div><div><span>Cloud triggers</span><strong>Ready</strong></div><div><span>Notifications</span><strong>Scoped</strong></div><div><span>Persistence</span><strong>Runtime-owned</strong></div></div>
            <div className="developer-continuity-card"><Icon name="history" size={16} /><div><strong>Resume from any device</strong><span>Threads, artifacts and task state can be handed off without duplicating work.</span></div></div>
          </Panel>
        </div>
      )}

      {tab === 'skills' && (
        <div className="developer-pro-grid">
          <Panel title="Agent skills">
            <div className="developer-skill-list">{skills.map(([name, detail, state]) => <button key={name} type="button" className={selectedSkill === name ? 'developer-skill developer-skill--active' : 'developer-skill'} onClick={() => setSelectedSkill(name)}><span><strong>{name}</strong><small>{detail}</small></span><Tag label={state} /></button>)}</div>
          </Panel>
          <Panel title={selectedSkill}>
            <div className="developer-skill-detail"><span className="eyebrow">Reusable procedure</span><h2>{selectedSkill}</h2><p>Versioned instruction package with tools, MCP requirements, output contract, safety boundaries and verification steps.</p><div className="developer-detail-grid"><div><span>Version</span><strong>v1.4</strong></div><div><span>Tools</span><strong>6 allowed</strong></div><div><span>MCP</span><strong>2 scoped</strong></div><div><span>Checks</span><strong>4 required</strong></div></div><div className="platform-actions"><button className="studio-button" type="button" onClick={() => onAction('Skill '+selectedSkill+' details staged in preview')}>Inspect</button><button className="studio-button" type="button" onClick={() => onAction('Skill '+selectedSkill+' test staged in preview')}>Test</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Invoke skill '+selectedSkill+' staged in preview')}>Invoke</button></div></div>
          </Panel>
        </div>
      )}

      {tab === 'environments' && (
        <div className="developer-pro-grid">
          <Panel title="Environment targets">
            <div className="developer-environment-list">{environments.map(([name, detail, state, note]) => <button key={name} type="button" className={selectedEnvironment === name ? 'developer-environment developer-environment--active' : 'developer-environment'} onClick={() => setSelectedEnvironment(name)}><span className="developer-environment__icon"><Icon name={name === 'Local Desktop' ? 'home' : name === 'Feature Worktree' ? 'branch' : name === 'Cloud Agent' ? 'cloud' : 'network'} size={14} /></span><span><strong>{name}</strong><small>{detail}</small></span><span><Tag label={state} /><small>{note}</small></span></button>)}</div>
          </Panel>
          <Panel title={environment[0]}>
            <div className="developer-environment-detail"><span className="eyebrow">Selected target</span><h2>{environment[0]}</h2><p>{environment[1]}</p><div className="developer-detail-grid"><div><span>Status</span><strong>{environment[2]}</strong></div><div><span>Policy</span><strong>{environment[3]}</strong></div><div><span>Network</span><strong>{environment[0] === 'Remote SSH' ? 'Approval' : 'Scoped'}</strong></div><div><span>Persistence</span><strong>{environment[0] === 'Cloud Agent' ? 'Ephemeral' : 'Workspace'}</strong></div></div><div className="platform-actions"><button className="studio-button" type="button" onClick={() => onAction('Open '+environment[0]+' staged in preview')}>Open</button><button className="studio-button" type="button" onClick={() => onAction('Environment setup staged in preview')}>Setup</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Environment verification staged in preview')}>Verify</button></div></div>
          </Panel>
        </div>
      )}

      {tab === 'activity' && (
        <div className="developer-pro-grid">
          <Panel title="Unified activity">
            <div className="developer-activity-list">{activity.map(([time, actor, detail, state]) => <div key={time + actor}><span className="developer-activity-time">{time}</span><span className="developer-activity-dot"><Icon name={state === 'verified' ? 'check' : state === 'finding' ? 'alert' : state === 'running' ? 'activity' : 'spark'} size={11} /></span><span><strong>{actor}</strong><small>{detail}</small></span><Tag label={state} /></div>)}</div>
          </Panel>
          <Panel title="Operational handoff">
            <div className="developer-detail-grid"><div><span>Mission</span><strong>Frontend hardening</strong></div><div><span>Current owner</span><strong>Builder</strong></div><div><span>Next gate</span><strong>Frontend CI</strong></div><div><span>Rollback</span><strong>Checkpoint ready</strong></div></div>
            <div className="developer-handoff-card"><Icon name="archive" size={16} /><div><strong>Evidence packet</strong><span>Code diff, review findings, context snapshot and verification state travel with the handoff.</span></div><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Handoff evidence packet staged in preview')}>Handoff</button></div>
          </Panel>
        </div>
      )}

      <div className="developer-status developer-status--pro">
        <span><i /> Branch: main</span>
        <span>Sandbox: {sandbox}</span>
        <span>Autonomy: {autonomy}</span>
        <span>Approval gate: {approvalGate ? 'enabled' : 'disabled'}</span>
        <span>Edit policy: {safeEditsOnly ? 'safe-only' : 'broad'}</span>
        <span>Runtime execution: service boundary</span>
        <span>UI mode: presentation-ready</span>
      </div>
    </div>
  )
}
