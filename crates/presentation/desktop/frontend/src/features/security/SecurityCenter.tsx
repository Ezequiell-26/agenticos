import { useMemo, useState, type ReactNode } from 'react'
import Icon from '../../components/Icon'

type SecurityTab = 'Overview' | 'Policies' | 'Audit' | 'Sessions' | 'Recovery'

const policyRows = [
  ['Fail-closed execution', 'Sensitive actions stop until approved', true],
  ['Secret redaction', 'Credential values never render in presentation state', true],
  ['Workspace sandbox', 'File and shell scope follows the selected workspace', true],
  ['Network guard', 'Outbound requests require an explicit policy state', true],
  ['Destructive confirmation', 'Delete/reset/force operations require a human step', true],
]

const auditRows = [
  ['16:31:02', 'policy.check', 'pass', 'write policy evaluated'],
  ['16:31:04', 'credential.access', 'blocked', 'secret value remained hidden'],
  ['16:31:06', 'tool.approval', 'approved', 'terminal execution request'],
  ['16:31:09', 'workspace.scope', 'pass', 'path remained inside workspace'],
  ['16:31:12', 'handoff', 'pass', 'artifact package sealed'],
]

const sessions = [
  ['Current desktop', 'Local', 'Active now', 'Trusted'],
  ['Automation preview', 'Workflow', '8m ago', 'Isolated'],
  ['Browser preview', 'Web session', '14m ago', 'Ephemeral'],
]

export default function SecurityCenter({ onAction }: { onAction: (message: string) => void }) {
  const [tab, setTab] = useState<SecurityTab>('Overview')
  const [policies, setPolicies] = useState(() => new Set(policyRows.filter((item) => item[2]).map((item) => item[0])))

  const enabled = useMemo(() => policies.size, [policies])

  function toggle(name: string) {
    setPolicies((current) => {
      const next = new Set(current)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
    onAction(name + ' policy toggled in preview')
  }

  return (
    <div className="security-center">
      <div className="security-center__summary">
        <div className="security-score"><div className="security-shield"><Icon name="shield" size={26} /></div><div><span className="eyebrow">Workspace status</span><strong>Protected</strong><small>{enabled}/{policyRows.length} guardrails enabled in preview</small></div></div>
        <div className="security-summary-grid"><Metric label="Secrets exposed" value="0" /><Metric label="Blocked events" value="3" /><Metric label="Trusted sessions" value="1" /><Metric label="Last check" value="12s" /></div>
      </div>

      <div className="security-center__tabs" role="tablist" aria-label="Security center">
        {(['Overview', 'Policies', 'Audit', 'Sessions', 'Recovery'] as SecurityTab[]).map((item) => <button type="button" key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'security-tab security-tab--active' : 'security-tab'} onClick={() => setTab(item)}>{item}</button>)}
      </div>

      <div className="security-center__body">
        {tab === 'Overview' && <div className="security-overview"><div className="security-overview-grid"><Panel title="Execution boundary"><Row label="File scope" value="Workspace only" /><Row label="Network" value="Policy + confirm" /><Row label="Destructive" value="Blocked by default" /><Row label="Credentials" value="External boundary" /></Panel><Panel title="Current posture"><div className="security-posture"><div className="security-posture-bar"><span style={{ width: '94%' }} /></div><div><span>Policy coverage</span><strong>94%</strong></div></div><div className="callout"><Icon name="shield" size={13} /><span>Security values in this screen are visual preview state; runtime authorization is enforced outside the React layer.</span></div></Panel></div><Panel title="Protected operations"><div className="protected-operation-grid"><span><Icon name="check" size={12} />Read-only inspection</span><span><Icon name="check" size={12} />Scoped file changes</span><span><Icon name="check" size={12} />Approval-gated tools</span><span><Icon name="check" size={12} />Redacted credentials</span></div></Panel></div>}

        {tab === 'Policies' && <div className="security-policy-list">{policyRows.map(([name, detail]) => <div className="security-policy-row" key={name}><div><strong>{name}</strong><span>{detail}</span></div><button className={policies.has(name) ? 'switch switch--on' : 'switch'} type="button" role="switch" aria-checked={policies.has(name)} onClick={() => toggle(name)}><span /></button></div>)}</div>}

        {tab === 'Audit' && <div className="security-audit"><div className="security-audit-head"><span>Event time</span><span>Event</span><span>Result</span><span>Detail</span></div>{auditRows.map(([time, event, result, detail]) => <div className="security-audit-row" key={time + event}><span>{time}</span><strong>{event}</strong><span className={result === 'pass' || result === 'approved' ? 'state-pill state-pill--completed' : 'state-pill state-pill--pending'}>{result}</span><span>{detail}</span></div>)}</div>}

        {tab === 'Sessions' && <div className="security-session-list">{sessions.map(([name, type, age, state]) => <div className="security-session-row" key={name}><div className="security-session-icon"><Icon name={type === 'Web session' ? 'globe' : 'bot'} size={14} /></div><div><strong>{name}</strong><span>{type} · {age}</span></div><span className="state-pill state-pill--completed">{state}</span><button className="studio-button" type="button" onClick={() => onAction(name + ' session controls opened in preview')}>Manage</button></div>)}</div>}

        {tab === 'Recovery' && <div className="security-recovery-grid"><Panel title="Recovery checkpoint"><div className="recovery-card"><span className="eyebrow">Latest safe point</span><strong>CP-028 · 31m ago</strong><p>Restores presentation-local state and the selected workspace snapshot.</p><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Recovery preview opened')}>Open recovery</button></div></Panel><Panel title="Emergency controls"><div className="emergency-list"><button type="button" onClick={() => onAction('All sessions revoke staged in preview')}><Icon name="shield" size={13} /> Revoke all sessions</button><button type="button" onClick={() => onAction('Local credentials purge staged in preview')}><Icon name="history" size={13} /> Purge local credential metadata</button><button type="button" onClick={() => onAction('Workspace lock staged in preview')}><Icon name="shield" size={13} /> Lock workspace</button></div></Panel></div>}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="security-metric"><span>{label}</span><strong>{value}</strong></div>
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="security-row"><span>{label}</span><strong>{value}</strong></div>
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="security-panel"><div className="security-panel__head"><strong>{title}</strong><span className="mono-text">preview</span></div><div className="security-panel__body">{children}</div></section>
}
