import Icon from './Icon'
import { useExclusiveOverlay } from '../hooks/useExclusiveOverlay'
import { readUiPreferences, updateUiPreferences, type ExperienceLevel } from '../services/ui-preferences'

interface LayoutsCardProps {
  experience: ExperienceLevel
  onExperienceChange: (experience: ExperienceLevel) => void
  onClose: () => void
  onAction: (message: string) => void
}

interface ModeCard {
  id: ExperienceLevel
  title: string
  description: string
}

const modeCards: ModeCard[] = [
  {
    id: 'Simple',
    title: 'Simple',
    description: 'To chat with AgentiCOS. Sidebar and chat, without terminal, files or diff panels.',
  },
  {
    id: 'Pro',
    title: 'Advanced',
    description: 'For developers. Terminal, files, diffs, status bar and layouts, like the configs.',
  },
]

interface Template {
  id: 'left' | 'right'
  label: string
}

const templates: Template[] = [
  { id: 'left', label: 'Sidebar left' },
  { id: 'right', label: 'Sidebar right' },
]

export default function LayoutsCard({ experience, onExperienceChange, onClose, onAction }: LayoutsCardProps) {
  const preferences = readUiPreferences()
  useExclusiveOverlay('layouts', true, onClose)

  function reset() {
    updateUiPreferences({ sidebarSide: 'left', statusBarVisible: true, sessionTabsVisible: true, leftSidebarVisible: true })
    onAction('Layout restored to the default')
  }

  return (
    <div className="layouts-backdrop" role="presentation">
      <div className="layouts-card" role="dialog" aria-modal="true" aria-label="Layouts">
        <header className="layouts-card__head">
          <h2>Layouts</h2>
          <div className="layouts-card__head-actions">
            <button type="button" className="layouts-reset" onClick={reset}>Reset</button>
            <button type="button" className="layouts-done" onClick={onClose}>Done</button>
          </div>
        </header>
        <p className="layouts-card__hint">
          Choose a layout, or drag panels between zones. <kbd>Ctrl+Shift+V</kbd>
        </p>

        <div className="layouts-card__label">Interface mode</div>
        <div className="layouts-modes">
          {modeCards.map((card) => (
            <button
              key={card.id}
              type="button"
              className={experience === card.id ? 'layouts-mode layouts-mode--active' : 'layouts-mode'}
              aria-pressed={experience === card.id}
              onClick={() => {
                if (experience !== card.id) {
                  updateUiPreferences({ experience: card.id })
                  onExperienceChange(card.id)
                  onAction(`Interface mode: ${card.title}`)
                }
              }}
            >
              <strong>{card.title}</strong>
              <small>{card.description}</small>
            </button>
          ))}
        </div>
        <p className="layouts-card__note">Changes what is shown, not what AgentiCOS can do.</p>

        <div className="layouts-card__label">Templates</div>
        <div className="layouts-templates">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className={preferences.sidebarSide === template.id ? 'layouts-template layouts-template--active' : 'layouts-template'}
              aria-pressed={preferences.sidebarSide === template.id}
              onClick={() => {
                updateUiPreferences({ sidebarSide: template.id })
                onAction(`Layout template: Sidebar ${template.id}`)
              }}
            >
              <span className={`layouts-thumb layouts-thumb--${template.id}`} aria-hidden="true">
                <i className="layouts-thumb__side" />
                <i className="layouts-thumb__main" />
              </span>
              <span className="layouts-template__label">Sidebar {template.id === 'left' ? 'left' : 'right'}</span>
            </button>
          ))}
        </div>

        <button type="button" className="layouts-close-hint" onClick={onClose} title="Close layouts">
          <Icon name="x" size={12} /> Done
        </button>
      </div>
    </div>
  )
}
