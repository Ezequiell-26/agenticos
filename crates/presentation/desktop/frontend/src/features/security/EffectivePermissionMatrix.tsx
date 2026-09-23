import Icon from '../../components/Icon'

export type PermissionDecision = 'allow' | 'ask' | 'deny'

export interface PermissionRule {
  resource: string
  action: string
  decision: PermissionDecision
  reason: string
}

interface EffectivePermissionMatrixProps {
  executionMode: string
  workspaceOnly: boolean
  networkAccess: string
  terminalSandbox: boolean
  guardrails: boolean
}

export default function EffectivePermissionMatrix({
  executionMode,
  workspaceOnly,
  networkAccess,
  terminalSandbox,
  guardrails,
}: EffectivePermissionMatrixProps) {
  const requestApproval = executionMode !== 'Always proceed'
  const networkDecision: PermissionDecision =
    networkAccess === 'Blocked'
      ? 'deny'
      : networkAccess === 'Open'
        ? (requestApproval ? 'ask' : 'allow')
        : 'ask'

  const rules: PermissionRule[] = [
    {
      resource: 'Workspace files',
      action: 'read / inspect',
      decision: 'allow',
      reason: 'Read access is available inside the active project scope.',
    },
    {
      resource: 'Workspace files',
      action: 'write / edit',
      decision: requestApproval ? 'ask' : 'allow',
      reason: requestApproval ? 'Change review is enabled for writes.' : 'Execution mode permits direct edits.',
    },
    {
      resource: 'External files',
      action: 'read / write',
      decision: workspaceOnly ? 'deny' : 'ask',
      reason: workspaceOnly ? 'Workspace boundary is enabled.' : 'External access requires explicit scope approval.',
    },
    {
      resource: 'Terminal',
      action: 'execute',
      decision: terminalSandbox ? (requestApproval ? 'ask' : 'allow') : 'ask',
      reason: terminalSandbox ? 'Sandbox boundary is enabled.' : 'Unsandboxed execution requires review.',
    },
    {
      resource: 'Network',
      action: 'request',
      decision: networkDecision,
      reason: networkAccess === 'Guarded' ? 'Network guard evaluates the destination before execution.' : `Network policy: ${networkAccess}.`,
    },
    {
      resource: 'Destructive actions',
      action: 'delete / force',
      decision: guardrails ? 'deny' : 'ask',
      reason: guardrails ? 'Guardrails block destructive operations by default.' : 'Guardrails are disabled; explicit approval is still required.',
    },
    {
      resource: 'Git',
      action: 'commit / branch',
      decision: requestApproval ? 'ask' : 'allow',
      reason: 'Version-control mutations are separate from ordinary file edits.',
    },
    {
      resource: 'MCP / external tools',
      action: 'invoke',
      decision: requestApproval ? 'ask' : 'allow',
      reason: 'External capability boundaries use the active approval mode.',
    },
  ]

  const counts = rules.reduce(
    (acc, rule) => {
      acc[rule.decision] += 1
      return acc
    },
    { allow: 0, ask: 0, deny: 0 } as Record<PermissionDecision, number>,
  )

  return (
    <div className="permission-matrix">
      <div className="permission-matrix__summary">
        <div className="permission-summary-card">
          <span>Allow</span>
          <strong>{counts.allow}</strong>
        </div>
        <div className="permission-summary-card">
          <span>Ask</span>
          <strong>{counts.ask}</strong>
        </div>
        <div className="permission-summary-card">
          <span>Deny</span>
          <strong>{counts.deny}</strong>
        </div>
      </div>

      <div className="permission-matrix__table">
        <div className="permission-matrix__head">
          <span>Resource</span>
          <span>Action</span>
          <span>Decision</span>
          <span>Why</span>
        </div>
        {rules.map((rule) => (
          <div className="permission-matrix__row" key={rule.resource + rule.action}>
            <strong>{rule.resource}</strong>
            <span>{rule.action}</span>
            <span className={`permission-badge permission-badge--${rule.decision}`}>
              <Icon name={rule.decision === 'allow' ? 'check' : rule.decision === 'ask' ? 'alert' : 'lock'} size={11} />
              {rule.decision}
            </span>
            <small>{rule.reason}</small>
          </div>
        ))}
      </div>
      <div className="control-info-callout">
        <span><Icon name="shield" size={15} /></span>
        <div>
          <strong>Effective policy preview</strong>
          <small>This matrix is presentation-only until the runtime policy evaluator is connected. The frontend never substitutes its result for runtime enforcement.</small>
        </div>
      </div>
    </div>
  )
}
