import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Icon from './Icon'

type SettingKey =
  | 'autosave'
  | 'notifications'
  | 'sound'
  | 'compact'
  | 'motion'
  | 'reduceTransparency'
  | 'showLineNumbers'
  | 'wordWrap'
  | 'formatOnSave'
  | 'minimap'
  | 'safeMode'
  | 'confirmDestructive'
  | 'showToolCalls'
  | 'showReasoning'
  | 'streamResponses'
  | 'persistDrafts'
  | 'webByDefault'
  | 'rememberModel'
  | 'telemetry'
  | 'crashReports'
  | 'breadcrumbs'
  | 'stickyScroll'
  | 'tabPreview'
  | 'autoCloseBrackets'
  | 'sendOnEnter'
  | 'showTimestamps'
  | 'showCitations'
  | 'showTokenMeter'
  | 'autoRetry'
  | 'showPlan'
  | 'autoApproveRead'
  | 'networkGuard'
  | 'shellConfirmation'
  | 'gitForceGuard'
  | 'autoCompact'
  | 'excludeGenerated'
  | 'groupNotifications'
  | 'approvalNotifications'
  | 'backgroundNotifications'
  | 'clearOnExit'

interface SettingsSurfaceProps {
  notify: (message: string) => void
}

const storageKey = 'agenticos.ui.preferences'

const defaults: Record<SettingKey, boolean> = {
  autosave: true,
  notifications: true,
  sound: false,
  compact: false,
  motion: true,
  reduceTransparency: false,
  showLineNumbers: true,
  wordWrap: true,
  formatOnSave: true,
  minimap: false,
  safeMode: true,
  confirmDestructive: true,
  showToolCalls: true,
  showReasoning: true,
  streamResponses: true,
  persistDrafts: true,
  webByDefault: false,
  rememberModel: true,
  telemetry: false,
  crashReports: false,
  breadcrumbs: true,
  stickyScroll: false,
  tabPreview: true,
  autoCloseBrackets: true,
  sendOnEnter: true,
  showTimestamps: true,
  showCitations: true,
  showTokenMeter: true,
  autoRetry: true,
  showPlan: true,
  autoApproveRead: true,
  networkGuard: true,
  shellConfirmation: true,
  gitForceGuard: true,
  autoCompact: true,
  excludeGenerated: true,
  groupNotifications: true,
  approvalNotifications: true,
  backgroundNotifications: true,
  clearOnExit: false,
}

const sections = [
  ['General', 'General'],
  ['Appearance', 'Appearance'],
  ['Editor', 'Editor'],
  ['Chat', 'Chat'],
  ['Agent', 'Agent'],
  ['Tools', 'Tools'],
  ['Safety', 'Safety'],
  ['Context', 'Context'],
  ['Notifications', 'Notifications'],
  ['Privacy', 'Privacy'],
  ['Keyboard', 'Keyboard'],
  ['Advanced', 'Advanced'],
] as const

export default function SettingsSurface({ notify }: SettingsSurfaceProps) {
  const [section, setSection] = useState<string>('General')
  const [values, setValues] = useState(defaults)
  const [defaultModel, setDefaultModel] = useState('Auto route')
  const [defaultAgent, setDefaultAgent] = useState('Builder')
  const [defaultMode, setDefaultMode] = useState('Agent')
  const [theme, setTheme] = useState('Monochrome')
  const [density, setDensity] = useState('Comfortable')
  const [fontSize, setFontSize] = useState('13')
  const [contextMode, setContextMode] = useState('Balanced')
  const [language, setLanguage] = useState('English')
  const [keymap, setKeymap] = useState('Default')
  const [workspaceName, setWorkspaceName] = useState('Personal workspace')
  const [startupView, setStartupView] = useState('Command Center')
  const [uiScale, setUiScale] = useState('100%')
  const [terminalShell, setTerminalShell] = useState('PowerShell')
  const [compactionThreshold, setCompactionThreshold] = useState('78%')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<{
        values: Record<SettingKey, boolean>
        defaultModel: string
        defaultAgent: string
        theme: string
        density: string
        fontSize: string
        contextMode: string
        language: string
        keymap: string
        workspaceName: string
        startupView: string
        uiScale: string
        terminalShell: string
        compactionThreshold: string
      }>
      if (parsed.values) setValues((current) => ({ ...current, ...parsed.values }))
      if (parsed.defaultModel) setDefaultModel(parsed.defaultModel)
      if (parsed.defaultAgent) setDefaultAgent(parsed.defaultAgent)
      if (parsed.defaultMode) setDefaultMode(parsed.defaultMode)
      if (parsed.theme) setTheme(parsed.theme)
      if (parsed.density) setDensity(parsed.density)
      if (parsed.fontSize) setFontSize(parsed.fontSize)
      if (parsed.contextMode) setContextMode(parsed.contextMode)
      if (parsed.language) setLanguage(parsed.language)
      if (parsed.keymap) setKeymap(parsed.keymap)
      if (parsed.workspaceName) setWorkspaceName(parsed.workspaceName)
      if (parsed.startupView) setStartupView(parsed.startupView)
      if (parsed.uiScale) setUiScale(parsed.uiScale)
      if (parsed.terminalShell) setTerminalShell(parsed.terminalShell)
      if (parsed.compactionThreshold) setCompactionThreshold(parsed.compactionThreshold)
    } catch {
      // Preferences are optional presentation state.
    }
  }, [])

  const enabledCount = useMemo(() => Object.values(values).filter(Boolean).length, [values])

  function toggle(key: SettingKey) {
    setValues((current) => ({ ...current, [key]: !current[key] }))
    setSaved(false)
  }

  function save() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        values,
        defaultModel,
        defaultAgent,
        defaultMode,
        theme,
        density,
        fontSize,
        contextMode,
        language,
        keymap,
        workspaceName,
        startupView,
        uiScale,
        terminalShell,
        compactionThreshold,
      }))
    } catch {
      // Browser storage can be unavailable in restricted desktop contexts.
    }
    setSaved(true)
    notify('Settings saved locally')
  }

  function reset() {
    setValues(defaults)
    setDefaultModel('Auto route')
    setDefaultAgent('Builder')
    setDefaultMode('Agent')
    setTheme('Monochrome')
    setDensity('Comfortable')
    setFontSize('13')
    setContextMode('Balanced')
    setLanguage('English')
    setKeymap('Default')
    setWorkspaceName('Personal workspace')
    setStartupView('Command Center')
    setUiScale('100%')
    setTerminalShell('PowerShell')
    setCompactionThreshold('78%')
    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      // Optional presentation state.
    }
    setSaved(false)
    notify('Settings restored to defaults')
  }

  return (
    <section className="settings-surface">
      <header className="settings-hero">
        <div>
          <span className="eyebrow">Control plane</span>
          <h1>Settings</h1>
          <p>Configure the complete AgentiCOS desktop experience. These controls are presentation-local until a matching runtime contract exists.</p>
        </div>
        <div className="settings-hero__actions">
          <span className="settings-count"><strong>{enabledCount}</strong> enabled preferences</span>
          <button className="studio-button" type="button" onClick={reset}><Icon name="history" size={14} /> Reset</button>
          <button className={`studio-button ${saved ? 'studio-button--active' : ''}`} type="button" onClick={save}><Icon name="check" size={14} /> {saved ? 'Saved' : 'Save changes'}</button>
        </div>
      </header>

      <div className="settings-workbench">
        <aside className="settings-nav settings-nav--full" aria-label="Settings sections">
          {sections.map(([id, label]) => (
            <button type="button" className={section === id ? 'settings-nav__active' : ''} onClick={() => setSection(id)} key={id}>
              <span>{label}</span>
              {id === 'Safety' && <span className="nav-badge">SAFE</span>}
            </button>
          ))}
        </aside>

        <main className="settings-panel">
          {section === 'General' && (
            <SettingsGroup title="Workspace" description="Core workspace identity and startup behavior.">
              <TextField label="Workspace name" value={workspaceName} onChange={setWorkspaceName} />
              <SelectField label="Default language" value={language} onChange={setLanguage} options={['English', 'Spanish', 'Portuguese', 'Auto']} />
              <SelectField label="Default agent" value={defaultAgent} onChange={setDefaultAgent} options={['Builder', 'Reviewer', 'Researcher', 'Custom']} />
              <ToggleRow label="Autosave" detail="Persist drafts and local interface state automatically." enabled={values.autosave} onChange={() => toggle('autosave')} />
              <ToggleRow label="Remember model" detail="Keep the last selected model for new conversations." enabled={values.rememberModel} onChange={() => toggle('rememberModel')} />
              <SelectField label="Startup view" value={startupView} onChange={setStartupView} options={['Command Center', 'Last opened view', 'Tasks', 'Runs']} />
              <TextField label="Workspace path" value="Local workspace (runtime-owned)" onChange={() => undefined} />
            </SettingsGroup>
          )}

          {section === 'Appearance' && (
            <SettingsGroup title="Interface" description="Control density, motion and the visual character of the desktop shell.">
              <SelectField label="Theme" value={theme} onChange={setTheme} options={['Monochrome', 'Midnight', 'High contrast', 'System']} />
              <SelectField label="Density" value={density} onChange={setDensity} options={['Compact', 'Comfortable', 'Spacious']} />
              <SelectField label="UI font size" value={fontSize} onChange={setFontSize} options={['11', '12', '13', '14', '15', '16']} suffix="px" />
              <SelectField label="UI scale" value={uiScale} onChange={setUiScale} options={['90%', '100%', '110%', '120%']} />
              <ToggleRow label="Motion" detail="Use subtle transitions throughout the interface." enabled={values.motion} onChange={() => toggle('motion')} />
              <ToggleRow label="Reduce transparency" detail="Use solid surfaces instead of translucent layers." enabled={values.reduceTransparency} onChange={() => toggle('reduceTransparency')} />
              <div className="preview-strip"><span className="preview-dot" /><div><strong>Live preview</strong><small>Interface preview follows the selected density and theme.</small></div></div>
            </SettingsGroup>
          )}

          {section === 'Editor' && (
            <SettingsGroup title="Editor" description="Code editing, navigation and visual assistance preferences.">
              <ToggleRow label="Show line numbers" detail="Display line numbers beside source code." enabled={values.showLineNumbers} onChange={() => toggle('showLineNumbers')} />
              <ToggleRow label="Word wrap" detail="Wrap long code and markdown lines to the editor width." enabled={values.wordWrap} onChange={() => toggle('wordWrap')} />
              <ToggleRow label="Format on save" detail="Run formatting whenever a local draft is saved." enabled={values.formatOnSave} onChange={() => toggle('formatOnSave')} />
              <ToggleRow label="Minimap" detail="Keep a compact source overview on the editor edge." enabled={values.minimap} onChange={() => toggle('minimap')} />
              <ToggleRow label="Breadcrumbs" detail="Show file and symbol ancestry above the editor." enabled={values.breadcrumbs} onChange={() => toggle('breadcrumbs')} />
              <ToggleRow label="Sticky scroll" detail="Keep the active scope heading visible while scrolling." enabled={values.stickyScroll} onChange={() => toggle('stickyScroll')} />
              <ToggleRow label="Tab preview" detail="Open temporary tabs before pinning them." enabled={values.tabPreview} onChange={() => toggle('tabPreview')} />
              <ToggleRow label="Auto-close brackets" detail="Close paired brackets when editing code." enabled={values.autoCloseBrackets} onChange={() => toggle('autoCloseBrackets')} />
            </SettingsGroup>
          )}

          {section === 'Chat' && (
            <SettingsGroup title="Chat defaults" description="Define how new conversations open and how the composer behaves.">
              <SelectField label="Default model" value={defaultModel} onChange={setDefaultModel} options={['Auto route', 'GPT-OSS 120B', 'Qwen3 Coder', 'DeepSeek', 'Local model']} />
              <SelectField label="Context strategy" value={contextMode} onChange={setContextMode} options={['Balanced', 'Maximum context', 'Focused', 'Minimal']} />
              <ToggleRow label="Stream responses" detail="Render assistant output progressively when supported." enabled={values.streamResponses} onChange={() => toggle('streamResponses')} />
              <ToggleRow label="Web access by default" detail="Enable the web-access control for new conversations." enabled={values.webByDefault} onChange={() => toggle('webByDefault')} />
              <ToggleRow label="Persist drafts" detail="Keep unsent composer text when switching workspaces." enabled={values.persistDrafts} onChange={() => toggle('persistDrafts')} />
              <SelectField label="Response format" value="Markdown" onChange={() => undefined} options={['Markdown', 'Plain text', 'Structured', 'Code first']} />
              <ToggleRow label="Send on Enter" detail="Submit the composer with Enter and use Shift+Enter for new lines." enabled={values.sendOnEnter} onChange={() => toggle('sendOnEnter')} />
              <ToggleRow label="Show timestamps" detail="Display message timestamps in the conversation." enabled={values.showTimestamps} onChange={() => toggle('showTimestamps')} />
              <ToggleRow label="Show citations" detail="Reserve space for source references when available." enabled={values.showCitations} onChange={() => toggle('showCitations')} />
              <ToggleRow label="Token meter" detail="Keep the estimated context budget visible beside the composer." enabled={values.showTokenMeter} onChange={() => toggle('showTokenMeter')} />
            </SettingsGroup>
          )}

          {section === 'Agent' && (
            <SettingsGroup title="Agent behavior" description="Default behavior controls for the agent workspace.">
              <SelectField label="Operating profile" value={defaultAgent} onChange={setDefaultAgent} options={['Builder', 'Reviewer', 'Researcher', 'Custom']} />
              <RangeRow label="Creativity" description="How exploratory generated responses should be." value={35} />
              <RangeRow label="Autonomy" description="How much initiative the agent may present in preview." value={58} />
              <RangeRow label="Tool budget" description="Maximum tool activity shown in the UI simulation." value={72} />
              <SelectField label="Default agent mode" value={defaultMode} onChange={setDefaultMode} options={['Agent', 'Plan', 'Ask', 'Debug', 'Bot']} />
              <RangeRow label="Creativity" description="How exploratory generated responses should be." value={35} />
              <RangeRow label="Autonomy" description="How much initiative the agent may present in preview." value={58} />
              <RangeRow label="Tool budget" description="Maximum tool activity shown in the UI simulation." value={72} />
              <SelectField label="Max parallel agents" value="4" onChange={() => undefined} options={['1', '2', '4', '6', '8']} />
              <SelectField label="Stop timeout" value="120s" onChange={() => undefined} options={['30s', '60s', '120s', '300s']} />
              <ToggleRow label="Auto retry" detail="Show bounded retry behavior for recoverable preview failures." enabled={values.autoRetry} onChange={() => toggle('autoRetry')} />
              <ToggleRow label="Show plan" detail="Keep the plan stage visible before tool execution." enabled={values.showPlan} onChange={() => toggle('showPlan')} />
            </SettingsGroup>
          )}

          {section === 'Tools' && (
            <SettingsGroup title="Tool experience" description="Visibility and local control preferences for the tool layer.">
              <ToggleRow label="Show tool calls" detail="Keep tool activity visible inside run and chat surfaces." enabled={values.showToolCalls} onChange={() => toggle('showToolCalls')} />
              <ToggleRow label="Confirmation before high-risk tools" detail="Require a visual confirmation step for risky actions." enabled={values.confirmDestructive} onChange={() => toggle('confirmDestructive')} />
              <ToggleRow label="Auto-approve read-only tools" detail="Allow filesystem/search-style reads to remain unobstructed in the UI." enabled={values.autoApproveRead} onChange={() => toggle('autoApproveRead')} />
              <SelectField label="Terminal shell" value={terminalShell} onChange={setTerminalShell} options={['PowerShell', 'Command Prompt', 'Bash', 'Zsh']} />
              <ToggleRow label="Shell confirmation" detail="Always ask before showing destructive shell actions as allowed." enabled={values.shellConfirmation} onChange={() => toggle('shellConfirmation')} />
              <SelectField label="Default keymap" value={keymap} onChange={setKeymap} options={['Default', 'VS Code', 'Vim', 'Emacs']} />
              <div className="tool-permission-grid"><PermissionCard name="Filesystem" risk="High" /><PermissionCard name="Terminal" risk="Critical" /><PermissionCard name="Browser" risk="High" /><PermissionCard name="Git" risk="High" /></div>
            </SettingsGroup>
          )}

          {section === 'Safety' && (
            <SettingsGroup title="Safety & permissions" description="Visual safety policy controls for the workspace.">
              <ToggleRow label="Fail-closed mode" detail="Block destructive UI actions when no explicit permission state exists." enabled={values.safeMode} onChange={() => toggle('safeMode')} />
              <ToggleRow label="Confirm destructive actions" detail="Require an explicit confirmation step before destructive workflows." enabled={values.confirmDestructive} onChange={() => toggle('confirmDestructive')} />
              <ToggleRow label="Network guard" detail="Keep outbound network access behind an explicit policy state." enabled={values.networkGuard} onChange={() => toggle('networkGuard')} />
              <ToggleRow label="Git force guard" detail="Surface force push/reset operations as blocked until reviewed." enabled={values.gitForceGuard} onChange={() => toggle('gitForceGuard')} />
              <div className="safety-banner"><Icon name="shield" size={17} /><div><strong>Protected workspace</strong><small>Presentation controls do not grant runtime permissions. Real authorization remains outside this UI layer.</small></div><span>ACTIVE</span></div>
              <div className="safety-checks"><span><Icon name="check" size={12} /> Destructive-by-default disabled</span><span><Icon name="check" size={12} /> Secrets stay out of UI state</span><span><Icon name="check" size={12} /> Review states remain visible</span></div>
            </SettingsGroup>
          )}

          {section === 'Context' && (
            <SettingsGroup title="Context & memory" description="Tune what context the workspace presents to an agent.">
              <SelectField label="Context strategy" value={contextMode} onChange={setContextMode} options={['Balanced', 'Maximum context', 'Focused', 'Minimal']} />
              <RangeRow label="Context budget" description="Preview budget meter used by the chat composer." value={72} />
              <RangeRow label="Memory priority" description="How strongly pinned memory appears in previews." value={84} />
              <ToggleRow label="Persist drafts" detail="Keep local unsent text available across sessions." enabled={values.persistDrafts} onChange={() => toggle('persistDrafts')} />
              <SelectField label="Auto-compaction threshold" value={compactionThreshold} onChange={setCompactionThreshold} options={['65%', '72%', '78%', '85%', '90%']} />
              <ToggleRow label="Auto compact" detail="Show context compaction as a deliberate preview stage before limits are reached." enabled={values.autoCompact} onChange={() => toggle('autoCompact')} />
              <ToggleRow label="Exclude generated files" detail="Prefer source files over generated output when building context." enabled={values.excludeGenerated} onChange={() => toggle('excludeGenerated')} />
            </SettingsGroup>
          )}

          {section === 'Notifications' && (
            <SettingsGroup title="Notifications" description="Control how the desktop communicates background activity.">
              <ToggleRow label="Notifications" detail="Show completion and workspace event toasts." enabled={values.notifications} onChange={() => toggle('notifications')} />
              <ToggleRow label="Sound" detail="Play a subtle sound for completion and approval events." enabled={values.sound} onChange={() => toggle('sound')} />
              <ToggleRow label="Crash reports" detail="Allow anonymous crash-report UI state in the preview." enabled={values.crashReports} onChange={() => toggle('crashReports')} />
              <ToggleRow label="Group notifications" detail="Combine related workspace alerts into one inbox group." enabled={values.groupNotifications} onChange={() => toggle('groupNotifications')} />
              <ToggleRow label="Approval notifications" detail="Always surface permission requests in the notification center." enabled={values.approvalNotifications} onChange={() => toggle('approvalNotifications')} />
              <ToggleRow label="Background notifications" detail="Surface background-agent completion and failure events." enabled={values.backgroundNotifications} onChange={() => toggle('backgroundNotifications')} />
            </SettingsGroup>
          )}

          {section === 'Privacy' && (
            <SettingsGroup title="Privacy" description="Presentation-level privacy preferences.">
              <ToggleRow label="Telemetry" detail="Allow local telemetry controls to be shown as enabled." enabled={values.telemetry} onChange={() => toggle('telemetry')} />
              <ToggleRow label="Crash reports" detail="Show crash-report preference as enabled." enabled={values.crashReports} onChange={() => toggle('crashReports')} />
              <ToggleRow label="Clear local state on exit" detail="Remove presentation-only session data when the app exits." enabled={values.clearOnExit} onChange={() => toggle('clearOnExit')} />
              <button className="studio-button" type="button" onClick={() => notify('Local presentation data clear staged in preview')}><Icon name="history" size={13} /> Clear local presentation data</button>
              <div className="privacy-note"><Icon name="shield" size={15} /><span>Secrets, API keys and credentials are never stored by this settings component.</span></div>
            </SettingsGroup>
          )}

          {section === 'Keyboard' && (
            <SettingsGroup title="Keyboard shortcuts" description="Command palette and editor shortcut references.">
              <ShortcutRow keys="⌘K" label="Command palette" detail="Search commands, views and conversations" />
              <ShortcutRow keys="⌘N" label="New conversation" detail="Open a clean agent session" />
              <ShortcutRow keys="Enter" label="Send message" detail="Submit the composer when focus is in chat" />
              <ShortcutRow keys="Shift Enter" label="New line" detail="Insert a newline without sending" />
              <ShortcutRow keys="↑ ↓" label="Palette navigation" detail="Move through command results" />
              <ShortcutRow keys="Esc" label="Close overlay" detail="Close the palette or current overlay" />
            </SettingsGroup>
          )}

          {section === 'Advanced' && (
            <SettingsGroup title="Advanced" description="Developer-oriented preferences for the desktop shell.">
              <SelectField label="UI language" value={language} onChange={setLanguage} options={['English', 'Spanish', 'Portuguese', 'Auto']} />
              <SelectField label="Keyboard map" value={keymap} onChange={setKeymap} options={['Default', 'VS Code', 'Vim', 'Emacs']} />
              <ToggleRow label="Compact mode" detail="Reduce panel spacing and chrome throughout the workspace." enabled={values.compact} onChange={() => toggle('compact')} />
              <ToggleRow label="Motion" detail="Use subtle transitions and activity feedback." enabled={values.motion} onChange={() => toggle('motion')} />
              <div className="advanced-grid"><div><span>Frontend build</span><strong>React + TypeScript + Vite</strong></div><div><span>UI state</span><strong>Local / preview</strong></div><div><span>Runtime bridge</span><strong>Typed service boundary</strong></div><div><span>Safety</span><strong>Fail-closed</strong></div></div>
            </SettingsGroup>
          )}
        </main>
      </div>
    </section>
  )
}

function SettingsGroup({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="settings-group"><div className="settings-group__header"><div><span>{title}</span><small>{description}</small></div><Icon name="settings" size={15} /></div>{children}</section>
}

function ToggleRow({ label, detail, enabled, onChange }: { label: string; detail: string; enabled: boolean; onChange: () => void }) {
  return <div className="settings-toggle-row"><div><strong>{label}</strong><span>{detail}</span></div><button className={`switch ${enabled ? 'switch--on' : ''}`} role="switch" aria-checked={enabled} onClick={onChange} type="button"><span /></button></div>
}

function SelectField({ label, value, onChange, options, suffix }: { label: string; value: string; onChange: (value: string) => void; options: string[]; suffix?: string }) {
  return <label className="select-field"><span>{label}</span><div><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select>{suffix && <small>{suffix}</small>}</div></label>
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="select-field"><span>{label}</span><input className="settings-input" value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

function RangeRow({ label, description, value }: { label: string; description: string; value: number }) {
  const [current, setCurrent] = useState(value)
  return <div className="range-row"><div><strong>{label}</strong><span>{description}</span></div><div className="range-control"><input type="range" min="0" max="100" value={current} onChange={(event) => setCurrent(Number(event.target.value))} /><output>{current}</output></div></div>
}

function PermissionCard({ name, risk }: { name: string; risk: string }) {
  return <div className="permission-card"><div><Icon name="tool" size={14} /><strong>{name}</strong></div><span>{risk}</span></div>
}

function ShortcutRow({ keys, label, detail }: { keys: string; label: string; detail: string }) {
  return <div className="shortcut-row"><kbd>{keys}</kbd><div><strong>{label}</strong><span>{detail}</span></div></div>
}

