import Icon from '../../components/Icon'

export type AgentMode = 'Agent' | 'Plan' | 'Ask' | 'Debug' | 'Bot'

const modes: Array<{ id: AgentMode; detail: string; icon: 'bot' | 'spark' | 'search' | 'shield' }> = [
  { id: 'Agent', detail: 'Build and modify', icon: 'bot' },
  { id: 'Plan', detail: 'Research before build', icon: 'spark' },
  { id: 'Ask', detail: 'Read-only exploration', icon: 'search' },
  { id: 'Debug', detail: 'Evidence-first diagnosis', icon: 'shield' },
  { id: 'Bot', detail: 'Specialist profile', icon: 'bot' },
]

interface AgentModeStripProps {
  mode: AgentMode
  onChange: (mode: AgentMode) => void
  onAction: (message: string) => void
}

export default function AgentModeStrip({ mode, onChange, onAction }: AgentModeStripProps) {
  return (
    <div className="agent-mode-strip" aria-label="Agent mode">
      <div className="agent-mode-strip__label"><span className="eyebrow">Mode</span><strong>{mode}</strong></div>
      <div className="agent-mode-strip__options">
        {modes.map((item) => (
          <button type="button" key={item.id} className={`agent-mode-option ${mode === item.id ? 'agent-mode-option--active' : ''}`} onClick={() => { onChange(item.id); onAction(`${item.id} mode selected in preview`) }}>
            <Icon name={item.icon} size={13} />
            <span><strong>{item.id}</strong><small>{item.detail}</small></span>
          </button>
        ))}
      </div>
      <kbd>Shift+Tab</kbd>
    </div>
  )
}
