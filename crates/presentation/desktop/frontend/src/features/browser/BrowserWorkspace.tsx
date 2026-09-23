import { useState } from 'react'
import Icon from '../../components/Icon'

type BrowserTab = 'Page' | 'DOM' | 'Console' | 'Network' | 'Storage'

const consoleLines = [
  ['INFO', 'page loaded', 'https://example.local'],
  ['DEBUG', 'dom snapshot captured', '412 nodes'],
  ['INFO', 'click', 'button#run'],
  ['WARN', 'request blocked by preview policy', 'api.example.local'],
]

const network = [
  ['GET', '/index.html', '200', '34 ms'],
  ['GET', '/assets/app.js', '200', '82 ms'],
  ['POST', '/api/agent/chat', 'preview', '—'],
  ['GET', '/favicon.ico', '200', '18 ms'],
]

const dom = [
  ['html', 'document', '1 root'],
  ['body', 'page', '1 child'],
  ['main', 'landmark', '1 region'],
  ['button#run', 'button', 'clickable'],
  ['form#chat', 'form', 'interactive'],
]

const storage = [
  ['session_id', 'session-042', 'local'],
  ['theme', 'monochrome', 'local'],
  ['workspace', 'AgentiCOS', 'local'],
]

export default function BrowserWorkspace({ onAction }: { onAction: (message: string) => void }) {
  const [tab, setTab] = useState<BrowserTab>('Page')
  const [url, setUrl] = useState('https://example.local')
  const [tabs, setTabs] = useState(['Example app'])
  const [activeTab, setActiveTab] = useState('Example app')

  function addTab() {
    const next = 'Tab ' + String(tabs.length + 1)
    setTabs((current) => [...current, next])
    setActiveTab(next)
    onAction('Browser tab added in preview')
  }

  return (
    <div className="browser-workspace">
      <div className="browser-session-bar">
        <div className="browser-tab-strip">
          {tabs.map((item) => <button key={item} type="button" className={activeTab === item ? 'browser-session-tab browser-session-tab--active' : 'browser-session-tab'} onClick={() => setActiveTab(item)}><Icon name="globe" size={11} />{item}</button>)}
          <button className="icon-button" type="button" onClick={addTab} aria-label="New browser tab"><Icon name="plus" size={13} /></button>
        </div>
        <span className="state-pill state-pill--pending">isolated preview</span>
      </div>

      <div className="browser-session-toolbar">
        <button className="icon-button" type="button" onClick={() => onAction('Back navigation staged in preview')} aria-label="Back"><Icon name="chevron-left" size={14} /></button>
        <button className="icon-button" type="button" onClick={() => onAction('Forward navigation staged in preview')} aria-label="Forward"><Icon name="chevron-right" size={14} /></button>
        <button className="icon-button" type="button" onClick={() => onAction('Page refresh staged in preview')} aria-label="Refresh"><Icon name="history" size={14} /></button>
        <div className="browser-address"><span className="status-dot status-dot--live" /><input value={url} onChange={(event) => setUrl(event.target.value)} aria-label="Browser URL" /><button type="button" onClick={() => onAction('Navigation recorded for ' + url)}>Go</button></div>
        <button className="studio-button" type="button" onClick={() => onAction('New isolated browser context staged in preview')}><Icon name="shield" size={13} /> Isolate</button>
      </div>

      <div className="browser-workspace__body">
        <div className="browser-page">
          <div className="browser-page__head"><span>example.local</span><div><span>DOM 412</span><span>JS ready</span><span>Storage 3</span></div></div>
          <div className="browser-page__canvas">
            <div className="browser-page__hero">
              <span className="eyebrow">Example app</span>
              <h2>Interactive browser preview</h2>
              <p>This surface represents the page an agent can inspect, click, fill, screenshot and verify later through a real browser runtime.</p>
              <div className="browser-page__actions"><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Page action clicked in preview')}><Icon name="play" size={13} /> Run action</button><button className="studio-button" type="button" onClick={() => onAction('Screenshot capture staged in preview')}>Screenshot</button></div>
            </div>
          </div>
        </div>

        <aside className="browser-inspector">
          <div className="browser-inspector__tabs" role="tablist" aria-label="Browser inspector">
            {(['Page', 'DOM', 'Console', 'Network', 'Storage'] as BrowserTab[]).map((item) => <button type="button" key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'browser-inspector__tab browser-inspector__tab--active' : 'browser-inspector__tab'} onClick={() => setTab(item)}>{item}</button>)}
          </div>
          <div className="browser-inspector__body">
            {tab === 'Page' && <div className="browser-inspector-stack"><Metric label="URL" value={url} /><Metric label="Viewport" value="1440 × 900" /><Metric label="DOM nodes" value="412" /><Metric label="Session" value="Isolated" /><div className="callout"><Icon name="globe" size={13} /><span>Browser actions shown here are visual previews; no live browser session is opened by the frontend.</span></div></div>}
            {tab === 'DOM' && <div className="browser-tree">{dom.map(([name, type, meta]) => <button type="button" key={name} onClick={() => onAction('Selected DOM node ' + name)}><span>{name}</span><div><strong>{type}</strong><small>{meta}</small></div><Icon name="chevron-right" size={12} /></button>)}</div>}
            {tab === 'Console' && <div className="browser-log-list">{consoleLines.map(([level, message, detail]) => <div key={message}><span className="mono-text">{level}</span><div><strong>{message}</strong><small>{detail}</small></div></div>)}</div>}
            {tab === 'Network' && <div className="browser-network-list">{network.map(([method, path, status, duration]) => <div key={method + path}><span className="mono-text">{method}</span><div><strong>{path}</strong><small>{duration}</small></div><span className="state-pill state-pill--pending">{status}</span></div>)}</div>}
            {tab === 'Storage' && <div className="browser-storage-list">{storage.map(([key, value, scope]) => <div key={key}><div><strong>{key}</strong><small>{scope}</small></div><span>{value}</span></div>)}</div>}
          </div>
        </aside>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="platform-metric-row"><span>{label}</span><strong>{value}</strong></div>
}
