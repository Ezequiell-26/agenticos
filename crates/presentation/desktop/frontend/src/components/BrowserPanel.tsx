import { useState } from 'react'
import Icon from './Icon'

interface BrowserTab {
  id: number
  url: string
  draft: string
  history: string[]
  index: number
}

function newTab(id: number): BrowserTab {
  return { id, url: 'about:blank', draft: 'about:blank', history: ['about:blank'], index: 0 }
}

function normalizeUrl(raw: string): string {
  const value = raw.trim()
  if (!value || /^about:/i.test(value)) return 'about:blank'
  if (/^https?:\/\//i.test(value)) return value
  return 'https://' + value
}

/* Presentation-side browser panel. Pages render in an embedded frame; page
   mutations, downloads and credentials stay gated by the runtime. */
export default function BrowserPanel({ onAction }: { onAction: (message: string) => void }) {
  const [tabs, setTabs] = useState<BrowserTab[]>([newTab(1)])
  const [activeId, setActiveId] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0]

  function patchTab(id: number, patch: Partial<BrowserTab>) {
    setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)))
  }

  function navigate(tab: BrowserTab, rawUrl: string) {
    const url = normalizeUrl(rawUrl)
    if (url === tab.history[tab.index]) {
      setReloadKey((key) => key + 1)
      return
    }
    const history = [...tab.history.slice(0, tab.index + 1), url]
    patchTab(tab.id, { url, draft: url, history, index: history.length - 1 })
    onAction(`Browser navigated to ${url}`)
  }

  function step(tab: BrowserTab, delta: number) {
    const index = tab.index + delta
    if (index < 0 || index >= tab.history.length) return
    patchTab(tab.id, { index, url: tab.history[index], draft: tab.history[index] })
  }

  function addTab() {
    const id = Date.now()
    setTabs((current) => [...current, newTab(id)])
    setActiveId(id)
  }

  function closeTab(id: number) {
    setTabs((current) => {
      const next = current.filter((tab) => tab.id !== id)
      if (next.length === 0) return current
      if (id === activeId) setActiveId(next[next.length - 1].id)
      return next
    })
  }

  const canBack = active.index > 0
  const canForward = active.index < active.history.length - 1
  const showFrame = active.url !== 'about:blank'

  return (
    <section className="browser-panel" aria-label="Browser panel">
      <div className="browser-tabs" role="tablist" aria-label="Browser tabs">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeId}
            className={tab.id === activeId ? 'session-tab session-tab--active' : 'session-tab'}
            onClick={() => setActiveId(tab.id)}
          >
            <Icon name="globe" size={11} />
            Browser{tabs.length > 1 ? ' ' + (index + 1) : ''}
            {tabs.length > 1 && (
              <span
                role="button"
                aria-label={'Close browser tab ' + (index + 1)}
                className="browser-tab__close"
                onClick={(event) => { event.stopPropagation(); closeTab(tab.id) }}
              >
                <Icon name="x" size={10} />
              </span>
            )}
          </button>
        ))}
        <button type="button" className="session-tab session-tab--new" aria-label="New browser tab" title="New browser tab" onClick={addTab}>
          <Icon name="plus" size={14} />
        </button>
      </div>

      <div className="browser-toolbar">
        <button type="button" className="composer-icon" aria-label="Back" title="Back" disabled={!canBack} onClick={() => step(active, -1)}><Icon name="chevron-left" size={14} /></button>
        <button type="button" className="composer-icon" aria-label="Forward" title="Forward" disabled={!canForward} onClick={() => step(active, 1)}><Icon name="chevron-right" size={14} /></button>
        <button type="button" className="composer-icon" aria-label="Reload" title="Reload" onClick={() => setReloadKey((key) => key + 1)}><Icon name="refresh" size={14} /></button>
        <input
          className="browser-url"
          value={active.draft}
          aria-label="Browser address"
          placeholder="about:blank"
          onChange={(event) => patchTab(active.id, { draft: event.target.value })}
          onKeyDown={(event) => { if (event.key === 'Enter') navigate(active, active.draft) }}
        />
        <button type="button" className="composer-icon" aria-label="Find in page" title="Find in page" onClick={() => onAction('Find in page is handled by the runtime')}><Icon name="search" size={13} /></button>
        <button type="button" className="composer-icon" aria-label="Copy address" title="Copy address" onClick={() => { void navigator.clipboard?.writeText(active.url); onAction('Address copied to clipboard') }}><Icon name="copy" size={13} /></button>
        <button type="button" className="composer-icon" aria-label="Open in system browser" title="Open in system browser" onClick={() => { window.open(active.url, '_blank'); onAction('Opened in the system browser') }}><Icon name="external" size={13} /></button>
        <button type="button" className="composer-icon" aria-label="Browser settings" title="Browser settings" onClick={() => onAction('Browser settings live in Settings → Browser')}><Icon name="settings" size={13} /></button>
      </div>

      <div className="browser-content">
        {showFrame ? (
          <iframe
            key={active.id + '-' + reloadKey}
            className="browser-frame"
            src={active.url}
            title="Browser preview"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="browser-empty">
            <Icon name="globe" size={30} />
            <p>Type an address above to navigate, or ask the agent to open a page.</p>
          </div>
        )}
      </div>
    </section>
  )
}
