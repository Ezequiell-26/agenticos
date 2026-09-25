import { useEffect, useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { runtime } from '../../services/runtime'

type SkillTab = 'Discover' | 'Installed' | 'Updates'

const skillCatalog = [
  { name: 'Repository Analyst', detail: 'Inspect codebases, architecture and dependency graphs.', category: 'Analysis', version: '1.4.0', installed: true, updated: 'Today' },
  { name: 'Browser Operator', detail: 'Navigate, inspect and verify web applications.', category: 'Automation', version: '2.1.3', installed: true, updated: 'Yesterday' },
  { name: 'Release Engineer', detail: 'Build release plans, evidence packs and CI checklists.', category: 'DevOps', version: '1.1.2', installed: false, updated: '3d ago' },
  { name: 'Code Reviewer', detail: 'Review diffs, regressions, tests and contracts.', category: 'Engineering', version: '2.0.4', installed: true, updated: 'Today' },
  { name: 'Researcher', detail: 'Gather sources and produce evidence-backed research.', category: 'Research', version: '3.0.0', installed: false, updated: '5d ago' },
  { name: 'UI Designer', detail: 'Compose layouts, interactions and product critique.', category: 'Design', version: '1.6.2', installed: false, updated: '1d ago' },
  { name: 'Test Engineer', detail: 'Create deterministic tests and verification plans.', category: 'Quality', version: '1.9.1', installed: true, updated: 'Today' },
  { name: 'Data Operator', detail: 'Transform datasets and produce structured outputs.', category: 'Data', version: '1.2.5', installed: false, updated: '6d ago' },
  { name: '/automate', detail: 'Create scheduled and event-triggered automations.', category: 'Cursor', version: 'built-in', installed: true, updated: 'Today' },
  { name: '/autopilot', detail: 'Monitor a pull request and handle follow-up work.', category: 'Cursor', version: 'built-in', installed: false, updated: 'Today' },
  { name: '/canvas', detail: 'Create interactive React artifacts alongside chat.', category: 'Cursor', version: 'built-in', installed: true, updated: 'Today' },
  { name: '/create-hook', detail: 'Create lifecycle hooks and update hook configuration.', category: 'Cursor', version: 'built-in', installed: false, updated: 'Today' },
  { name: '/create-rule', detail: 'Create scoped rules for user, project or team behavior.', category: 'Cursor', version: 'built-in', installed: true, updated: 'Today' },
  { name: '/create-skill', detail: 'Create portable Agent Skill packages with SKILL.md.', category: 'Cursor', version: 'built-in', installed: false, updated: 'Today' },
  { name: '/create-subagent', detail: 'Create focused subagents with models and tool access.', category: 'Cursor', version: 'built-in', installed: false, updated: 'Today' },
  { name: '/review-bugbot', detail: 'Review changes for bugs, security and regressions.', category: 'Cursor', version: 'built-in', installed: true, updated: 'Today' },
  { name: '/review-security', detail: 'Run security-focused review workflows.', category: 'Cursor', version: 'built-in', installed: false, updated: 'Today' },
  { name: '/loop', detail: 'Repeat a prompt or skill on a defined interval.', category: 'Cursor', version: 'built-in', installed: false, updated: 'Today' },
  { name: '/cursor-blame', detail: 'Investigate AI-authored changes and the prompts behind them.', category: 'Cursor', version: 'built-in', installed: false, updated: 'Today' },
  { name: '/migrate-to-skills', detail: 'Convert eligible rules and slash commands into skills.', category: 'Cursor', version: 'built-in', installed: false, updated: 'Today' },
  { name: '/sdk', detail: 'Build applications and integrations with the Cursor SDK.', category: 'Cursor', version: 'built-in', installed: false, updated: 'Today' },
  { name: '/split-to-prs', detail: 'Split a large change into smaller pull requests.', category: 'Cursor', version: 'built-in', installed: false, updated: 'Today' },
  { name: '/statusline', detail: 'Configure the agent status line presentation.', category: 'Cursor', version: 'built-in', installed: false, updated: 'Today' },
  { name: '/update-cli-config', detail: 'Update Cursor CLI configuration.', category: 'Cursor', version: 'built-in', installed: false, updated: 'Today' },
  { name: '/update-cursor-settings', detail: 'Find and update Cursor or VS Code settings.', category: 'Cursor', version: 'built-in', installed: false, updated: 'Today' },
]

export default function SkillsStudio({ onAction }: { onAction: (message: string) => void }) {
  const [tab, setTab] = useState<SkillTab>('Discover')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(skillCatalog[0].name)
  const [enabled, setEnabled] = useState(() => new Set(skillCatalog.filter((skill) => skill.installed).map((skill) => skill.name)))
  const [liveSkills, setLiveSkills] = useState(skillCatalog)
  const [runtimeSyncing, setRuntimeSyncing] = useState(true)

  useEffect(() => {
    let cancelled = false
    void runtime.skills.list().then((skills) => {
      if (cancelled || skills.length === 0) return
      const mapped = skills.map((skill, index) => ({
        name: typeof skill.name === 'string' ? skill.name : typeof skill.skill_id === 'string' ? skill.skill_id : `runtime-skill-${index + 1}`,
        detail: typeof skill.description === 'string' ? skill.description : 'Runtime-managed skill',
        category: typeof skill.category === 'string' ? skill.category : 'Runtime',
        version: typeof skill.version === 'string' ? skill.version : 'runtime',
        installed: skill.enabled !== false,
        updated: typeof skill.updated_at === 'string' ? skill.updated_at : 'Runtime',
      }))
      setLiveSkills(mapped)
      setEnabled(new Set(mapped.filter((skill) => skill.installed).map((skill) => skill.name)))
      setSelected((current) => mapped.some((skill) => skill.name === current) ? current : mapped[0].name)
    }).catch(() => {
      // Local catalog remains usable while the backend is unavailable.
    }).finally(() => { if (!cancelled) setRuntimeSyncing(false) })
    return () => { cancelled = true }
  }, [])

  const visible = useMemo(() => liveSkills.filter((skill) => {
    if (tab === 'Installed' && !enabled.has(skill.name)) return false
    if (tab === 'Updates' && !skill.updated.includes('Today')) return false
    return !query || (skill.name + ' ' + skill.detail + ' ' + skill.category).toLowerCase().includes(query.toLowerCase())
  }), [enabled, liveSkills, query, tab])

  const current = liveSkills.find((skill) => skill.name === selected) ?? liveSkills[0]

  async function toggle(name: string) {
    const nextEnabled = !enabled.has(name)
    setEnabled((state) => {
      const next = new Set(state)
      nextEnabled ? next.add(name) : next.delete(name)
      return next
    })

    try {
      const updated = await runtime.skills.setEnabled(name, nextEnabled)
      setLiveSkills((skills) => skills.map((skill) => (
        skill.name === name
          ? { ...skill, installed: nextEnabled, updated: typeof updated.updated_at === 'string' ? updated.updated_at : skill.updated }
          : skill
      )))
      onAction(name + (nextEnabled ? ' skill enabled' : ' skill disabled'))
    } catch (error) {
      setEnabled((state) => {
        const next = new Set(state)
        nextEnabled ? next.delete(name) : next.add(name)
        return next
      })
      onAction(name + ' skill update failed')
    }
  }

  return (
    <div className="skills-studio">
      <aside className="skills-studio__sidebar">
        <div className="skills-search"><Icon name="search" size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search skills…" aria-label="Search skills" /></div>
        <div className="skills-tabs" role="tablist" aria-label="Skill catalog" aria-orientation="horizontal">
          {(['Discover', 'Installed', 'Updates'] as SkillTab[]).map((item, index, tabs) => <button key={item} id={'skills-tab-' + item.toLowerCase()} type="button" role="tab" tabIndex={tab === item ? 0 : -1} aria-selected={tab === item} aria-controls="skills-list-panel" className={tab === item ? 'skills-tab skills-tab--active' : 'skills-tab'} onClick={() => setTab(item)} onKeyDown={(event) => {
            const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
            if (nextIndex >= 0) { event.preventDefault(); const next = tabs[nextIndex]; setTab(next); window.requestAnimationFrame(() => document.getElementById('skills-tab-' + next.toLowerCase())?.focus()) }
          }}>{item}</button>)}
        </div>
        <div id="skills-list-panel" className="skills-list" role="tabpanel" aria-labelledby={'skills-tab-' + tab.toLowerCase()} tabIndex={0}>
          {visible.map((skill) => <button type="button" key={skill.name} className={current.name === skill.name ? 'skill-list-row skill-list-row--active' : 'skill-list-row'} onClick={() => setSelected(skill.name)}><span className="skill-list-icon"><Icon name={skill.category === 'Design' ? 'layout' : skill.category === 'Automation' ? 'activity' : 'spark'} size={13} /></span><span><strong>{skill.name}</strong><small>{skill.category} · v{skill.version}</small></span><span className={enabled.has(skill.name) ? 'status-dot status-dot--live' : 'status-dot status-dot--offline'} /></button>)}
          {visible.length === 0 && <div className="skills-empty">No skills match the current filter.</div>}
        </div>
      </aside>
      <section className="skills-studio__detail">
        <div className="skills-detail-head"><div><span className="eyebrow">{current.category} · {runtimeSyncing ? 'syncing' : 'runtime catalog'}</span><h2>{current.name}</h2><p>{current.detail}</p></div><span className={enabled.has(current.name) ? 'state-pill state-pill--active' : 'state-pill state-pill--pending'}>{enabled.has(current.name) ? 'Enabled' : 'Available'}</span></div>
        <div className="skills-detail-grid"><div><span>Version</span><strong>{current.version}</strong></div><div><span>Category</span><strong>{current.category}</strong></div><div><span>Last update</span><strong>{current.updated}</strong></div><div><span>Tools</span><strong>8 tools</strong></div></div>
        <div className="skills-capabilities"><div className="surface-block__heading"><span>Capabilities</span><span className="mono-text">preview</span></div><div className="capability-grid"><span className="platform-tag">Repository search</span><span className="platform-tag">Context assembly</span><span className="platform-tag">Diff analysis</span><span className="platform-tag">Evidence output</span><span className="platform-tag">Verification</span></div></div>
        <div className="skills-permissions"><div className="surface-block__heading"><span>Permissions</span><span className="mono-text">policy</span></div><div><span>Read workspace</span><strong>Allowed</strong></div><div><span>Write files</span><strong>Policy based</strong></div><div><span>Network</span><strong>Confirm</strong></div><div><span>Destructive</span><strong>Blocked</strong></div></div>
        <div className="platform-actions"><button className={enabled.has(current.name) ? 'studio-button' : 'studio-button studio-button--active'} type="button" onClick={() => toggle(current.name)}>{enabled.has(current.name) ? 'Disable skill' : 'Enable skill'}</button><button className="studio-button" type="button" onClick={() => onAction(current.name + ' documentation opened in preview')}>View docs</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction(current.name + ' configuration opened in preview')}><Icon name="settings" size={13} /> Configure</button></div>
      </section>
    </div>
  )
}
