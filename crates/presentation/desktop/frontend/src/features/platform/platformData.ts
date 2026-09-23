// Presentation preview catalog. Keep this file free of React state and runtime calls.
type Item = { id: string; title: string; detail: string; meta?: string; state?: string }

export const projects: Item[] = [
  { id: 'agenticos', title: 'AgentiCOS', detail: 'Rust runtime + Tauri desktop + React frontend', meta: 'main · clean preview', state: 'Active' },
  { id: 'ccos', title: 'CCOS', detail: 'C++ / Qt video editor workspace', meta: 'feature/editor', state: 'Linked' },
  { id: 'kinetix', title: 'KinetixFitt', detail: 'Fitness product workspace', meta: 'mobile + web', state: 'Linked' },
]

export const indexEntries = [
  ['App.tsx', 'component', 'High relevance', '12 matches'],
  ['navigation.ts', 'architecture', 'High relevance', '9 matches'],
  ['StudioSurface.tsx', 'component', 'Medium relevance', '24 matches'],
  ['SettingsSurface.tsx', 'component', 'Medium relevance', '17 matches'],
  ['provider_plane_integration.rs', 'test', 'Medium relevance', '8 matches'],
  ['FRONTEND-ARCHITECTURE.md', 'docs', 'High relevance', '6 matches'],
]

export const contextSources: ReadonlyArray<[string, string, string, boolean]> = [
  ['Workspace files', 'Source tree + project manifests', '42.8k', true],
  ['Open files', 'Currently active editor tabs', '8.4k', true],
  ['Git diff', 'Uncommitted or selected changes', '5.1k', true],
  ['Project rules', 'AGENTS.md + .cursor/rules + local instructions', '3.2k', true],
  ['Pinned memory', 'Curated persistent knowledge', '2.7k', true],
  ['Session history', 'Relevant previous conversations', '6.9k', false],
  ['Web sources', 'URLs and search extracts', '11.4k', false],
]

export const ruleSources = [
  ['AGENTS.md', 'Project-wide agent instructions', 'Always'],
  ['.cursor/rules', 'Path-scoped project rules', 'Relevant'],
  ['.hermes.md', 'Hermes-compatible project context', 'Relevant'],
  ['SOUL.md', 'Agent identity and personality', 'Session'],
  ['USER.md', 'Persistent user profile', 'Session'],
  ['Workspace policy', 'Local safety and verification policy', 'Always'],
]

export const backgroundJobs: ReadonlyArray<[string, string, string, string, string, string]> = [
  ['CLOUD-042', 'Implement provider failover UI', 'Builder', 'working', '12m', 'worktree/cloud-042'],
  ['CLOUD-039', 'Review frontend regression risk', 'Reviewer', 'waiting', '7m', 'worktree/cloud-039'],
  ['CLOUD-031', 'Research free-tier provider options', 'Researcher', 'complete', '23m', 'worktree/cloud-031'],
]

export const reviewItems = [
  ['BUG-118', 'Possible unguarded state mutation', 'High', 'StudioSurface.tsx:184'],
  ['BUG-117', 'Missing keyboard focus restoration', 'Medium', 'CommandPalette.tsx:92'],
  ['BUG-116', 'Unverified preview copy could be clearer', 'Low', 'Observability'],
  ['BUG-112', 'Provider health should be runtime-owned', 'Medium', 'ProviderDashboard.tsx'],
]

export const checkpoints = [
  ['CP-028', 'Before provider routing changes', '2m ago', '19bc9d3'],
  ['CP-027', 'Before settings expansion', '31m ago', 'a930b58'],
  ['CP-026', 'Before chat controls', '58m ago', 'df130b4'],
  ['CP-025', 'Command Center baseline', '2h ago', '988cc8b'],
]

export const bots = [
  ['Builder', 'Implementation', '18 tools', 'Qwen3 Coder', 'Online'],
  ['Reviewer', 'Quality', '11 tools', 'GPT-OSS 120B', 'Online'],
  ['Researcher', 'Evidence', '9 tools', 'DeepSeek', 'Idle'],
  ['Release Bot', 'CI / release', '13 tools', 'Auto route', 'Scheduled'],
]

export const automations = [
  ['Frontend regression scan', 'Every 6 hours', 'Git change trigger', 'Enabled'],
  ['Nightly repository audit', '02:30', 'Cron', 'Enabled'],
  ['Weekly dependency report', 'Mon 09:00', 'Cron', 'Paused'],
  ['Release evidence pack', 'On release tag', 'Webhook', 'Ready'],
]

export const channels = [
  ['Desktop', 'Native app', 'Connected', 'Local session'],
  ['Telegram', 'Gateway', 'Preview', 'Delivery not connected'],
  ['Discord', 'Gateway', 'Preview', 'Delivery not connected'],
  ['Slack', 'Gateway', 'Preview', 'Delivery not connected'],
  ['WhatsApp', 'Gateway', 'Preview', 'Delivery not connected'],
  ['Email', 'Gateway', 'Preview', 'SMTP not connected'],
]

export const researchBatches = [
  ['BATCH-014', 'Compare agent runtimes', '24 inputs', 'Queued'],
  ['BATCH-013', 'Provider free-tier audit', '18 inputs', 'Complete'],
  ['BATCH-012', 'Frontend UX benchmark', '12 inputs', 'Complete'],
]

export const batchJobs: ReadonlyArray<[string, string, string, string]> = [
  ['BATCH-014', 'Frontend screenshot audit', '48 inputs · concurrency 6', 'Running'],
  ['BATCH-013', 'Provider metadata normalization', '18 inputs · concurrency 4', 'Complete'],
  ['BATCH-012', 'Documentation link validation', '62 inputs · concurrency 8', 'Queued'],
]

export const learningSignals: ReadonlyArray<[string, string, string, string]> = [
  ['Skill candidate', 'frontend-regression-review', '4 supporting runs', 'Draft'],
  ['Memory candidate', 'Preferred fail-closed workflow', '3 supporting sessions', 'Ready'],
  ['Prompt improvement', 'Architecture planning checklist', '12% fewer retries', 'Suggested'],
]

export const plugins: ReadonlyArray<[string, string, string, string, boolean]> = [
  ['GitHub Toolkit', 'Source control and PR workflows', '18 tools', 'Repository', true],
  ['Browser Operator', 'Browser automation and visual verification', '7 tools', 'Automation', true],
  ['Research Pack', 'Web sources and evidence workflows', '9 tools', 'Research', false],
  ['Media Pack', 'Vision, TTS and image/video surfaces', '6 tools', 'Media', false],
]

export const hooks: ReadonlyArray<[string, string, string, boolean]> = [
  ['before-run', 'Validate policy, context and approvals', 'Execution', true],
  ['before-tool', 'Check risk and tool allowlist', 'Security', true],
  ['after-tool', 'Record outcome and artifact references', 'Telemetry', true],
  ['on-error', 'Capture evidence and propose recovery', 'Recovery', true],
  ['after-run', 'Compile summary and handoff package', 'Lifecycle', false],
]

export const environments: ReadonlyArray<[string, string, string, string]> = [
  ['Local Desktop', 'Tauri workstation', 'Node 22 · Rust stable', 'Ready'],
  ['Linux Builder', 'Containerized build environment', 'Ubuntu · cached toolchain', 'Preview'],
  ['Agent VM', 'Isolated long-running environment', 'Dockerfile / snapshot', 'Preview'],
]

export const integrations: ReadonlyArray<[string, string, string, string]> = [
  ['GitHub', 'Repository + PR', 'Connected', 'Read / write via runtime'],
  ['GitLab', 'Repository', 'Available', 'OAuth preview'],
  ['Azure DevOps', 'Repository + work items', 'Available', 'OAuth preview'],
  ['Linear', 'Issues + projects', 'Preview', 'API not connected'],
]

export const mcpServers = [
  ['filesystem', 'Local files', '12 tools', 'Connected'],
  ['browser', 'Browser automation', '7 tools', 'Preview'],
  ['github', 'GitHub operations', '18 tools', 'Connected'],
  ['search', 'Web search', '5 tools', 'Preview'],
  ['database', 'External data source', '8 tools', 'Disabled'],
]


export const sessions: ReadonlyArray<[string, string, string, string, boolean]> = [
  ['session-042', 'Frontend platform build', 'Today · 42 messages', 'Active', true],
  ['session-041', 'Provider routing review', 'Yesterday · 18 messages', 'Archived', false],
  ['session-040', 'Architecture planning', 'Sep 21 · 27 messages', 'Pinned', true],
  ['session-039', 'Video editor research', 'Sep 20 · 9 messages', 'Archived', false],
]

export const logEntries: ReadonlyArray<[string, string, string, string]> = [
  ['16:31:02', 'agent.run', 'tool.call', 'filesystem.read_file · 42ms'],
  ['16:31:03', 'agent.run', 'provider.route', 'primary route selected · preview'],
  ['16:31:04', 'agent.run', 'tool.call', 'terminal.cargo_check · running'],
  ['16:31:06', 'agent.run', 'policy.check', 'fail-closed · passed'],
  ['16:31:09', 'agent.run', 'handoff', 'artifact package prepared'],
]

export const analyticsCards: ReadonlyArray<[string, string, string]> = [
  ['Runs', '128', '+18% vs previous period'],
  ['Tokens', '2.84M', 'context + output preview'],
  ['Tool success', '98.7%', '312 calls'],
  ['Avg latency', '428ms', 'P95 1.2s'],
]

export const webhooks: ReadonlyArray<[string, string, string, string, boolean]> = [
  ['github-review', 'GitHub review event', 'POST /events/review', 'Enabled', true],
  ['release-hook', 'Release tag trigger', 'POST /events/release', 'Enabled', true],
  ['alert-hook', 'Monitoring alert', 'POST /events/alert', 'Paused', false],
]

export const credentials: ReadonlyArray<[string, string, string, string]> = [
  ['OpenAI', 'Model provider', 'Configured', 'Secret stored externally'],
  ['GitHub', 'Source integration', 'Configured', 'OAuth token external'],
  ['Browserbase', 'Browser backend', 'Not configured', 'No secret exposed'],
  ['Telegram', 'Gateway', 'Not configured', 'Pairing required'],
]

export const toolsets: ReadonlyArray<[string, string, string, boolean]> = [
  ['core-safe', 'Files + Git + read-only inspection', '12 tools', true],
  ['web-research', 'Search + extract + browser', '9 tools', false],
  ['agent-orchestration', 'Todo + delegation + code execution', '7 tools', true],
  ['media', 'Vision + image generation + TTS', '6 tools', false],
  ['messaging', 'Gateway + delivery channels', '8 tools', false],
]

export const imports: ReadonlyArray<[string, string, string, string]> = [
  ['Cursor rules', '.cursor/rules', 'Rules', 'Ready'],
  ['Claude config', 'CLAUDE.md + settings', 'Instructions', 'Ready'],
  ['Hermes context', '.hermes.md + SOUL.md + USER.md', 'Context', 'Ready'],
  ['Session archive', 'JSON / transcript bundle', 'Sessions', 'Preview'],
]

export const mediaItems: ReadonlyArray<[string, string, string, string]> = [
  ['Vision analysis', 'Analyze pasted or attached images', 'Multimodal', 'Ready'],
  ['Image generation', 'Prompt → image artifact workflow', 'Generation', 'Preview'],
  ['Text to speech', 'Convert assistant responses to audio', 'Voice', 'Preview'],
  ['Video storyboard', 'Compose multimodal production plan', 'Creative', 'Preview'],
]


export const evaluationSuites: ReadonlyArray<[string, string, string, string, string]> = [
  ['eval-code-01', 'Code correctness', '48 cases', '93.8%', 'Stable'],
  ['eval-agent-02', 'Tool-use discipline', '32 cases', '96.4%', 'Stable'],
  ['eval-research-03', 'Research grounding', '24 cases', '89.1%', 'Review'],
  ['eval-ui-04', 'Frontend interaction', '18 cases', '91.7%', 'Stable'],
]

export const evaluationRuns: ReadonlyArray<[string, string, string, string]> = [
  ['RUN-EVAL-081', 'Qwen3 Coder', '48 / 48', '6m 12s'],
  ['RUN-EVAL-080', 'GPT-OSS 120B', '46 / 48', '7m 04s'],
  ['RUN-EVAL-079', 'DeepSeek', '43 / 48', '5m 48s'],
]

export export const notifications: ReadonlyArray<[string, string, string, string, boolean]> = [
  ['Approval requested', 'Background agent wants permission to modify provider routing.', '2m', 'high', false],
  ['Run completed', 'Frontend regression scan finished with 0 critical findings.', '11m', 'info', false],
  ['Checkpoint captured', 'CP-028 is ready for restore preview.', '31m', 'info', true],
  ['Integration warning', 'Telegram delivery is not connected.', '1h', 'medium', true],
  ['Skill update', 'A new version is available for Browser Operator.', '3h', 'info', true],
] as const

export const securityPolicies: ReadonlyArray<[string, string, boolean]> = [
  ['Fail-closed execution', 'Sensitive actions stop until explicitly approved', true],
  ['Workspace sandbox', 'Commands are scoped to the selected workspace', true],
  ['Network approval', 'Outbound network access requires policy permission', true],
  ['Secret redaction', 'Hide API keys and credential-like values from UI', true],
  ['Destructive confirmation', 'Delete, reset and force actions require confirmation', true],
  ['Telemetry minimization', 'Do not persist local preview telemetry', true],
]



export const tasks: ReadonlyArray<[string, string, string, string, string]> = [
  ['TASK-104', 'Complete frontend architecture', 'Builder', 'In progress', 'P1'],
  ['TASK-103', 'Review provider fallback UX', 'Reviewer', 'Ready', 'P1'],
  ['TASK-102', 'Build browser verification plan', 'Researcher', 'Blocked', 'P2'],
  ['TASK-101', 'Prepare release evidence', 'Release Bot', 'Queued', 'P2'],
]
