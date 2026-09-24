import React from 'react'
import Icon from '../../components/Icon'
import { runtime } from '../../services/runtime'
import type { RuntimeApiRecord } from '../../types/runtime'
import { Panel, Shell, Toast } from './PlatformPrimitives'

type PermissionRow = [string, string, string, string]
const fallbackRows: PermissionRow[] = [
  ['Builder', 'Files', 'Read / Write', 'Workspace'],
  ['Builder', 'Terminal', 'Preview only', 'Workspace'],
  ['Reviewer', 'Files', 'Read only', 'Workspace'],
  ['Researcher', 'Network', 'Request', 'Session'],
  ['Release Bot', 'Artifacts', 'Create', 'Release'],
]

function mapGrant(grant: RuntimeApiRecord): PermissionRow {
  const actor = typeof grant.agent_id === 'string' ? grant.agent_id : typeof grant.principal === 'string' ? grant.principal : 'Runtime'
  const resource = typeof grant.resource === 'string' ? grant.resource : 'Capability'
  const operation = typeof grant.permission === 'string' ? grant.permission : typeof grant.action === 'string' ? grant.action : 'Granted'
  const scope = typeof grant.scope === 'string' ? grant.scope : typeof grant.capability_type === 'string' ? grant.capability_type : 'Runtime'
  return [actor, resource, operation, scope]
}

export function PermissionsMatrix({ onAction }: { onAction: (message: string) => void }) {
  const [rows, setRows] = React.useState<PermissionRow[]>(fallbackRows)
  const [filter, setFilter] = React.useState('')
  const [syncing, setSyncing] = React.useState(true)

  const refresh = React.useCallback(async () => {
    setSyncing(true)
    try {
      const grants = await runtime.capabilities.list()
      if (grants.length > 0) setRows(grants.map(mapGrant))
      onAction('Capability grants refreshed from runtime')
    } catch (error) {
      onAction(error instanceof Error ? error.message : 'Capability refresh failed')
    } finally {
      setSyncing(false)
    }
  }, [onAction])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const visible = rows.filter((row) => row.join(' ').toLowerCase().includes(filter.toLowerCase()))

  async function issueGrant() {
    const grantId = window.prompt('Grant ID', 'grant-' + Date.now())?.trim()
    const capabilityType = window.prompt('Capability type', 'tool')?.trim()
    const resource = window.prompt('Resource', 'filesystem')?.trim()
    const permission = window.prompt('Permission', 'read')?.trim()
    if (!grantId || !capabilityType || !resource || !permission) return
    try {
      await runtime.capabilities.issue({ grant_id: grantId, capability_type: capabilityType, resource, permission })
      await refresh()
      onAction(grantId + ' issued in runtime')
    } catch (error) {
      onAction(error instanceof Error ? error.message : 'Capability issue failed')
    }
  }

  async function revokeGrant() {
    const grantId = window.prompt('Grant ID to revoke')?.trim()
    if (!grantId) return
    try {
      await runtime.capabilities.revoke(grantId)
      await refresh()
      onAction(grantId + ' revoked in runtime')
    } catch (error) {
      onAction(error instanceof Error ? error.message : 'Capability revoke failed')
    }
  }

  return (
    <Shell>
      <header className="platform-header">
        <div>
          <span className="eyebrow">Authorization model · {syncing ? 'syncing' : 'runtime'}</span>
          <h1>Permissions Matrix</h1>
          <p>Make agent capabilities explicit by actor, resource, operation and scope. Runtime enforcement remains the authority.</p>
        </div>
        <div className="platform-actions">
          <button className="studio-button" type="button" disabled={syncing} onClick={() => void refresh()}><Icon name="refresh" size={13} /> Refresh</button>
          <span className="state-pill state-pill--completed">Fail-closed</span>
        </div>
      </header>

      <div className="platform-grid platform-grid--2">
        <Panel title="Permission model">
          <div className="strategy-stack">
            <div><span>Principal</span><strong>Agent / subagent</strong></div>
            <div><span>Resource</span><strong>Tool / workspace / network</strong></div>
            <div><span>Action</span><strong>Read / write / execute / request</strong></div>
            <div><span>Scope</span><strong>Workspace → session → task</strong></div>
          </div>
        </Panel>
        <Panel title="Controls">
          <input className="global-search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter permissions…" />
          <div className="platform-actions">
            <button className="studio-button" type="button" onClick={() => onAction('Permission model uses runtime capability grants')}>Inspect</button>
            <button className="studio-button" type="button" onClick={() => void revokeGrant()}>Revoke grant</button>
            <button className="studio-button studio-button--active" type="button" onClick={() => void issueGrant()}>Issue grant</button>
          </div>
        </Panel>
      </div>

      <Panel title="Effective permissions">
        <div className="permission-table">
          <div className="permission-head"><span>Actor</span><span>Resource</span><span>Operation</span><span>Scope</span></div>
          {visible.map((row) => (
            <button type="button" className="permission-row" key={row.join('-')} onClick={() => onAction(row.join(' · ') + ' selected')}>
              {row.map((cell, index) => <span key={index}>{cell}</span>)}
            </button>
          ))}
          {visible.length === 0 && <div className="review-empty">No matching runtime grants.</div>}
        </div>
      </Panel>
      <Toast message="" />
    </Shell>
  )
}
