import { useEffect, useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { runtime } from '../../services/runtime'

type SkillTab = 'Discover' | 'Installed' | 'Updates'
type SkillSort = 'newest' | 'name'

/** El catálogo local publica 'Today' / 'Yesterday' / '3d ago' y el runtime publica ISO, así que las dos formas se resuelven acá. */
function ageInDays(updated: string): number {
  if (updated === 'Today') return 0
  if (updated === 'Yesterday') return 1
  const relative = /^(\d+)d ago$/.exec(updated)
  if (relative) return Number(relative[1])
  const stamp = Date.parse(updated)
  return Number.isNaN(stamp) ? Number.MAX_SAFE_INTEGER : Math.max(0, Math.round((Date.now() - stamp) / 86_400_000))
}

/** Los comandos integrados declaran 'built-in' y el runtime puede responder 'runtime': la v sólo va delante de un número. */
function formatVersion(version: string): string {
  return /^\d/.test(version) ? 'v' + version : version
}

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
  const [runtimeBacked, setRuntimeBacked] = useState(false)
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState<SkillSort>('newest')

  useEffect(() => {
    let cancelled = false
    void runtime.skills.list().then((skills) => {
      if (cancelled) return
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
      setSelected((current) => mapped.some((skill) => skill.name === current) ? current : mapped[0]?.name ?? current)
      setRuntimeBacked(true)
    }).catch(() => {
      // Local catalog remains usable while the backend is unavailable.
    }).finally(() => { if (!cancelled) setRuntimeSyncing(false) })
    return () => { cancelled = true }
  }, [])

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const skill of liveSkills) counts.set(skill.category, (counts.get(skill.category) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [liveSkills])

  const visible = useMemo(() => {
    const filtered = liveSkills.filter((skill) => {
      if (tab === 'Installed' && !enabled.has(skill.name)) return false
      if (tab === 'Updates' && !skill.updated.includes('Today')) return false
      if (category !== 'All' && skill.category !== category) return false
      return !query || (skill.name + ' ' + skill.detail + ' ' + skill.category).toLowerCase().includes(query.toLowerCase())
    })
    return filtered.sort(sort === 'name'
      ? (a, b) => a.name.localeCompare(b.name)
      : (a, b) => ageInDays(a.updated) - ageInDays(b.updated) || a.name.localeCompare(b.name))
  }, [category, enabled, liveSkills, query, sort, tab])

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
    <div className="skills-discovery">
      <header className="platform-header">
        <div>
          <h1 className="qoder-discovery__title">
            <span className="qoder-discovery__lead">Discovery</span>
            <Icon name="spark" size={15} />
            <span className="qoder-discovery__subject">Skills<svg className="qoder-discovery__squiggle" viewBox="0 0 120 6" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M2 4C22 1.5 38 5 58 2.8 78 .6 96 4.6 118 2.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg></span>
          </h1>
          {categories.length > 0 && <p>With {categories.slice(0, 3).map(([name]) => name).join(', ')}.</p>}
        </div>
      </header>
      <div className="qoder-filterbar">
        <div className="qoder-filterbar__left qoder-chiprail" role="group" aria-label="Skill categories">
          {['All', ...categories.map(([name]) => name)].map((name) => <button type="button" key={name} className="qoder-chip" aria-pressed={category === name} onClick={() => setCategory(name)}>{name}</button>)}
        </div>
        <div className="qoder-filterbar__right">
          <span className="qoder-filterbar__label">{visible.length} of {liveSkills.length}</span>
          <div className="qoder-segment" role="group" aria-label="Sort skills">
            <button type="button" aria-pressed={sort === 'newest'} onClick={() => setSort('newest')}>Newest first</button>
            <button type="button" aria-pressed={sort === 'name'} onClick={() => setSort('name')}>Name</button>
          </div>
        </div>
      </div>
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
          {visible.map((skill) => <button type="button" key={skill.name} className={current?.name === skill.name ? 'skill-list-row skill-list-row--active' : 'skill-list-row'} onClick={() => setSelected(skill.name)}><span className="skill-list-icon"><Icon name={skill.category === 'Design' ? 'layout' : skill.category === 'Automation' ? 'activity' : 'spark'} size={13} /></span><span><strong>{skill.name}</strong><small>{skill.category} · {formatVersion(skill.version)}</small></span><span className={enabled.has(skill.name) ? 'status-dot status-dot--live' : 'status-dot status-dot--offline'} /></button>)}
          {visible.length === 0 && <div className="skills-empty">{liveSkills.length === 0 ? 'The runtime answered with no skills.' : 'No skills match the current filter.'}</div>}
        </div>
      </aside>
      {current ? <section className="skills-studio__detail">
        <div className="skills-detail-head"><div><span className="eyebrow">{current.category} · {runtimeSyncing ? 'syncing' : runtimeBacked ? 'runtime catalog' : 'preview catalog · offline'}</span><h2>{current.name}</h2><p>{current.detail}</p></div><span className={enabled.has(current.name) ? 'state-pill state-pill--active' : 'state-pill state-pill--pending'}>{enabled.has(current.name) ? 'Enabled' : 'Available'}</span></div>
        <div className="skills-detail-grid"><div><span>Version</span><strong>{current.version}</strong></div><div><span>Category</span><strong>{current.category}</strong></div><div><span>Last update</span><strong>{current.updated}</strong></div><div><span>State</span><strong>{enabled.has(current.name) ? 'Enabled' : 'Available'}</strong></div></div>
        <div className="skills-capabilities"><div className="surface-block__heading"><span>Capabilities</span><span className="mono-text">runtime contract</span></div><p className="skills-notice">The runtime reports a name, description, category, version and enabled state per skill. A per-skill capability list is not part of this build, so none is shown.</p></div>
        <div className="skills-permissions"><div className="surface-block__heading"><span>Permissions</span><span className="mono-text">policy</span></div><p className="skills-notice">Per-skill permissions are not part of this build. Tool authorization is governed by the Tool Policy surface, not by the skill record.</p></div>
        <div className="platform-actions"><button className={enabled.has(current.name) ? 'studio-button' : 'studio-button studio-button--active'} type="button" onClick={() => toggle(current.name)}>{enabled.has(current.name) ? 'Disable skill' : 'Enable skill'}</button><button className="studio-button" type="button" onClick={() => onAction(current.name + ' documentation opened in preview')}>View docs</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction(current.name + ' configuration opened in preview')}><Icon name="settings" size={13} /> Configure</button></div>
      </section> : <section className="skills-studio__detail"><div className="qoder-empty"><span className="qoder-empty__icon"><Icon name="spark" size={18} /></span><strong>No runtime skills</strong><p>The runtime answered with no skills, so there is no catalog entry to show.</p></div></section>}
      </div>
    </div>
  )
}
