import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'

const commands: ReadonlyArray<readonly [string, string, string]> = [
  ['/automate', 'Create or edit an automation', 'Cursor'],
  ['/autopilot', 'Monitor a PR and handle follow-up work', 'Cursor'],
  ['/canvas', 'Create an interactive React artifact', 'Cursor'],
  ['/create-hook', 'Create an agent lifecycle hook', 'Cursor'],
  ['/create-rule', 'Create scoped agent rules', 'Cursor'],
  ['/create-skill', 'Create an Agent Skill package', 'Cursor'],
  ['/create-subagent', 'Create a focused subagent', 'Cursor'],
  ['/review', 'Run the appropriate review workflow', 'Cursor'],
  ['/review-bugbot', 'Run Bugbot-style regression review', 'Cursor'],
  ['/shell', 'Run a literal shell command', 'Cursor'],
  ['/cursor-blame', 'Investigate AI-authored changes and their prompts', 'Cursor'],
  ['/loop', 'Run a prompt or skill repeatedly', 'Cursor'],
  ['/migrate-to-skills', 'Convert eligible rules and commands to skills', 'Cursor'],
  ['/sdk', 'Build applications and integrations with the Cursor SDK', 'Cursor'],
  ['/split-to-prs', 'Split a large change into smaller pull requests', 'Cursor'],
  ['/statusline', 'Configure the agent status line', 'Cursor'],
  ['/update-cli-config', 'Update Cursor CLI configuration', 'Cursor'],
  ['/update-cursor-settings', 'Update Cursor or VS Code settings', 'Cursor'],
  ['/plan', 'Create a step-by-step plan', 'AgentiCOS'],
  ['/research', 'Gather evidence before action', 'AgentiCOS'],
] as const

export default function CommandStudio({ onAction }: { onAction: (message: string) => void }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(commands[0][0])
  const [instruction, setInstruction] = useState('Review the current branch and produce a bounded implementation plan.')
  const visible = useMemo(() => commands.filter(([name, description, source]) => (name + description + source).toLowerCase().includes(query.toLowerCase())), [query])
  const current = commands.find((item) => item[0] === selected) ?? commands[0]

  return (
    <div className="capability-studio">
      <aside className="capability-list">
        <div className="command-search"><Icon name="search" size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search commands…" aria-label="Search commands" /></div>
        <div className="capability-list__head"><span>Slash workflows</span><span className="count-pill">{visible.length}</span></div>
        {visible.map(([name, description, source]) => <button type="button" key={name} className={selected === name ? 'capability-row capability-row--active' : 'capability-row'} onClick={() => setSelected(name)}><span className="capability-icon"><Icon name="command" size={14} /></span><span><strong>{name}</strong><small>{source} · {description}</small></span></button>)}
      </aside>
      <section className="capability-main">
        <header className="capability-head"><div><span className="eyebrow">Reusable workflow</span><h2>{current[0]}</h2><p>{current[1]}</p></div><div className="capability-head__actions"><button className="studio-button" type="button" onClick={() => onAction('Command duplicated in preview')}>Duplicate</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Command saved in preview')}><Icon name="check" size={13} /> Save</button></div></header>
        <div className="capability-content"><div className="command-form-grid"><label className="capability-field"><span>Instruction</span><textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} /></label><label className="capability-field"><span>Scope</span><select defaultValue="Project"><option>Project</option><option>User</option><option>Team</option></select></label><label className="capability-field"><span>Invocation</span><select defaultValue="Slash command"><option>Slash command</option><option>Agent suggestion</option><option>Automatic</option></select></label><label className="capability-field"><span>Mode</span><select defaultValue="Agent"><option>Agent</option><option>Plan</option><option>Ask</option><option>Debug</option></select></label></div><div className="command-variable-row"><span>{'{{workspace}}'}</span><span>{'{{diff}}'}</span><span>{'{{rules}}'}</span><span>{'{{context}}'}</span></div><section className="surface-block"><div className="surface-block__heading"><span>Execution preview</span><span className="mono-text">no runtime call</span></div><pre className="code-preview">{current[0] + ' ' + instruction}</pre></section><div className="platform-actions"><button className="studio-button studio-button--active" type="button" onClick={() => onAction(current[0] + ' tested in preview')}><Icon name="play" size={13} /> Test command</button><button className="studio-button" type="button" onClick={() => onAction('Keyboard shortcut configured in preview')}><Icon name="command" size={13} /> Shortcut</button></div></div>
      </section>
    </div>
  )
}
