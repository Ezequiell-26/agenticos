import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'

type Scope = 'Global' | 'Project' | 'Agent' | 'Session'
interface SettingCandidate {
  id: string
  label: string
  global: string
  project: string
  agent: string
  session: string
}

const candidates: SettingCandidate[] = [
  { id: 'model', label: 'Model', global: 'Auto route', project: 'Qwen3 Coder', agent: 'Reviewer', session: 'Inherited' },
  { id: 'approval', label: 'Execution approval', global: 'Request review', project: 'Request review', agent: 'Allowlist', session: 'Inherited' },
  { id: 'browser', label: 'Browser backend', global: 'Auto', project: 'Chrome DevTools', agent: 'Inherited', session: 'Local Chrome' },
  { id: 'reasoning', label: 'Reasoning', global: 'Medium', project: 'High', agent: 'High', session: 'Inherited' },
]

export default function ScopeResolverPreview() {
  const [scope, setScope] = useState<Scope>('Project')
  const [selected, setSelected] = useState(candidates[0].id)

  const item = useMemo(() => candidates.find((candidate) => candidate.id === selected) ?? candidates[0], [selected])
  const value = item[scope.toLowerCase() as 'global' | 'project' | 'agent' | 'session']
  const source = value === 'Inherited' ? (scope === 'Session' ? 'Agent → Project → Global' : 'Project → Global') : scope

  return (
    <div className="scope-resolver">
      <div className="scope-resolver__tabs">
        {(['Global', 'Project', 'Agent', 'Session'] as Scope[]).map((itemScope) => <button type="button" key={itemScope} className={scope === itemScope ? 'customize-filter customize-filter--active' : 'customize-filter'} onClick={() => setScope(itemScope)}>{itemScope}</button>)}
      </div>
      <div className="scope-resolver__grid">
        <div className="scope-resolver__fields">
          {candidates.map((candidate) => <button type="button" key={candidate.id} className={selected === candidate.id ? 'scope-setting scope-setting--active' : 'scope-setting'} onClick={() => setSelected(candidate.id)}><span>{candidate.label}</span><strong>{candidate[scope.toLowerCase() as 'global' | 'project' | 'agent' | 'session']}</strong></button>)}
        </div>
        <div className="scope-resolver__effective">
          <span className="eyebrow">Effective value</span>
          <h3>{item.label}</h3>
          <strong>{value}</strong>
          <div><Icon name="layers" size={13} /><span>Resolved from {source}</span></div>
          <small>Preview only. Runtime-defined precedence remains authoritative when connected.</small>
        </div>
      </div>
    </div>
  )
}
