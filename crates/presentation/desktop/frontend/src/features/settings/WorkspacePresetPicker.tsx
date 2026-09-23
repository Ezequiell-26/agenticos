import { useState } from 'react'
import { applyUiPreferences, defaultUiPreferences, emitUiPreferencesChanged } from '../../services/ui-preferences'
import Icon from '../../components/Icon'

const presets = [
  { id: 'coding', name: 'Coding', detail: 'Editor + terminal + compact chrome', icon: 'code', patch: { activityRailCompact: true, bottomDockVisible: true, statusBarVisible: true, leftSidebarVisible: true, agentInspectorVisible: true, sidebarWidth: 270, inspectorWidth: 330 } },
  { id: 'agent-ops', name: 'Agent Ops', detail: 'Runs + inspector + observability', icon: 'activity', patch: { activityRailCompact: false, bottomDockVisible: true, statusBarVisible: true, leftSidebarVisible: true, agentInspectorVisible: true, sidebarWidth: 250, inspectorWidth: 390 } },
  { id: 'research', name: 'Research', detail: 'Wide content + minimal chrome', icon: 'search', patch: { activityRailCompact: true, bottomDockVisible: false, statusBarVisible: true, leftSidebarVisible: true, agentInspectorVisible: false, sidebarWidth: 300, inspectorWidth: 300 } },
  { id: 'focus', name: 'Focus', detail: 'Chat-first distraction-free mode', icon: 'message', patch: { activityRailCompact: true, bottomDockVisible: false, statusBarVisible: false, leftSidebarVisible: false, agentInspectorVisible: false, sidebarWidth: 270, inspectorWidth: 320 } },
]

export default function WorkspacePresetPicker() {
  const [active, setActive] = useState('')
  function applyPreset(id: string) {
    const preset = presets.find((item) => item.id === id)
    if (!preset) return
    applyUiPreferences({ ...defaultUiPreferences, ...preset.patch })
    emitUiPreferencesChanged()
    setActive(id)
  }

  return (
    <div className="workspace-preset-picker">
      {presets.map((preset) => (
        <button type="button" key={preset.id} className={active === preset.id ? 'workspace-preset workspace-preset--active' : 'workspace-preset'} onClick={() => applyPreset(preset.id)}>
          <span className="workspace-preset__icon"><Icon name={preset.icon as 'code'} size={14} /></span>
          <span><strong>{preset.name}</strong><small>{preset.detail}</small></span>
          {active === preset.id && <Icon name="check-circle" size={13} />}
        </button>
      ))}
    </div>
  )
}
