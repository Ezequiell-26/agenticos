import { useCallback, useRef, useState } from 'react'
import Icon from './Icon'
import { useMenuKeyboard } from '../hooks/useMenuKeyboard'
import { useExclusiveOverlay } from '../hooks/useExclusiveOverlay'
import {
  readUiPreferences,
  updateUiPreferences,
  type ExperienceLevel,
  type UiPreferences,
} from '../services/ui-preferences'
import type { RailMode } from '../navigation'

const themes = ['Monochrome', 'Graphite', 'Paper', 'High contrast', 'Dark OLED']

const accents: Array<{ id: string; color: string }> = [
  { id: 'White', color: '#f2f2f2' },
  { id: 'Silver', color: '#c9d1dc' },
  { id: 'Blue', color: '#8fb8ff' },
  { id: 'Violet', color: '#b9a5ff' },
  { id: 'Green', color: '#8fd0ae' },
]

const densities = ['Compact', 'Comfortable', 'Spacious']

const experienceCopy: Record<ExperienceLevel, { title: string; detail: string }> = {
  Simple: { title: 'Simple', detail: 'Chat, tasks, files and settings. Everything else stays one search away.' },
  Pro: { title: 'Pro', detail: 'Full rail plus the complete feature catalog with advanced surfaces.' },
}

interface CustomizePopoverProps {
  experience: ExperienceLevel
  onExperienceChange: (experience: ExperienceLevel) => void
  onSelectMode: (mode: RailMode) => void
  iconOnly?: boolean
}

export default function CustomizePopover({ experience, onExperienceChange, onSelectMode, iconOnly = false }: CustomizePopoverProps) {
  const [open, setOpen] = useState(false)
  const [preferences, setPreferences] = useState<UiPreferences>(() => readUiPreferences())
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const closePopover = useCallback(() => setOpen(false), [])
  useMenuKeyboard({ open, menuRef: popoverRef, triggerRef, onClose: closePopover, initialFocus: false })
  useExclusiveOverlay('customize', open, closePopover)

  function update(patch: Partial<UiPreferences>) {
    const next = updateUiPreferences(patch)
    setPreferences(next)
    if (patch.experience && patch.experience !== experience) onExperienceChange(patch.experience)
  }

  const toggles: Array<{ id: keyof UiPreferences; label: string }> = [
    { id: 'leftSidebarVisible', label: 'Workspace sidebar' },
    { id: 'bottomDockVisible', label: 'Bottom dock' },
    { id: 'statusBarVisible', label: 'Status bar' },
  ]

  return (
    <div className="customize-trigger">
      <button
        ref={triggerRef}
        id="customize-trigger"
        className={open ? 'soft-button soft-button--active' : 'soft-button'}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="customize-popover"
        aria-haspopup="dialog"
        title="Customize the workspace"
        aria-label="Customize the workspace"
      >
        <Icon name="sliders" size={14} />{!iconOnly && 'Customize'}
      </button>
      {open && (
        <div ref={popoverRef} id="customize-popover" className="customize-popover" role="dialog" aria-label="Customize workspace">
          <div className="customize-popover__head">
            <strong>Customize</strong>
            <span className="eyebrow">AgentiCOS</span>
          </div>

          <div className="customize-popover__section">
            <div className="customize-popover__label"><span>Experience</span><span className="customize-popover__hint">for every profile</span></div>
            <div className="customize-popover__row">
              {(['Simple', 'Pro'] as ExperienceLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  className={experience === level ? 'customize-choice customize-choice--active' : 'customize-choice'}
                  aria-pressed={experience === level}
                  title={experienceCopy[level].detail}
                  onClick={() => update({ experience: level })}
                >
                  {experienceCopy[level].title}
                </button>
              ))}
            </div>
            <p className="customize-popover__hint" style={{ marginTop: 6 }}>{experienceCopy[experience].detail}</p>
          </div>

          <div className="customize-popover__section">
            <div className="customize-popover__label"><span>Theme</span></div>
            <div className="customize-popover__row">
              {themes.map((theme) => (
                <button
                  key={theme}
                  type="button"
                  className={preferences.theme === theme ? 'customize-choice customize-choice--active' : 'customize-choice'}
                  aria-pressed={preferences.theme === theme}
                  onClick={() => update({ theme })}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>

          <div className="customize-popover__section">
            <div className="customize-popover__label"><span>Accent</span></div>
            <div className="customize-popover__row">
              {accents.map((accent) => (
                <button
                  key={accent.id}
                  type="button"
                  className={preferences.accent === accent.id ? 'customize-swatch customize-swatch--active' : 'customize-swatch'}
                  style={{ background: accent.color }}
                  aria-label={'Accent ' + accent.id}
                  aria-pressed={preferences.accent === accent.id}
                  onClick={() => update({ accent: accent.id })}
                />
              ))}
            </div>
          </div>

          <div className="customize-popover__section">
            <div className="customize-popover__label"><span>Density</span></div>
            <div className="customize-popover__row">
              {densities.map((density) => (
                <button
                  key={density}
                  type="button"
                  className={preferences.density === density ? 'customize-choice customize-choice--active' : 'customize-choice'}
                  aria-pressed={preferences.density === density}
                  onClick={() => update({ density })}
                >
                  {density}
                </button>
              ))}
            </div>
          </div>

          <div className="customize-popover__section">
            <div className="customize-popover__label"><span>Interface scale</span></div>
            <div className="customize-scale">
              <input
                type="range"
                min={90}
                max={130}
                step={5}
                value={preferences.uiScale}
                aria-label="Interface scale percentage"
                onChange={(event) => update({ uiScale: Number(event.target.value) })}
              />
              <output>{preferences.uiScale}%</output>
            </div>
          </div>

          <div className="customize-popover__section">
            <div className="customize-popover__label"><span>Panels</span></div>
            {toggles.map((toggle) => (
              <label key={String(toggle.id)} className="customize-switch-row">
                <span>{toggle.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(preferences[toggle.id])}
                  onChange={(event) => update({ [toggle.id]: event.target.checked } as Partial<UiPreferences>)}
                />
              </label>
            ))}
          </div>

          <div className="customize-popover__foot">
            <button type="button" className="studio-button" onClick={() => { closePopover(); onSelectMode('customization') }}>
              <Icon name="settings" size={13} /> Open full customization
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
