import Icon from '../../components/Icon'
import type { RailMode } from '../../navigation'

/**
 * Tira de pestañas de Extensions, portada de Qoder (Plugins / Skills / Connectors).
 * Cada pestaña apunta a una superficie real del repo: `marketplace`, `skills` y `mcp`.
 * No se inventa ninguna cuarta pestaña: si el repo no tiene superficie, no aparece.
 */
type ExtensionTab = { id: 'plugins' | 'skills' | 'connectors'; label: string; mode: RailMode; icon: 'download' | 'spark' | 'network' }

const tabs: readonly ExtensionTab[] = [
  { id: 'plugins', label: 'Plugins', mode: 'marketplace', icon: 'download' },
  { id: 'skills', label: 'Skills', mode: 'skills', icon: 'spark' },
  { id: 'connectors', label: 'Connectors', mode: 'mcp', icon: 'network' },
]

export default function ExtensionsTabs({ active, onNavigate }: { active: ExtensionTab['id']; onNavigate?: (mode: RailMode) => void }) {
  const index = tabs.findIndex((tab) => tab.id === active)

  function move(step: number) {
    const next = tabs[(index + step + tabs.length) % tabs.length]
    onNavigate?.(next.mode)
  }

  return (
    <nav className="qoder-ext-tabs" aria-label="Extensions">
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.id}
          className={tab.id === active ? 'qoder-ext-tab qoder-ext-tab--active' : 'qoder-ext-tab'}
          aria-current={tab.id === active ? 'page' : undefined}
          onClick={() => onNavigate?.(tab.mode)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
            else if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
            else if (event.key === 'Home') { event.preventDefault(); onNavigate?.(tabs[0].mode) }
            else if (event.key === 'End') { event.preventDefault(); onNavigate?.(tabs[tabs.length - 1].mode) }
          }}
        >
          <Icon name={tab.icon} size={13} />
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
