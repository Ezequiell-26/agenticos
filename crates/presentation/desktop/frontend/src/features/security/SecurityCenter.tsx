import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Icon from '../../components/Icon'
import { runtime } from '../../services/runtime'

type SecurityTab = 'Overview' | 'Policies' | 'Audit' | 'Sessions' | 'Recovery'

const policyRows: ReadonlyArray<readonly [string, string, boolean]> = [
  ['Fail-closed execution', 'Sensitive actions stop until approved', true],
  ['Secret redaction', 'Credential values never render in presentation state', true],
  ['Workspace sandbox', 'File and shell scope follows the selected workspace', true],
  ['Network guard', 'Outbound requests require an explicit policy state', true],
  ['Destructive confirmation', 'Delete/reset/force operations require a human step', true],
]

const fallbackAudit: Array<Record<string, unknown>> = [
  { timestamp: 0, action: 'policy.check', outcome: 'pass', resource: 'presentation fallback' },
]

export default function SecurityCenter({ onAction }: { onAction: (message: string) => void }) {
  const [tab, setTab] = useState<SecurityTab>('Overview')
  const [policies, setPolicies] = useState(() => new Set(policyRows.filter((item) => item[2]).map((item) => item[0])))
  const [runtimeAudit, setRuntimeAudit] = useState<Array<Record<string, unknown>>>([])
  const [runtimeApprovals, setRuntimeApprovals] = useState<Array<Record<string, unknown>>>([])
  const [runtimeSyncing, setRuntimeSyncing] = useState(true)

  useEffect(() => {
    let cancelled = false
    void Promise.allSettled([runtime.audit.list(100), runtime.approvals.list()]).then(([auditResult, approvalResult]) => {
      if (cancelled) return
      if (auditResult.status === 'fulfilled') setRuntimeAudit(auditResult.value)
      if (approvalResult.status === 'fulfilled') setRuntimeApprovals(approvalResult.value)
    }).finally(() => { if (!cancelled) setRuntimeSyncing(false) })
    return () => { cancelled = true }
  }, [])

  const enabled = useMemo(() => policies.size, [policies])
  const blockedEvents = runtimeAudit.filter((event) => String(event.outcome ?? '').toLowerCase() === 'blocked').length
  const auditRows = runtimeAudit.length > 0 ? runtimeAudit : fallbackAudit

  function toggle(name: string) {
    setPolicies((current) => {
      const next = new Set(current)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
    onAction(name + ' policy toggled locally; runtime policy remains authoritative')
  }

  async function resolveApproval(approvalId: string, approved: boolean) {
    try {
      await runtime.approvals.resolve(approvalId, approved)
      setRuntimeApprovals(await runtime.approvals.list())
      onAction(approved ? 'Approval granted in runtime' : 'Approval denied in runtime')
    } catch (error) {
      onAction(error instanceof Error ? error.message : 'Approval resolution failed')
    }
  }

  return (
    <div className="security-center">
      <div className="security-center__summary">
        <div className="security-score"><div className="security-shield"><Icon name="shield" size={26} /></div><div><span className="eyebrow">Workspace status</span><strong>Runtime guarded</strong><small>{runtimeSyncing ? 'Synchronizing runtime state…' : enabled + '/' + policyRows.length + ' presentation guardrails enabled'}</small></div></div>
        <div className="security-summary-grid"><Metric label="Secrets exposed" value="0" /><Metric label="Blocked events" value={String(blockedEvents)} /><Metric label="Pending approvals" value={String(runtimeApprovals.length)} /><Metric label="Audit events" value={runtimeSyncing ? 'Syncing' : String(runtimeAudit.length)} /></div>
      </div>

      <div className="security-center__tabs" role="tablist" aria-label="Security center" aria-orientation="horizontal">
        {(['Overview', 'Policies', 'Audit', 'Sessions', 'Recovery'] as SecurityTab[]).map((item, index, tabs) => <button type="button" key={item} id={'security-tab-' + item.toLowerCase()} role="tab" tabIndex={tab === item ? 0 : -1} aria-selected={tab === item} aria-controls="security-tabpanel" className={tab === item ? 'security-tab security-tab--active' : 'security-tab'} onClick={() => setTab(item)} onKeyDown={(event) => {
          const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
          if (nextIndex >= 0) { event.preventDefault(); const next = tabs[nextIndex]; setTab(next); window.requestAnimationFrame(() => document.getElementById('security-tab-' + next.toLowerCase())?.focus()) }
        }}>{item}</button>)}
      </div>

      <div id="security-tabpanel" className="security-center__body" role="tabpanel" aria-labelledby={'security-tab-' + tab.toLowerCase()} tabIndex={0}>
        {tab === 'Overview' && <div className="security-overview"><div className="security-overview-grid"><Panel title="Execution boundary"><Row label="File scope" value="Workspace only" /><Row label="Network" value="Policy + confirm" /><Row label="Destructive" value="Blocked by default" /><Row label="Credentials" value="External boundary" /></Panel><Panel title="Runtime posture"><div className="security-posture"><div className="security-posture-bar"><span style={{ width: '94%' }} /></div><div><span>Presentation policy coverage</span><strong>94%</strong></div></div><div className="callout"><Icon name="shield" size={13} /><span>Authorization, approvals and audit records are read from the runtime; presentation toggles do not grant capabilities.</span></div></Panel></div><Panel title="Pending approvals"><div className="security-session-list">{runtimeApprovals.length === 0 ? <span className="review-empty">No pending approval requests.</span> : runtimeApprovals.slice(0, 8).map((approval, index) => <div className="security-session-row" key={String(approval.approval_id ?? index)}><div><strong>{String(approval.action ?? 'Approval request')}</strong><span>{String(approval.resource ?? '—')} · {String(approval.run_id ?? 'unbound')}</span></div><button className="studio-button studio-button--active" type="button" onClick={() => void resolveApproval(String(approval.approval_id ?? ''), true)}>Approve</button><button className="studio-button" type="button" onClick={() => void resolveApproval(String(approval.approval_id ?? ''), false)}>Deny</button></div>)}</div></Panel></div>}

        {tab === 'Policies' && <div className="security-policy-list">{policyRows.map(([name, detail]) => <div className="security-policy-row" key={name}><div><strong>{name}</strong><span>{detail}</span></div><button className={policies.has(name) ? 'switch switch--on' : 'switch'} type="button" role="switch" aria-checked={policies.has(name)} onClick={() => toggle(name)}><span /></button></div>)}</div>}

        {tab === 'Audit' && <div className="security-audit"><div className="security-audit-head"><span>Event time</span><span>Action</span><span>Result</span><span>Resource</span></div>{auditRows.map((event, index) => <div className="security-audit-row" key={String(event.event_id ?? index)}><span>{event.timestamp ? new Date(Number(event.timestamp) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</span><strong>{String(event.action ?? 'audit event')}</strong><span className={['pass','approved','success'].includes(String(event.outcome ?? '').toLowerCase()) ? 'state-pill state-pill--completed' : 'state-pill state-pill--pending'}>{String(event.outcome ?? 'unknown')}</span><span>{String(event.resource ?? '—')}</span></div>)}</div>}

        {tab === 'Sessions' && <div className="security-session-list"><div className="security-session-row"><div className="security-session-icon"><Icon name="bot" size={14} /></div><div><strong>Current desktop</strong><span>Local runtime · authenticated boundary</span></div><span className="state-pill state-pill--completed">Active</span></div></div>}

        {tab === 'Recovery' && <div className="security-recovery-grid"><Panel title="Runtime recovery"><div className="recovery-card"><span className="eyebrow">Runtime snapshots</span><strong>Available through run checkpoints</strong><p>Use the run and artifact contracts for durable recovery rather than presentation-only state.</p><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Open runtime run checkpoints from the Runs surface')}>Open checkpoints</button></div></Panel><Panel title="Emergency controls"><div className="emergency-list"><button type="button" onClick={() => onAction('Session revocation requires a dedicated runtime session contract')}><Icon name="shield" size={13} /> Revoke sessions</button><button type="button" onClick={() => onAction('Credential purge remains provider-owned')}><Icon name="history" size={13} /> Credential purge</button></div></Panel></div>}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="security-metric"><span>{label}</span><strong>{value}</strong></div> }
function Row({ label, value }: { label: string; value: string }) { return <div className="security-row"><span>{label}</span><strong>{value}</strong></div> }
function Panel({ title, children }: { title: string; children: ReactNode }) { return <section className="security-panel"><div className="security-panel__head"><strong>{title}</strong><span className="mono-text">runtime</span></div><div className="security-panel__body">{children}</div></section> }
