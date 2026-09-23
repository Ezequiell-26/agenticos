export type RailMode =
  | 'chat'
  | 'files'
  | 'terminal'
  | 'runs'
  | 'approvals'
  | 'observability'
  | 'agents'
  | 'prompts'
  | 'workflows'
  | 'artifacts'
  | 'providers'
  | 'skills'
  | 'tools'
  | 'memory'
  | 'settings'
  | 'projects'
  | 'codebase'
  | 'context'
  | 'rules'
  | 'background'
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

export type NavigationGroup = 'build' | 'operate' | 'configure' | 'integrate'

export interface NavigationItem {
  id: RailMode
  label: string
  detail: string
  icon:
    | 'activity' | 'archive' | 'arrow-down' | 'arrow-up' | 'bot' | 'branch' | 'calendar'
    | 'check' | 'chevron-left' | 'chevron-right' | 'clock' | 'cloud' | 'code'
    | 'command' | 'copy' | 'folder' | 'git' | 'globe' | 'history' | 'layers'
    | 'layout' | 'message' | 'mic' | 'more' | 'paperclip' | 'play' | 'plus'
    | 'search' | 'send' | 'settings' | 'shield' | 'spark' | 'stop' | 'terminal'
    | 'tool' | 'x'
  group: NavigationGroup
}

export const navigationItems: NavigationItem[] = [
  { id: 'chat', label: 'Command Center', detail: 'Agent chat, context, commands and session control', icon: 'message', group: 'build' },
  { id: 'files', label: 'Files & Editor', detail: 'Explorer, editor, tabs, diff and inspector', icon: 'folder', group: 'build' },
  { id: 'terminal', label: 'Terminal', detail: 'Shell sessions and command execution', icon: 'terminal', group: 'build' },
  { id: 'prompts', label: 'Prompt Lab', detail: 'Reusable prompts, variables and templates', icon: 'spark', group: 'build' },
  { id: 'projects', label: 'Projects', detail: 'Workspace projects, tasks and active branches', icon: 'layers', group: 'build' },
  { id: 'codebase', label: 'Codebase Index', detail: 'Semantic search, indexing and repository map', icon: 'search', group: 'build' },
  { id: 'context', label: 'Context', detail: 'Context packs, token budget and source selection', icon: 'archive', group: 'build' },
  { id: 'rules', label: 'Rules & Instructions', detail: 'Project rules, AGENTS.md and agent identity', icon: 'shield', group: 'build' },

  { id: 'runs', label: 'Runs', detail: 'Execution lifecycle, verification and recovery', icon: 'activity', group: 'operate' },
  { id: 'background', label: 'Background Agents', detail: 'Long-running isolated agent tasks and worktrees', icon: 'cloud', group: 'operate' },
  { id: 'reviews', label: 'Reviews & Bugbot', detail: 'Diff review, findings and automated checks', icon: 'check', group: 'operate' },
  { id: 'checkpoints', label: 'Checkpoints', detail: 'Snapshots, diffs, rollback and restore previews', icon: 'git', group: 'operate' },
  { id: 'approvals', label: 'Approvals', detail: 'Sensitive actions and policy decisions', icon: 'shield', group: 'operate' },
  { id: 'observability', label: 'Observability', detail: 'Run metrics, events and latency views', icon: 'activity', group: 'operate' },
  { id: 'agents', label: 'Agent Profiles', detail: 'Specialist agents, models and budgets', icon: 'bot', group: 'operate' },
  { id: 'bots', label: 'Bots & Teams', detail: 'Named specialist bots, routines and mentions', icon: 'bot', group: 'operate' },
  { id: 'workflows', label: 'Workflows', detail: 'Reusable process definitions and step graphs', icon: 'clock', group: 'operate' },
  { id: 'automations', label: 'Automations', detail: 'Scheduled jobs, triggers and recurring runs', icon: 'calendar', group: 'operate' },
  { id: 'artifacts', label: 'Artifacts', detail: 'Generated files, screenshots, logs and handoffs', icon: 'archive', group: 'operate' },
  { id: 'research', label: 'Research', detail: 'Batch tasks, sources, trajectories and exports', icon: 'search', group: 'operate' },

  { id: 'providers', label: 'Providers & Models', detail: 'Routes, model catalog, failover and quotas', icon: 'bot', group: 'configure' },
  { id: 'skills', label: 'Skills', detail: 'Installable procedural capabilities', icon: 'spark', group: 'configure' },
  { id: 'tools', label: 'Tools', detail: 'Tool registry, risk and execution policy', icon: 'tool', group: 'configure' },
  { id: 'memory', label: 'Memory', detail: 'Persistent memory and cross-session recall', icon: 'history', group: 'configure' },
  { id: 'settings', label: 'Settings', detail: 'Appearance, behavior, privacy and safety', icon: 'settings', group: 'configure' },

  { id: 'channels', label: 'Channels & Gateway', detail: 'Messaging surfaces, gateway connections and delivery', icon: 'message', group: 'integrate' },
  { id: 'browser', label: 'Browser', detail: 'Navigation, scraping, form actions and sessions', icon: 'globe', group: 'integrate' },
  { id: 'voice', label: 'Voice & Media', detail: 'Voice input, TTS, vision and media tools', icon: 'mic', group: 'integrate' },
  { id: 'mcp', label: 'MCP Servers', detail: 'External tool servers, OAuth and capabilities', icon: 'tool', group: 'integrate' },
  { id: 'security', label: 'Security Center', detail: 'Sandboxing, approvals, network and data controls', icon: 'shield', group: 'integrate' },
]

export type PlatformMode = Extract<RailMode, 'projects' | 'codebase' | 'context' | 'rules' | 'background' | 'reviews' | 'checkpoints' | 'bots' | 'automations' | 'channels' | 'browser' | 'voice' | 'research' | 'mcp' | 'security'>

export const platformModes: ReadonlySet<RailMode> = new Set<PlatformMode>([
  'projects', 'codebase', 'context', 'rules', 'background', 'reviews', 'checkpoints',
  'bots', 'automations', 'channels', 'browser', 'voice', 'research', 'mcp', 'security',
])

export function isPlatformMode(mode: RailMode): mode is PlatformMode {
  return platformModes.has(mode)
}