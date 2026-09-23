export type SettingsScope = 'global' | 'project' | 'session' | 'agent'

export interface SettingsStore<T extends object> {
  version: number
  activeScope: SettingsScope
  scopes: Record<SettingsScope, T>
  history: Array<{
    id: string
    at: number
    scope: SettingsScope
    label: string
    snapshot: T
  }>
}

const STORAGE_VERSION = 1
const MAX_HISTORY = 20

function emptyScopes<T extends object>(defaults: T): Record<SettingsScope, T> {
  return {
    global: { ...defaults },
    project: { ...defaults },
    session: { ...defaults },
    agent: { ...defaults },
  }
}

export function createSettingsStore<T extends object>(defaults: T): SettingsStore<T> {
  return {
    version: STORAGE_VERSION,
    activeScope: 'project',
    scopes: emptyScopes(defaults),
    history: [],
  }
}

export function readSettingsStore<T extends object>(storageKey: string, defaults: T): SettingsStore<T> {
  const initial = createSettingsStore(defaults)
  if (typeof window === 'undefined') return initial

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return initial

    const parsed = JSON.parse(raw) as Partial<SettingsStore<T>>
    const scopes = parsed.scopes ?? {}
    const normalize = (scope: SettingsScope): T => ({ ...defaults, ...(scopes[scope] ?? {}) })

    return {
      version: STORAGE_VERSION,
      activeScope: parsed.activeScope ?? 'project',
      scopes: {
        global: normalize('global'),
        project: normalize('project'),
        session: normalize('session'),
        agent: normalize('agent'),
      },
      history: Array.isArray(parsed.history) ? parsed.history.slice(-MAX_HISTORY) : [],
    }
  } catch {
    return initial
  }
}

export function saveSettingsStore<T extends object>(
  storageKey: string,
  store: SettingsStore<T>,
  label = 'Configuration snapshot',
): SettingsStore<T> {
  const snapshot = { ...store.scopes[store.activeScope] }
  const historyEntry = {
    id: `settings-${Date.now()}`,
    at: Date.now(),
    scope: store.activeScope,
    label,
    snapshot,
  }
  const next: SettingsStore<T> = {
    ...store,
    version: STORAGE_VERSION,
    history: [...store.history, historyEntry].slice(-MAX_HISTORY),
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next))
  } catch {
    // Local persistence is optional in preview/embedded desktop contexts.
  }

  return next
}

export function exportSettingsStore<T extends object>(store: SettingsStore<T>) {
  return JSON.stringify(store, null, 2)
}

export function importSettingsStore<T extends object>(
  serialized: string,
  defaults: T,
): SettingsStore<T> {
  const parsed = JSON.parse(serialized) as Partial<SettingsStore<T>>
  const initial = createSettingsStore(defaults)
  const scopes = parsed.scopes ?? {}
  const normalize = (scope: SettingsScope): T => ({ ...defaults, ...(scopes[scope] ?? {}) })

  return {
    version: STORAGE_VERSION,
    activeScope: parsed.activeScope ?? initial.activeScope,
    scopes: {
      global: normalize('global'),
      project: normalize('project'),
      session: normalize('session'),
      agent: normalize('agent'),
    },
    history: Array.isArray(parsed.history) ? parsed.history.slice(-MAX_HISTORY) : [],
  }
}

export function resolveSettingsScope<T extends object>(
  store: SettingsStore<T>,
  scope: SettingsScope,
): T {
  return { ...store.scopes[scope] }
}

export function appendSettingsHistory<T extends object>(
  store: SettingsStore<T>,
  scope: SettingsScope,
  label: string,
  snapshot: T,
): SettingsStore<T> {
  return {
    ...store,
    history: [
      ...store.history,
      { id: `settings-${Date.now()}`, at: Date.now(), scope, label, snapshot: { ...snapshot } },
    ].slice(-MAX_HISTORY),
  }
}

export function getSettingsHistory<T extends object>(store: SettingsStore<T>) {
  return store.history.slice().reverse()
}
