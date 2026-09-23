import type { NavigationGroup, RailMode } from './navigation'

export type NavigationSection =
  | 'workspace'
  | 'build'
  | 'run'
  | 'intelligence'
  | 'governance'
  | 'integrations'
  | 'system'

export interface NavigationSectionMeta {
  id: NavigationSection
  label: string
  detail: string
  groups: NavigationGroup[]
}

export const navigationSections: NavigationSectionMeta[] = [
  { id: 'workspace', label: 'Workspace', detail: 'Project, files, sessions and day-to-day work surfaces.', groups: ['build', 'operate'] },
  { id: 'build', label: 'Build', detail: 'Coding, agents, prompts, workflows and developer tooling.', groups: ['build'] },
  { id: 'run', label: 'Run', detail: 'Execution, tasks, background work, review and recovery.', groups: ['operate'] },
  { id: 'intelligence', label: 'Intelligence', detail: 'Context, memory, knowledge, research, models and evaluation.', groups: ['configure', 'operate', 'build'] },
  { id: 'governance', label: 'Governance', detail: 'Permissions, approvals, security, QA, release and audit.', groups: ['configure', 'operate', 'integrate'] },
  { id: 'integrations', label: 'Integrations', detail: 'MCP, browser, channels, environments and external systems.', groups: ['integrate'] },
  { id: 'system', label: 'System', detail: 'Customization, help, plugins and product-level configuration.', groups: ['configure', 'integrate'] },
]

const workspaceIds: ReadonlySet<RailMode> = new Set([
  'project-control', 'overview', 'chat', 'projects', 'files', 'developer-workspace', 'git-control', 'sessions', 'notifications',
])

const buildIds: ReadonlySet<RailMode> = new Set([
  'agent-mission', 'agents', 'agent-control', 'prompts', 'workflows', 'commands', 'codebase', 'rules', 'context', 'canvas',
  'task-execution', 'terminal', 'frontend-coverage', 'navigation-center',
])

const intelligenceIds: ReadonlySet<RailMode> = new Set([
  'providers', 'model-control', 'intelligence-control', 'playground', 'routing', 'token-observatory', 'memory', 'knowledge', 'research', 'evaluations',
  'advanced-context', 'usage', 'learning', 'skills', 'tools', 'toolsets', 'subagents', 'teams', 'agent-arena',
])

const governanceIds: ReadonlySet<RailMode> = new Set([
  'permissions', 'approvals', 'security', 'qa', 'quality-workbench', 'governance-control', 'frontend-state-matrix', 'visual-accessibility-lab', 'collaboration-review',
  'release', 'audit', 'recovery', 'checkpoints', 'reviews', 'observability', 'logs', 'evidence-inspector', 'versions',
])

const integrationIds: ReadonlySet<RailMode> = new Set([
  'integration-control', 'mcp', 'browser', 'computer', 'voice', 'channels', 'environment-lab', 'environments', 'integrations', 'webhooks',
  'credentials', 'imports', 'media', 'wake', 'homeassistant', 'social', 'cloud', 'background', 'execution', 'automations', 'batch',
])

const systemIds: ReadonlySet<RailMode> = new Set([
  'settings', 'customization', 'help', 'marketplace', 'plugins', 'design-system', 'operations',
])

export function getNavigationSection(mode: RailMode): NavigationSection {
  if (workspaceIds.has(mode)) return 'workspace'
  if (buildIds.has(mode)) return 'build'
  if (intelligenceIds.has(mode)) return 'intelligence'
  if (governanceIds.has(mode)) return 'governance'
  if (integrationIds.has(mode)) return 'integrations'
  if (systemIds.has(mode)) return 'system'
  return 'run'
}
