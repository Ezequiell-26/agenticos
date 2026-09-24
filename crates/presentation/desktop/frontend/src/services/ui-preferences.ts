export const UI_PREFERENCES_STORAGE_KEY = 'agenticos.ui.hermes-settings-v2'

export type ExperienceLevel = 'Simple' | 'Pro'

export interface UiPreferences extends UiLayoutPreferences {
  theme: string
  accent: string
  density: string
  uiScale: number
  fontSize: number
  experience: ExperienceLevel
}

export interface UiLayoutPreferences {
  leftSidebarVisible: boolean
  agentInspectorVisible: boolean
  bottomDockVisible: boolean
  activityRailCompact: boolean
  statusBarVisible: boolean
  sessionTabsVisible: boolean
  showTooltips: boolean
  hoverPreview: boolean
  notificationPosition: string
  sidebarWidth: number
  inspectorWidth: number
}

export const defaultUiPreferences: UiPreferences = {
  theme: 'Monochrome',
  accent: 'Blue',
  density: 'Comfortable',
  uiScale: 100,
  fontSize: 13,
  experience: 'Simple',
  leftSidebarVisible: true,
  agentInspectorVisible: true,
  bottomDockVisible: false,
  activityRailCompact: true,
  statusBarVisible: true,
  sessionTabsVisible: true,
  showTooltips: true,
  hoverPreview: true,
  notificationPosition: 'top-right',
  sidebarWidth: 270,
  inspectorWidth: 320,
}

export function readUiPreferences(): UiPreferences {
  try {
    const raw = window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY)
    if (!raw) return defaultUiPreferences
    const parsed = JSON.parse(raw) as { settings?: Partial<UiPreferences> }
    return { ...defaultUiPreferences, ...(parsed.settings ?? {}) }
  } catch {
    return defaultUiPreferences
  }
}

export function readUiLayoutPreferences(): UiLayoutPreferences {
  const preferences = readUiPreferences()
  const {
    theme: _theme,
    accent: _accent,
    density: _density,
    uiScale: _uiScale,
    fontSize: _fontSize,
    ...layout
  } = preferences
  return layout
}

export function updateUiPreferences(patch: Partial<UiPreferences>) {
  const next = { ...readUiPreferences(), ...patch }
  try {
    window.localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify({ settings: next }))
  } catch {
    // Persistence is optional; active UI preferences still apply for this session.
  }
  applyUiPreferences(next)
  emitUiPreferencesChanged()
  return next
}

export function applyUiPreferences(preferences: UiPreferences) {
  const root = document.documentElement
  root.dataset.agenticosTheme = preferences.theme.toLowerCase().replace(/\s+/g, '-')
  root.dataset.agenticosAccent = preferences.accent.toLowerCase()
  root.dataset.agenticosDensity = preferences.density.toLowerCase()
  root.dataset.agenticosExperience = preferences.experience === 'Pro' ? 'pro' : 'simple'
  root.style.setProperty('--agenticos-ui-scale', String(preferences.uiScale / 100))
  root.style.setProperty('--agenticos-font-size', preferences.fontSize + 'px')
  root.dataset.agenticosSidebar = preferences.leftSidebarVisible ? 'visible' : 'hidden'
  root.dataset.agenticosInspector = preferences.agentInspectorVisible ? 'visible' : 'hidden'
  root.dataset.agenticosDock = preferences.bottomDockVisible ? 'visible' : 'hidden'
  root.dataset.agenticosRail = preferences.activityRailCompact ? 'compact' : 'expanded'
  root.dataset.agenticosStatusbar = preferences.statusBarVisible ? 'visible' : 'hidden'
  root.dataset.agenticosTabs = preferences.sessionTabsVisible ? 'visible' : 'hidden'
  root.dataset.agenticosTooltips = preferences.showTooltips ? 'visible' : 'hidden'
  root.dataset.agenticosHoverPreview = preferences.hoverPreview ? 'visible' : 'hidden'
  root.dataset.agenticosNotifications = preferences.notificationPosition
  root.style.setProperty('--agenticos-sidebar-width', preferences.sidebarWidth + 'px')
  root.style.setProperty('--agenticos-inspector-width', preferences.inspectorWidth + 'px')
}

export function applyUiLayoutPreferences(preferences: UiLayoutPreferences) {
  const current = readUiPreferences()
  applyUiPreferences({ ...current, ...preferences })
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
