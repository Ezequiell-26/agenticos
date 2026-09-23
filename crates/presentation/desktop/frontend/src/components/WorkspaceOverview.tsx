import type { ReactNode } from 'react'
import FileExplorer from './FileExplorer'
import Icon, { type IconName } from './Icon'
import ProviderDashboard from './ProviderDashboard'
import RunTimeline from './RunTimeline'

type RailMode = 'files' | 'runs' | 'providers' | 'settings'

const copy: Record<RailMode, { eyebrow: string; title: string; body: string; icon: IconName }> = {
  files: { eyebrow: 'Project', title: 'Workspace explorer', body: 'Your repository surface is ready for the next verified editor slice.', icon: 'folder' },
  runs: { eyebrow: 'Operations', title: 'Agent runs', body: 'Track planning, tool calls, verification and recovery from one command center.', icon: 'activity' },
  providers: { eyebrow: 'Model plane', title: 'Providers & models', body: 'Provider health, model capability and quota views stay behind the runtime service boundary.', icon: 'bot' },
  settings: { eyebrow: 'Control plane', title: 'Settings', body: 'Runtime, appearance, permissions and workspace policies are centralized here.', icon: 'settings' },
}

const views: Record<RailMode, () => ReactNode> = {
  files: () => <FileExplorer />,
  runs: () => <RunTimeline />,
  providers: () => <ProviderDashboard />,
  settings: () => (
    <section className="overview-surface">
      <div className="overview-heading"><div><span className="eyebrow">Control plane</span><h1>Settings</h1><p>Centralized runtime and workspace controls. Production permissions remain governed by Tauri and the backend.</p></div></div>
      <div className="settings-list">
        <div className="settings-row"><div><strong>Safety mode</strong><small>Destructive actions require explicit confirmation.</small></div><span className="settings-toggle settings-toggle--on">ON</span></div>
        <div className="settings-row"><div><strong>Runtime transport</strong><small>Tauri IPC / local HTTP abstraction.</small></div><span className="mono-text">AUTO</span></div>
        <div className="settings-row"><div><strong>Appearance</strong><small>AgentiCOS monochrome workspace.</small></div><span className="mono-text">BLACK / WHITE</span></div>
      </div>
    </section>
  ),
}

export default function WorkspaceOverview({ mode }: { mode: RailMode }) {
  const content = copy[mode]
  const View = views[mode]
  if (View) return <View />

  return (
    <section className="overview-surface">
      <div className="overview-surface__hero">
        <div className="empty-orb"><Icon name={content.icon} size={22} /></div>
        <span className="eyebrow">{content.eyebrow}</span>
        <h1>{content.title}</h1>
        <p>{content.body}</p>
      </div>
      <div className="overview-grid">
        <div className="overview-card"><span>Architecture</span><strong>Rust-first runtime</strong><small>UI talks through typed services.</small></div>
        <div className="overview-card"><span>Safety</span><strong>Fail-closed controls</strong><small>Destructive actions remain gated.</small></div>
        <div className="overview-card"><span>Transport</span><strong>Tauri IPC / HTTP</strong><small>Transport can change without rewriting features.</small></div>
      </div>
    </section>
  )
}
