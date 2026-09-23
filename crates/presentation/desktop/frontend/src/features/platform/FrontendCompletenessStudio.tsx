import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { Panel, Metric, Tag, Shell } from './PlatformPrimitives'\nimport './FrontendCompletenessStudio.css'\n
export type CompletenessMode =
  | 'evaluations'
  | 'skills'
  | 'mcp'
  | 'providers'
  | 'browser'
  | 'computer'
  | 'credentials'
  | 'plugins'
  | 'imports'
  | 'sessions'
  | 'onboarding'
  | 'qa'

type Props = { mode: CompletenessMode; onAction: (message: string) => void }

const suites = [
  ['agent-core', 'Agent Core Regression', '248 cases', '97.4%', 'Stable'],
  ['tools-safe', 'Tool Safety Matrix', '164 cases', '99.1%', 'Stable'],
  ['routing', 'Provider Routing', '92 cases', '94.8%', 'Review'],
  ['prompts', 'Prompt Compatibility', '310 cases', '96.2%', 'Stable'],
]
const skills = [
  ['code-review', 'Code Review', '2.4.1', 'Trusted', '14 tools'],
  ['research', 'Deep Research', '1.8.0', 'Verified', '9 tools'],
  ['repo-map', 'Repository Mapping', '0.9.4', 'Local', '7 tools'],
  ['release', 'Release Guard', '1.2.2', 'Verified', '11 tools'],
]
const providers = [
  ['Auto Route', 'Policy router', 'Healthy', 'Primary', '128k'],
  ['Fast Lane', 'Low latency', 'Healthy', 'Secondary', '32k'],
  ['Deep Reasoning', 'Quality route', 'Degraded', 'Fallback', '200k'],
  ['Local Runtime', 'On-device', 'Offline', 'Optional', '32k'],
]
const mcpServers = [
  ['workspace', 'Workspace MCP', 'Connected', '12 tools', 'OAuth'],
  ['github', 'GitHub MCP', 'Connected', '18 tools', 'OAuth'],
  ['browser', 'Browser MCP', 'Needs auth', '8 tools', 'Token'],
  ['research', 'Research MCP', 'Disabled', '21 tools', 'API key'],
]
const recordings = [
  ['REC-041', 'Checkout smoke test', '14 steps', 'Passed'],
  ['REC-040', 'GitHub issue creation', '9 steps', 'Passed'],
  ['REC-039', 'Browser form recovery', '22 steps', 'Needs review'],
]
const migrations = [
  ['Cursor profile', 'Agent instructions + rules', 'Ready'],
  ['Hermes config', 'Skills + providers metadata', 'Review'],
  ['Codex workspace', 'Commands + project context', 'Ready'],
  ['Generic OpenAI config', 'Models + endpoint metadata', 'Ready'],
]

function Header({ eyebrow, title, detail, onAction }: { eyebrow: string; title: string; detail: string; onAction: Props['onAction'] }) {
  return (
    <header className="platform-header">
      <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{detail}</p></div>
      <div className="platform-header__actions"><span className="state-pill state-pill--pending">Frontend preview</span><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Action staged in preview')}><Icon name="spark" size={14} /> Configure</button></div>
    </header>
  )
}

function StatStrip({ items }: { items: [string, string][] }) {
  return <div className="platform-grid platform-grid--4">{items.map(([label, value]) => <Metric key={label} label={label} value={value} />)}</div>
}

export function FrontendCompletenessStudio({ mode, onAction }: Props) {
  const [selected, setSelected] = useState('agent-core')
  const [filter, setFilter] = useState('')
  const [enabled, setEnabled] = useState(() => new Set(['workspace', 'github']))
  const [onboardingStep, setOnboardingStep] = useState(2)

  const filteredSkills = useMemo(() => skills.filter((item) => item.join(' ').toLowerCase().includes(filter.toLowerCase())), [filter])

  if (mode === 'evaluations') return <Shell><Header eyebrow="Quality engineering" title="Evaluation Studio" detail="Datasets, suites, regression gates, A/B comparisons, scoring, failure analysis and release evidence." onAction={onAction} />
    <StatStrip items={[['Suites', '18'], ['Cases', '1,240'], ['Pass rate', '96.8%'], ['Last run', '8m ago']]} />
    <div className="fc-grid fc-grid--wide"><Panel title="Regression suites"><div className="fc-list">{suites.map(([id, title, cases, score, state]) => <button type="button" key={id} className={selected === id ? 'fc-row fc-row--active' : 'fc-row'} onClick={() => setSelected(id)}><div><strong>{title}</strong><span>{id} · {cases}</span></div><strong>{score}</strong><Tag>{state}</Tag></button>)}</div></Panel><Panel title={selected}><div className="fc-metric-hero"><strong>96.8%</strong><span>Overall score</span></div><div className="fc-two"><Metric label="Safety" value="99.1%" /><Metric label="Quality" value="96.4%" /><Metric label="Robustness" value="95.7%" /><Metric label="Tool correctness" value="97.9%" /></div><div className="fc-actions"><button className="studio-button" type="button" onClick={() => onAction('A/B comparison opened')}>A/B compare</button><button className="studio-button" type="button" onClick={() => onAction('Failure analysis opened')}>Failure analysis</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Regression run staged') }><Icon name="play" size={13} /> Run regression</button></div></Panel></div>
    <Panel title="Release gate"><div className="fc-checks"><span>✓ No critical safety regressions</span><span>✓ Prompt compatibility maintained</span><span>✓ Tool policy coverage complete</span><span>• 3 cases require human review</span></div></Panel>
    </Shell>

  if (mode === 'skills') return <Shell><Header eyebrow="Capability registry" title="Skills Studio" detail="Install, version, scope, trust, test and update procedural capabilities without coupling the UI to runtime installation." onAction={onAction} />
    <div className="fc-toolbar"><div className="fc-search"><Icon name="search" size={14} /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search skills..." /></div><div className="fc-actions"><button className="studio-button" type="button" onClick={() => onAction('Skill package browser opened')}>Browse registry</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Skill import staged')}><Icon name="upload" size={13} /> Import skill</button></div></div>
    <div className="fc-card-grid">{filteredSkills.map(([id, title, version, trust, tools]) => <button type="button" key={id} className={selected === id ? 'fc-card fc-card--active' : 'fc-card'} onClick={() => setSelected(id)}><div className="fc-card__top"><Icon name="spark" size={17} /><Tag>{trust}</Tag></div><strong>{title}</strong><span>{id} · v{version}</span><small>{tools}</small><div className="fc-progress"><i style={{ width: trust === 'Local' ? '64%' : '94%' }} /></div></button>)}</div>
    <div className="fc-grid fc-grid--wide"><Panel title={selected}><div className="fc-two"><Metric label="Version" value="2.4.1" /><Metric label="Trust" value="Verified" /><Metric label="Dependencies" value="3" /><Metric label="Tools" value="14" /></div><div className="fc-checks"><span>✓ Manifest validated</span><span>✓ Scope declared</span><span>✓ Dependency graph resolved</span><span>✓ Regression suite available</span></div><div className="fc-actions"><button className="studio-button" type="button" onClick={() => onAction('Skill manifest opened')}>Manifest</button><button className="studio-button" type="button" onClick={() => onAction('Skill test staged')}>Test skill</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Skill update staged')}>Update</button></div></Panel><Panel title="Trust policy"><div className="fc-checks"><span>Verified packages may auto-update</span><span>Local packages require explicit approval</span><span>Network access must be declared</span><span>Secrets access is always scoped</span></div></Panel></div>
    </Shell>

  if (mode === 'mcp') return <Shell><Header eyebrow="Tool protocol" title="MCP Control Center" detail="Server lifecycle, OAuth, scopes, tool discovery, health, permissions and connection diagnostics." onAction={onAction} />
    <StatStrip items={[['Servers', '12'], ['Connected', '8'], ['Tools', '74'], ['Health', '98.2%']]} />
    <div className="fc-grid fc-grid--wide"><Panel title="Servers"><div className="fc-list">{mcpServers.map(([id, title, state, tools, auth]) => <button type="button" key={id} className={selected === id ? 'fc-row fc-row--active' : 'fc-row'} onClick={() => setSelected(id)}><div><strong>{title}</strong><span>{id} · {auth}</span></div><span>{tools}</span><Tag>{state}</Tag></button>)}</div></Panel><Panel title={selected}><div className="fc-two"><Metric label="Auth" value="OAuth 2.1" /><Metric label="Scopes" value="4" /><Metric label="Discovered tools" value="18" /><Metric label="Last health check" value="42s" /></div><div className="fc-checks"><span>✓ Server handshake</span><span>✓ Capability discovery</span><span>✓ Scope policy</span><span>• Re-authentication available</span></div><div className="fc-actions"><button className="studio-button" type="button" onClick={() => onAction('OAuth flow opened')}>OAuth</button><button className="studio-button" type="button" onClick={() => onAction('Tool permissions opened')}>Tool permissions</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('MCP health check staged')}><Icon name="refresh" size={13} /> Health check</button></div></Panel></div>
    </Shell>

  if (mode === 'providers') return <Shell><Header eyebrow="Model control plane" title="Provider & Model Center" detail="Catalog models, quotas, pricing metadata, latency, health, capabilities and routing policies." onAction={onAction} />
    <StatStrip items={[['Providers', '18'], ['Models', '146'], ['Healthy routes', '92%'], ['Budget used', '31%']]} />
    <div className="fc-card-grid">{providers.map(([id, detail, health, role, context]) => <button type="button" key={id} className={selected === id ? 'fc-card fc-card--active' : 'fc-card'} onClick={() => setSelected(id)}><div className="fc-card__top"><Icon name="network" size={17} /><Tag>{health}</Tag></div><strong>{id}</strong><span>{detail}</span><small>{role} · {context} context</small><div className="fc-health"><i style={{ width: health === 'Healthy' ? '94%' : health === 'Degraded' ? '62%' : '14%' }} /></div></button>)}</div>
    <div className="fc-grid fc-grid--wide"><Panel title="Routing policy"><div className="fc-checks"><span>1. Prefer healthy compatible models</span><span>2. Respect context and tool capability constraints</span><span>3. Apply budget ceiling before fallback</span><span>4. Retry only within bounded policy</span><span>5. Fail closed when no compliant route exists</span></div></Panel><Panel title="Model detail"><div className="fc-two"><Metric label="Context" value="128k" /><Metric label="Input price" value="Metadata" /><Metric label="Output price" value="Metadata" /><Metric label="Median latency" value="1.2s" /></div><div className="fc-actions"><button className="studio-button" type="button" onClick={() => onAction('Model comparison opened')}>Compare</button><button className="studio-button" type="button" onClick={() => onAction('Quota dashboard opened')}>Quotas</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Routing rule staged')}>Edit routing</button></div></Panel></div>
    </Shell>

  if (mode === 'browser') return <Shell><Header eyebrow="Web automation" title="Browser Automation Studio" detail="Profiles, sessions, navigation plans, extraction, forms, screenshots, approvals and replayable browser tasks." onAction={onAction} />
    <StatStrip items={[['Profiles', '6'], ['Sessions', '3'], ['Recorded flows', '18'], ['Success', '96.4%']]} />
    <div className="fc-grid fc-grid--wide"><Panel title="Automation plan"><div className="fc-flow"><span>Open page</span><b>→</b><span>Inspect DOM</span><b>→</b><span>Fill form</span><b>→</b><span>Verify</span><b>→</b><span>Capture</span></div><div className="fc-checks"><span>✓ Domain allowlist</span><span>✓ Human approval before sensitive submission</span><span>✓ Session isolation</span><span>✓ Artifact capture enabled</span></div></Panel><Panel title="Session"><div className="fc-two"><Metric label="Browser" value="Chromium" /><Metric label="Profile" value="AgentiCOS Safe" /><Metric label="Network" value="Allowlist" /><Metric label="State" value="Ready" /></div><div className="fc-actions"><button className="studio-button" type="button" onClick={() => onAction('Browser recorder opened')}>Record</button><button className="studio-button" type="button" onClick={() => onAction('Browser session staged')}>New session</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Browser plan staged')}><Icon name="play" size={13} /> Preview run</button></div></Panel></div>
    </Shell>

  if (mode === 'computer') return <Shell><Header eyebrow="Computer use" title="Computer Use Recorder" detail="Record, inspect, replay and verify desktop actions with checkpoints and explicit approval boundaries." onAction={onAction} />
    <div className="fc-card-grid">{recordings.map(([id, title, steps, state]) => <button type="button" key={id} className={selected === id ? 'fc-card fc-card--active' : 'fc-card'} onClick={() => setSelected(id)}><div className="fc-card__top"><Icon name="layout" size={17} /><Tag>{state}</Tag></div><strong>{title}</strong><span>{id}</span><small>{steps}</small></button>)}</div>
    <Panel title={selected}><div className="fc-flow"><span>Capture</span><b>→</b><span>Checkpoint</span><b>→</b><span>Replay</span><b>→</b><span>Verify</span><b>→</b><span>Artifact</span></div><div className="fc-actions"><button className="studio-button" type="button" onClick={() => onAction('Recorder started in preview')}><Icon name="play" size={13} /> Record</button><button className="studio-button" type="button" onClick={() => onAction('Replay staged')}>Replay</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Verification report staged')}>Verify</button></div></Panel>
    </Shell>

  if (mode === 'credentials') return <Shell><Header eyebrow="Secrets boundary" title="Credential Vault" detail="Manage credential metadata, scopes, rotation state and approval boundaries without exposing secret values to the frontend." onAction={onAction} />
    <StatStrip items={[['Credentials', '24'], ['Healthy', '21'], ['Expiring', '2'], ['Unusable', '1']]} />
    <div className="fc-card-grid">{['GitHub token','OpenAI-compatible key','Research API key','Browser profile secret','Local signing key','Webhook signing secret'].map((name, i) => <div className="fc-card" key={name}><div className="fc-card__top"><Icon name="lock" size={17} /><Tag>{i === 4 ? 'Local' : 'Vaulted'}</Tag></div><strong>{name}</strong><span>••••••••••••</span><small>{i % 2 ? 'Rotation: 28d' : 'Rotation: 14d'}</small><div className="fc-actions"><button className="studio-button" type="button" onClick={() => onAction(name + ' metadata opened')}>Details</button><button className="studio-button" type="button" onClick={() => onAction(name + ' rotation staged')}>Rotate</button></div></div>)}</div>
    </Shell>

  if (mode === 'plugins') return <Shell><Header eyebrow="Extension lifecycle" title="Plugin & Marketplace Manager" detail="Discover, install, update, trust, sandbox and roll back packaged extensions." onAction={onAction} />
    <div className="fc-card-grid">{['GitHub Engineering','Research Pack','Browser Automation','Local Dev Tools','Voice Pack','MCP Connector Pack'].map((name, i) => <div className="fc-card" key={name}><div className="fc-card__top"><Icon name="tool" size={17} /><Tag>{i < 4 ? 'Verified' : 'Community'}</Tag></div><strong>{name}</strong><span>v{1 + i}.2.{i}</span><small>{i % 2 ? 'Update available' : 'Installed'}</small><div className="fc-actions"><button className="studio-button" type="button" onClick={() => onAction(name + ' details opened')}>Details</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction(name + ' lifecycle action staged')}>{i % 2 ? 'Update' : 'Configure'}</button></div></div>)}</div>
    </Shell>

  if (mode === 'imports') return <Shell><Header eyebrow="Migration center" title="Import & Migration Center" detail="Import agent configurations, skills, rules, commands and session archives with diff, conflict resolution and rollback." onAction={onAction} />
    <div className="fc-card-grid">{migrations.map(([name, content, state]) => <button type="button" key={name} className={selected === name ? 'fc-card fc-card--active' : 'fc-card'} onClick={() => setSelected(name)}><div className="fc-card__top"><Icon name="arrow-down" size={17} /><Tag>{state}</Tag></div><strong>{name}</strong><span>{content}</span><small>Secrets excluded · review required</small></button>)}</div>
    <Panel title={selected}><div className="fc-two"><Metric label="Files" value="42" /><Metric label="Conflicts" value="3" /><Metric label="Secrets" value="0" /><Metric label="Rollback" value="Ready" /></div><div className="fc-actions"><button className="studio-button" type="button" onClick={() => onAction('Migration diff opened')}>Review diff</button><button className="studio-button" type="button" onClick={() => onAction('Conflict resolver opened')}>Resolve conflicts</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Migration approval staged')}><Icon name="check" size={13} /> Approve import</button></div></Panel>
    </Shell>

  if (mode === 'sessions') return <Shell><Header eyebrow="Conversation lifecycle" title="Session Replay & Branching" detail="Search, fork, replay and compare conversation state with context snapshots and run evidence." onAction={onAction} />
    <StatStrip items={[['Sessions', '84'], ['Pinned', '12'], ['Branches', '31'], ['Artifacts', '146']]} />
    <div className="fc-grid fc-grid--wide"><Panel title="Replay timeline"><div className="fc-timeline">{['Prompt received','Context assembled','Model response','Tool call','Policy check','Artifact created','User follow-up'].map((item, i) => <div key={item}><i>{i + 1}</i><span><strong>{item}</strong><small>{i * 8 + 2}s · checkpoint {i + 1}</small></span></div>)}</div></Panel><Panel title="Branch controls"><div className="fc-checks"><span>✓ Snapshot before replay</span><span>✓ Fork from arbitrary checkpoint</span><span>✓ Compare context deltas</span><span>✓ Preserve original session</span></div><div className="fc-actions"><button className="studio-button" type="button" onClick={() => onAction('Session fork staged')}><Icon name="branch" size={13} /> Fork</button><button className="studio-button" type="button" onClick={() => onAction('Replay staged')}><Icon name="play" size={13} /> Replay</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Context diff opened')}>Compare</button></div></Panel></div>
    </Shell>

  if (mode === 'onboarding') return <Shell><Header eyebrow="First-run experience" title="Workspace Setup" detail="A guided, resumable setup flow for workspace, provider, safety, tools, skills and verification." onAction={onAction} />
    <div className="fc-onboarding"><div className="fc-steps">{['Workspace','Provider','Safety','Capabilities','Verification'].map((step, i) => <button type="button" key={step} className={onboardingStep === i ? 'fc-step fc-step--active' : i < onboardingStep ? 'fc-step fc-step--done' : 'fc-step'} onClick={() => setOnboardingStep(i)}><span>{i + 1}</span>{step}</button>)}</div><Panel title={['Workspace','Provider','Safety','Capabilities','Verification'][onboardingStep]}><div className="fc-checks"><span>{onboardingStep > 0 ? '✓' : '•'} Workspace path and project profile</span><span>{onboardingStep > 1 ? '✓' : '•'} Model provider and routing policy</span><span>{onboardingStep > 2 ? '✓' : '•'} Approval and sandbox policy</span><span>{onboardingStep > 3 ? '✓' : '•'} Skills, tools and MCP capabilities</span><span>{onboardingStep > 4 ? '✓' : '•'} Frontend verification and release readiness</span></div><div className="fc-actions"><button className="studio-button" type="button" onClick={() => setOnboardingStep((v) => Math.max(0, v - 1))}>Back</button><button className="studio-button studio-button--active" type="button" onClick={() => setOnboardingStep((v) => Math.min(4, v + 1))}>Continue</button></div></Panel></div>
    </Shell>

  return <Shell><Header eyebrow="Frontend quality" title="QA & Readiness Center" detail="Cross-feature visual QA, accessibility, responsive behavior, error states and release readiness checks." onAction={onAction} />
    <StatStrip items={[['Screens', '58'], ['Keyboard paths', '42'], ['A11y checks', '38'], ['Release gates', '12']]} />
    <div className="fc-grid fc-grid--wide"><Panel title="Readiness checklist"><div className="fc-checks"><span>✓ Loading / empty / error / recovery states defined</span><span>✓ Keyboard navigation and focus visibility</span><span>✓ Responsive desktop breakpoints</span><span>✓ Offline and reconnect state model</span><span>✓ Destructive-action confirmation surfaces</span><span>• Browser/Tauri runtime verification pending</span></div></Panel><Panel title="Release controls"><div className="fc-two"><Metric label="Visual coverage" value="94%" /><Metric label="A11y coverage" value="91%" /><Metric label="State coverage" value="88%" /><Metric label="Runtime verification" value="Pending" /></div><div className="fc-actions"><button className="studio-button" type="button" onClick={() => onAction('Accessibility audit staged')}>Accessibility audit</button><button className="studio-button" type="button" onClick={() => onAction('Visual regression staged')}>Visual regression</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Release checklist exported')}><Icon name="download" size={13} /> Export checklist</button></div></Panel></div>
    <Panel title="Global state contract"><div className="fc-state-grid">{['loading','empty','error','offline','permission-denied','approval-required','stale','reconnecting'].map((state) => <div key={state}><Icon name={state === 'error' ? 'alert' : 'check-circle'} size={14} /><strong>{state}</strong><span>Explicit visual state</span></div>)}</div></Panel>
  </Shell>
}
