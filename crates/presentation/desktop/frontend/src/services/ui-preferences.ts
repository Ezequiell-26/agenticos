export const UI_PREFERENCES_STORAGE_KEY = 'agenticos.ui.hermes-settings-v2'

export interface UiLayoutPreferences {
  leftSidebarVisible: boolean
  agentInspectorVisible: boolean
  bottomDockVisible: boolean
  activityRailCompact: boolean
  statusBarVisible: boolean
  showTooltips: boolean
  hoverPreview: boolean
  notificationPosition: string
  sidebarWidth: number
  inspectorWidth: number
}

export const defaultUiLayoutPreferences: UiLayoutPreferences = {
  leftSidebarVisible: true,
  agentInspectorVisible: true,
  bottomDockVisible: false,
  activityRailCompact: true,
  statusBarVisible: true,
  showTooltips: true,
  hoverPreview: true,
  notificationPosition: 'top-right',
  sidebarWidth: 270,
  inspectorWidth: 320,
}

export function readUiLayoutPreferences(): UiLayoutPreferences {
  try {
    const raw = window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY)
    if (!raw) return defaultUiLayoutPreferences
    const parsed = JSON.parse(raw) as { settings?: Partial<UiLayoutPreferences> }
    return { ...defaultUiLayoutPreferences, ...(parsed.settings ?? {}) }
  } catch {
    return defaultUiLayoutPreferences
  }
}

export function applyUiLayoutPreferences(preferences: UiLayoutPreferences) {
  const root = document.documentElement
  root.dataset.agenticosSidebar = preferences.leftSidebarVisible ? 'visible' : 'hidden'
  root.dataset.agenticosInspector = preferences.agentInspectorVisible ? 'visible' : 'hidden'
  root.dataset.agenticosDock = preferences.bottomDockVisible ? 'visible' : 'hidden'
  root.dataset.agenticosRail = preferences.activityRailCompact ? 'compact' : 'expanded'
  root.dataset.agenticosStatusbar = preferences.statusBarVisible ? 'visible' : 'hidden'
  root.dataset.agenticosTooltips = preferences.showTooltips ? 'visible' : 'hidden'
  root.dataset.agenticosHoverPreview = preferences.hoverPreview ? 'visible' : 'hidden'
  root.dataset.agenticosNotifications = preferences.notificationPosition
  root.style.setProperty('--agenticos-sidebar-width', preferences.sidebarWidth + 'px')
  root.style.setProperty('--agenticos-inspector-width', preferences.inspectorWidth + 'px')
}

export function subscribeUiPreferences(onChange: () => void) {
  const handle = () => onChange()
  window.addEventListener('agenticos:ui-preferences-changed', handle)
  window.addEventListener('storage', handle)
  return () => {
    window.removeEventListener('agenticos:ui-preferences-changed', handle)
    window.removeEventListener('storage', handle)
  }
}

export function emitUiPreferencesChanged() {
  window.dispatchEvent(new Event('agenticos:ui-preferences-changed'))
}
