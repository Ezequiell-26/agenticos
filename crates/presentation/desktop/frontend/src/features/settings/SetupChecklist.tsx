import { useEffect, useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { runtime } from '../../services/runtime'

type SetupItem = {
  id: string
  title: string
  detail: string
  state: 'Ready' | 'Needs setup' | 'Optional' | 'Checking'
}

const initialItems: SetupItem[] = [
  { id: 'workspace', title: 'Workspace', detail: 'Checking configured projects…', state: 'Checking' },
  { id: 'runtime', title: 'Runtime', detail: 'Checking backend readiness…', state: 'Checking' },
  { id: 'provider', title: 'Provider', detail: 'Checking configured model providers…', state: 'Checking' },
  { id: 'permissions', title: 'Permissions', detail: 'Checking effective capability grants…', state: 'Checking' },
  { id: 'browser', title: 'Browser', detail: 'Optional browser automation backend.', state: 'Optional' },
  { id: 'mcp', title: 'MCP', detail: 'Checking optional external tools and resources…', state: 'Checking' },
  { id: 'voice', title: 'Voice', detail: 'Optional TTS/STT and media configuration.', state: 'Optional' },
]

export default function SetupChecklist() {
  const [items, setItems] = useState(initialItems)
  const [syncing, setSyncing] = useState(true)

  useEffect(() => {
    let cancelled = false

    const sync = async () => {
      const [workspace, ready, health, providers, capabilities, mcp] = await Promise.allSettled([
        runtime.projects.list(),
        runtime.health.ready(),
        runtime.health.get(),
        runtime.providers.list(),
        runtime.capabilities.list(),
        runtime.mcp.list(),
      ])

      if (cancelled) return

      setItems((current) => current.map((item) => {
        switch (item.id) {
          case 'workspace': {
            if (workspace.status === 'fulfilled') {
              const count = workspace.value.length
              return {
                ...item,
                state: count > 0 ? 'Ready' : 'Needs setup',
                detail: count > 0 ? `${count} configured project${count === 1 ? '' : 's'} available.` : 'Register a project/workspace to start using persistent project context.',
              }
            }
            return { ...item, state: 'Needs setup', detail: 'Workspace metadata is unavailable from the runtime.' }
          }
          case 'runtime': {
            const readyOk = ready.status === 'fulfilled'
            const healthyOk = health.status === 'fulfilled'
            return {
              ...item,
              state: readyOk && healthyOk ? 'Ready' : 'Needs setup',
              detail: readyOk && healthyOk
                ? 'Backend health and readiness checks are passing.'
                : 'Backend is not fully ready; start or repair the runtime service.',
            }
          }
          case 'provider': {
            if (providers.status === 'fulfilled') {
              const configured = providers.value.filter((provider) => provider.configured)
              return {
                ...item,
                state: configured.length > 0 ? 'Ready' : 'Needs setup',
                detail: configured.length > 0
                  ? `${configured.length} configured model provider${configured.length === 1 ? '' : 's'} available.`
                  : 'Connect at least one model provider before sending agent requests.',
              }
            }
            return { ...item, state: 'Needs setup', detail: 'Provider registry could not be read from the runtime.' }
          }
          case 'permissions': {
            if (capabilities.status === 'fulfilled') {
              const grants = capabilities.value.length
              return {
                ...item,
                state: grants > 0 ? 'Ready' : 'Needs setup',
                detail: grants > 0
                  ? `${grants} capability grant${grants === 1 ? '' : 's'} currently available.`
                  : 'No runtime capability grants are available; review execution permissions.',
              }
            }
            return { ...item, state: 'Needs setup', detail: 'Capability state could not be read from the runtime.' }
          }
          case 'mcp': {
            if (mcp.status === 'fulfilled') {
              const enabled = mcp.value.filter((server) => server.enabled === true).length
              return {
                ...item,
                state: enabled > 0 ? 'Ready' : 'Optional',
                detail: enabled > 0
                  ? `${enabled} enabled MCP server${enabled === 1 ? '' : 's'} available.`
                  : 'No MCP server is enabled; this integration remains optional.',
              }
            }
            return { ...item, state: 'Optional', detail: 'MCP status is unavailable; this integration remains optional.' }
          }
          default:
            return item
        }
      }))

      setSyncing(false)
    }

    void sync().catch(() => {
      if (cancelled) return
      setItems((current) => current.map((item) => item.state === 'Checking'
        ? { ...item, state: item.id === 'mcp' ? 'Optional' : item.id === 'browser' || item.id === 'voice' ? 'Optional' : 'Needs setup', detail: 'Runtime setup state could not be verified.' }
        : item))
      setSyncing(false)
    })

    return () => { cancelled = true }
  }, [])

  const required = useMemo(() => items.filter((item) => item.state !== 'Optional').length, [items])
  const completeRequired = useMemo(() => items.filter((item) => item.state === 'Ready').length, [items])
  const ready = useMemo(() => items.filter((item) => item.state === 'Ready').length, [items])
  const percent = required === 0 ? 100 : Math.round((completeRequired / required) * 100)

  return (
    <div className="setup-checklist">
      <div className="setup-checklist__summary">
        <div><span>Setup</span><strong>{syncing ? '—' : percent + '%'}</strong></div>
        <div><span>Ready</span><strong>{ready}</strong></div>
        <div><span>Required</span><strong>{required}</strong></div>
      </div>
      <div className="setup-checklist__progress"><span style={{ width: percent + '%' }} /></div>
      <div className="setup-checklist__list">
        {items.map((item) => (
          <div className="setup-checklist__row" key={item.id}>
            <span className={item.state === 'Ready' ? 'setup-check setup-check--ready' : 'setup-check'}>
              {item.state === 'Ready' ? <Icon name="check" size={11} /> : item.state === 'Checking' ? <span className="setup-check__pulse" /> : <span />}
            </span>
            <div><strong>{item.title}</strong><small>{item.detail}</small></div>
            <span className={
              item.state === 'Ready'
                ? 'state-pill state-pill--completed'
                : item.state === 'Needs setup'
                  ? 'state-pill state-pill--pending'
                  : 'state-pill'
            }>
              {item.state}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
