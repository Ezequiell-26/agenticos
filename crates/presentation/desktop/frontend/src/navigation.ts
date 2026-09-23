export type RailMode =
  | 'overview'
  | 'chat'
  | 'files'
  | 'terminal'
  | 'runs'
  | 'tasks'
  | 'approvals'
  | 'permissions'
  | 'observability'
  | 'agents'
  | 'agent-control'
  | 'prompts'
  | 'workflows'
  | 'artifacts'
  | 'providers'
  | 'skills'
  | 'tools'
  | 'memory'
  | 'marketplace'
  | 'settings'
  | 'projects'
  | 'codebase'
  | 'context'
  | 'rules'
  | 'canvas'
  | 'commands'
  | 'background'
  | 'subagents'
  | 'cloud'
  | 'computer'
  | 'operations'
  | 'kanban'
  | 'reviews'
  | 'checkpoints'
  | 'bots'
  | 'automations'
  | 'channels'
  | 'browser'
  | 'voice'
  | 'research'
  | 'mcp'
  | 'security'
  | 'sessions'
  | 'logs'
  | 'analytics'
  | 'webhooks'
  | 'credentials'
  | 'imports'
  | 'toolsets'
  | 'media'
  | 'evaluations'
  | 'notifications'
  | 'wake'
  | 'plugins'
  | 'hooks'
  | 'batch'
  | 'learning'
  | 'execution'
  | 'environments'
  | 'integrations'
  | 'homeassistant'
  | 'social'
  | 'playground'
  | 'routing'
  | 'token-observatory'
  | 'versions'
  | 'audit'

export type NavigationGroup = 'build' | 'operate' | 'configure' | 'integrate'

export interface NavigationItem {
  id: RailMode
  label: string
  detail: string
  icon:
    | 'activity' | 'alert' | 'archive' | 'arrow-down' | 'arrow-up' | 'bell' | 'bot'
    | 'branch' | 'calendar' | 'check' | 'check-circle' | 'chevron-left' | 'chevron-right'
    | 'clock' | 'cloud' | 'code' | 'command' | 'copy' | 'database' | 'download'
    | 'external' | 'file' | 'file-code' | 'filter' | 'folder' | 'git' | 'globe' | 'history'
    | 'home' | 'info' | 'layers' | 'layout' | 'lock' | 'maximize' | 'message' | 'mic'
    | 'minimize' | 'more' | 'network' | 'paperclip' | 'panel-left' | 'panel-right'
    | 'play' | 'plus' | 'refresh' | 'search' | 'send' | 'settings' | 'shield' | 'sliders'
    | 'spark' | 'stop' | 'terminal' | 'tool' | 'upload' | 'users' | 'x'
  group: NavigationGroup
}

export const navigationItems: NavigationItem[] = [
  { id: 'overview', label: 'Workspace Overview', detail: 'Project health, active work, approvals and recent agent activity', icon: 'home', group: 'build' },
  { id: 'chat', label: 'Command Center', detail: 'Agent chat, context, commands and session control', icon: 'home', group: 'build' },
  { id: 'files', label: 'Files & Editor', detail: 'Explorer, editor, tabs, diff and inspector', icon: 'file-code', group: 'build' },
  { id: 'terminal', label: 'Terminal', detail: 'Shell sessions and command execution', icon: 'terminal', group: 'build' },
  { id: 'prompts', label: 'Prompt Lab', detail: 'Reusable prompts, variables and templates', icon: 'spark', group: 'build' },
  { id: 'projects', label: 'Projects', detail: 'Workspace projects, tasks and active branches', icon: 'layers', group: 'build' },
  { id: 'codebase', label: 'Codebase Index', detail: 'Semantic search, indexing and repository map', icon: 'search', group: 'build' },
  { id: 'context', label: 'Context', detail: 'Context packs, token budget and source selection', icon: 'archive', group: 'build' },
  { id: 'rules', label: 'Rules & Instructions', detail: 'Project rules, AGENTS.md and agent identity', icon: 'shield', group: 'build' },
  { id: 'canvas', label: 'Canvas', detail: 'Interactive visual artifacts and side-by-side agent workspaces', icon: 'layout', group: 'build' },
  { id: 'commands', label: 'Commands', detail: 'Reusable slash workflows and focused agent actions', icon: 'command', group: 'build' },

  { id: 'runs', label: 'Runs', detail: 'Execution lifecycle, verification and recovery', icon: 'activity', group: 'operate' },
  { id: 'tasks', label: 'Tasks', detail: 'Objectives, dependencies, status and agent handoffs', icon: 'check', group: 'operate' },
  { id: 'background', label: 'Background Agents', detail: 'Long-running isolated agent tasks and worktrees', icon: 'cloud', group: 'operate' },
  { id: 'subagents', label: 'Subagents', detail: 'Specialists with isolated context, models and toolsets', icon: 'bot', group: 'operate' },
  { id: 'cloud', label: 'Cloud Agents', detail: 'Remote agents, environments, artifacts and follow-ups', icon: 'cloud', group: 'operate' },
  { id: 'computer', label: 'Computer Use', detail: 'Desktop control, browser sessions and recorded verification', icon: 'layout', group: 'operate' },
  { id: 'operations', label: 'Operations Center', detail: 'Health, doctor, backups, support and maintenance actions', icon: 'settings', group: 'operate' },
  { id: 'kanban', label: 'Kanban', detail: 'Task boards, agent ownership and workflow handoffs', icon: 'layers', group: 'operate' },
  { id: 'reviews', label: 'Reviews & Bugbot', detail: 'Diff review, findings and automated checks', icon: 'check', group: 'operate' },
  { id: 'checkpoints', label: 'Checkpoints', detail: 'Snapshots, diffs, rollback and restore previews', icon: 'git', group: 'operate' },
  { id: 'approvals', label: 'Approvals', detail: 'Sensitive actions and policy decisions', icon: 'lock', group: 'operate' },
  { id: 'permissions', label: 'Permissions Matrix', detail: 'Agent capabilities, resource scope and authorization boundaries', icon: 'shield', group: 'integrate' },
  { id: 'observability', label: 'Observability', detail: 'Run metrics, events and latency views', icon: 'activity', group: 'operate' },
  { id: 'agents', label: 'Agent Profiles', detail: 'Specialist agents, models and budgets', icon: 'bot', group: 'operate' },
  { id: 'agent-control', label: 'Agent Control Plane', detail: 'Autonomy, policy, budgets, behavior and lifecycle controls', icon: 'sliders', group: 'configure' },
  { id: 'bots', label: 'Bots & Teams', detail: 'Named specialist bots, routines and mentions', icon: 'bot', group: 'operate' },
  { id: 'workflows', label: 'Workflows', detail: 'Reusable process definitions and step graphs', icon: 'clock', group: 'operate' },
  { id: 'automations', label: 'Automations', detail: 'Scheduled jobs, triggers and recurring runs', icon: 'calendar', group: 'operate' },
  { id: 'artifacts', label: 'Artifacts', detail: 'Generated files, screenshots, logs and handoffs', icon: 'archive', group: 'operate' },
  { id: 'research', label: 'Research', detail: 'Batch tasks, sources, trajectories and exports', icon: 'search', group: 'operate' },
{ id: 'evaluations', label: 'Evaluations', detail: 'Benchmark agents, prompts and model behavior with repeatable suites', icon: 'check', group: 'operate' },
  { id: 'versions', label: 'Agent Versions', detail: 'Immutable configurations, release states, diffs and rollback previews', icon: 'history', group: 'operate' },
  { id: 'audit', label: 'Audit Log', detail: 'Chronological evidence for agents, tools, policies and workspace events', icon: 'activity', group: 'operate' },
  { id: 'notifications', label: 'Notifications', detail: 'Approvals, run completions, failures and workspace alerts', icon: 'bell', group: 'operate' },
  { id: 'sessions', label: 'Sessions', detail: 'Conversation history, recall, export and lifecycle control', icon: 'history', group: 'operate' },
  { id: 'logs', label: 'Logs & Traces', detail: 'Structured events, tool output and diagnostic traces', icon: 'activity', group: 'operate' },
  { id: 'analytics', label: 'Analytics', detail: 'Usage, latency, tokens and workspace activity views', icon: 'activity', group: 'operate' },
  { id: 'batch', label: 'Batch Processing', detail: 'Process many inputs with bounded concurrency and results', icon: 'layers', group: 'operate' },
  { id: 'learning', label: 'Learning Loop', detail: 'Capture useful run outcomes and evolve skills locally', icon: 'spark', group: 'operate' },

{ id: 'providers', label: 'Providers & Models', detail: 'Routes, model catalog, failover and quotas', icon: 'network', group: 'configure' },
  { id: 'playground', label: 'Model Playground', detail: 'Compare models against identical prompts and inspect response metrics', icon: 'spark', group: 'configure' },
  { id: 'routing', label: 'Routing Studio', detail: 'Model priorities, role routing, health and fallback policy', icon: 'network', group: 'configure' },
  { id: 'token-observatory', label: 'Token Observatory', detail: 'Context pressure, token budgets, compaction and optimization pipeline', icon: 'archive', group: 'configure' },
  { id: 'skills', label: 'Skills', detail: 'Installable procedural capabilities', icon: 'spark', group: 'configure' },
  { id: 'tools', label: 'Tools', detail: 'Tool registry, risk and execution policy', icon: 'tool', group: 'configure' },
  { id: 'memory', label: 'Memory', detail: 'Persistent memory and cross-session recall', icon: 'database', group: 'configure' },
  { id: 'settings', label: 'Settings', detail: 'Appearance, behavior, privacy and safety', icon: 'sliders', group: 'configure' },
  { id: 'toolsets', label: 'Toolsets', detail: 'Activate grouped capabilities without changing individual tool policy', icon: 'layers', group: 'configure' },
  { id: 'credentials', label: 'Credentials', detail: 'Connection metadata without exposing secrets to the UI', icon: 'shield', group: 'configure' },
  { id: 'plugins', label: 'Plugins', detail: 'Extend the product surface with packaged capabilities', icon: 'tool', group: 'configure' },
  { id: 'hooks', label: 'Hooks & Policies', detail: 'Lifecycle hooks, middleware and event rules', icon: 'shield', group: 'configure' },
  { id: 'execution', label: 'Execution Lab', detail: 'Sandboxed code execution and reproducible task previews', icon: 'code', group: 'configure' },
  { id: 'marketplace', label: 'Marketplace', detail: 'Discover plugins, skills, MCP servers and reusable packages', icon: 'tool', group: 'configure' },

  { id: 'channels', label: 'Channels & Gateway', detail: 'Messaging surfaces, gateway connections and delivery', icon: 'message', group: 'integrate' },
  { id: 'browser', label: 'Browser', detail: 'Navigation, scraping, form actions and sessions', icon: 'globe', group: 'integrate' },
  { id: 'voice', label: 'Voice & Media', detail: 'Voice input, TTS, vision and media tools', icon: 'mic', group: 'integrate' },
  { id: 'mcp', label: 'MCP Servers', detail: 'External tool servers, OAuth and capabilities', icon: 'network', group: 'integrate' },
  { id: 'environments', label: 'Environments', detail: 'Development images, setup, network and runtime configuration', icon: 'cloud', group: 'integrate' },
  { id: 'webhooks', label: 'Webhooks & Events', detail: 'Inbound triggers, delivery attempts and endpoint policy', icon: 'globe', group: 'integrate' },
  { id: 'imports', label: 'Imports & Migrations', detail: 'Bring agent rules, skills and sessions from other systems', icon: 'arrow-down', group: 'integrate' },
  { id: 'media', label: 'Media Studio', detail: 'Image generation, vision, TTS and multimodal workflows', icon: 'layout', group: 'integrate' },
  { id: 'wake', label: 'Wake Word & Presence', detail: 'Hands-free activation, microphone presence and session readiness', icon: 'mic', group: 'integrate' },
  { id: 'integrations', label: 'Source Integrations', detail: 'GitHub, GitLab and connected engineering systems', icon: 'git', group: 'integrate' },
  { id: 'security', label: 'Security Center', detail: 'Sandboxing, approvals, network and data controls', icon: 'lock', group: 'integrate' },
  { id: 'homeassistant', label: 'Home Assistant', detail: 'Home automation tools and device actions through an integration boundary', icon: 'settings', group: 'integrate' },
  { id: 'social', label: 'Social Search', detail: 'Social/X search and external thread research tools', icon: 'search', group: 'integrate' },
]

export const primaryRailIds: ReadonlySet<RailMode> = new Set<RailMode>([
  'overview', 'chat', 'files', 'terminal',
  'runs', 'tasks', 'agents', 'approvals', 'workflows',
  'providers', 'tools', 'memory',
  'browser', 'mcp', 'security', 'permissions', 'settings',
])

export type PlatformMode = Extract<RailMode, 'overview' | 'agent-control' | 'prompts' | 'permissions' | 'projects' | 'tasks' | 'codebase' | 'context' | 'rules' | 'canvas' | 'commands' | 'background' | 'subagents' | 'cloud' | 'computer' | 'operations' | 'kanban' | 'reviews' | 'checkpoints' | 'bots' | 'automations' | 'channels' | 'browser' | 'voice' | 'research' | 'evaluations' | 'notifications' | 'sessions' | 'logs' | 'analytics' | 'batch' | 'learning' | 'mcp' | 'plugins' | 'hooks' | 'execution' | 'marketplace' | 'environments' | 'webhooks' | 'imports' | 'credentials' | 'toolsets' | 'media' | 'wake' | 'integrations' | 'security' | 'homeassistant' | 'social' | 'playground' | 'routing' | 'token-observatory' | 'versions' | 'audit'>

export const platformModes: ReadonlySet<RailMode> = new Set<PlatformMode>([
  'overview', 'agent-control', 'prompts', 'permissions', 'projects', 'tasks', 'codebase', 'context', 'rules', 'canvas', 'commands', 'background', 'subagents', 'cloud', 'computer', 'operations', 'kanban', 'reviews', 'checkpoints',
  'bots', 'automations', 'channels', 'browser', 'voice', 'research', 'evaluations', 'notifications', 'sessions', 'logs', 'analytics', 'batch', 'learning', 'mcp', 'plugins', 'hooks', 'execution', 'marketplace', 'environments', 'webhooks', 'imports', 'credentials', 'toolsets', 'media', 'wake', 'integrations', 'security', 'homeassistant', 'social', 'playground', 'routing', 'token-observatory', 'versions', 'audit',
])

export function isPlatformMode(mode: RailMode): mode is PlatformMode {
  return platformModes.has(mode)
}