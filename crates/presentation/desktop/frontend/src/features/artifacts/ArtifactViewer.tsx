import { useEffect, useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { runtime } from '../../services/runtime'

type ArtifactTab = 'Preview' | 'Metadata' | 'Versions' | 'Lineage'

const artifactData = [
  { name: 'agenticos-command-center.png', type: 'Image', size: '2.8 MB', status: 'Ready', run: 'RUN-042', version: 'v4', updated: '2m ago' },
  { name: 'architecture-report.md', type: 'Document', size: '18 KB', status: 'Ready', run: 'RUN-041', version: 'v2', updated: '11m ago' },
  { name: 'provider-test.log', type: 'Log', size: '74 KB', status: 'Ready', run: 'RUN-041', version: 'v1', updated: '14m ago' },
  { name: 'implementation-plan.json', type: 'Structured', size: '12 KB', status: 'Draft', run: 'RUN-040', version: 'v3', updated: '32m ago' },
]

const previewLines = [
  'AgentiCOS frontend implementation plan',
  '',
  '01  inspect existing architecture',
  '02  build reversible frontend slice',
  '03  review changes',
  '04  run verification',
  '05  prepare evidence package',
]

export default function ArtifactViewer({ selected, onSelect, onAction }: { selected: string; onSelect: (name: string) => void; onAction: (message: string) => void }) {
  const [tab, setTab] = useState<ArtifactTab>('Preview')
  const [liveArtifacts, setLiveArtifacts] = useState(artifactData)
  const [runtimeSyncing, setRuntimeSyncing] = useState(true)
  const [contentUrl, setContentUrl] = useState<string | null>(null)
  const [contentText, setContentText] = useState<string | null>(null)
  const current = useMemo(() => liveArtifacts.find((artifact) => artifact.name === selected) ?? liveArtifacts[0], [liveArtifacts, selected])

  useEffect(() => {
    let cancelled = false
    void runtime.artifacts.list({ limit: 100 }).then((records) => {
      if (cancelled || records.length === 0) return
      const mapped = records.map((record, index) => ({
        name: typeof record.artifact_id === 'string' ? record.artifact_id : `artifact-${index + 1}`,
        type: typeof record.kind === 'string' ? record.kind : 'Artifact',
        size: typeof record.size_bytes === 'number' ? formatBytes(record.size_bytes) : 'Runtime',
        status: record.trusted === true ? 'Trusted' : 'Ready',
        run: typeof record.run_id === 'string' ? record.run_id : '—',
        version: typeof record.version === 'string' ? record.version : 'Runtime',
        updated: typeof record.created_at === 'number' ? new Date(record.created_at * 1000).toLocaleString() : 'Runtime',
      }))
      setLiveArtifacts(mapped)
      onSelect(mapped[0].name)
    }).catch(() => {
      // Keep the presentation fixture when the runtime is unavailable.
    }).finally(() => { if (!cancelled) setRuntimeSyncing(false) })
    return () => { cancelled = true }
  }, [onSelect])

  useEffect(() => {
    setContentText(null)
    if (contentUrl) URL.revokeObjectURL(contentUrl)
    setContentUrl(null)
    let cancelled = false
    const load = async () => {
      if (!current || !current.name || current.name.startsWith('artifact-') === false) return
      try {
        const blob = await runtime.artifacts.content(current.name)
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        setContentUrl(url)
        if (blob.type.startsWith('text/') || blob.type.includes('json') || blob.type.includes('javascript') || blob.type.includes('xml')) {
          setContentText(await blob.text())
        }
      } catch {
        // Fixture preview remains available when content cannot be loaded.
      }
    }
    void load()
    return () => {
      cancelled = true
      if (contentUrl) URL.revokeObjectURL(contentUrl)
    }
  }, [current?.name])

  return (
    <div className="artifact-viewer">
      <aside className="artifact-viewer__list">
        <div className="artifact-viewer__list-head"><span>Generated outputs · {runtimeSyncing ? 'syncing' : 'runtime'}</span><span className="count-pill">{liveArtifacts.length}</span></div>
        <div className="artifact-viewer__list-body">
          {liveArtifacts.map((artifact) => (
            <button key={artifact.name} type="button" className={current.name === artifact.name ? 'artifact-viewer__item artifact-viewer__item--active' : 'artifact-viewer__item'} onClick={() => onSelect(artifact.name)}>
              <span className="artifact-viewer__item-icon"><Icon name={artifact.type === 'Log' ? 'terminal' : artifact.type === 'Image' ? 'layout' : artifact.type === 'Structured' ? 'code' : 'archive'} size={14} /></span>
              <span><strong>{artifact.name}</strong><small>{artifact.type} · {artifact.size}</small></span>
              <span className={artifact.status === 'Ready' ? 'state-pill state-pill--completed' : 'state-pill state-pill--pending'}>{artifact.status}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="artifact-viewer__main">
        <div className="artifact-viewer__toolbar">
          <div><span className="eyebrow">{current.type}</span><h2>{current.name}</h2><small>{current.size} · generated by {current.run} · {current.version} · {current.updated}</small></div>
          <div className="studio-header__actions">
            <button className="icon-button" type="button" title="Copy artifact path" onClick={() => onAction('Artifact path copied')}><Icon name="copy" size={14} /></button>
            <button className="studio-button" type="button" onClick={() => void runtime.artifacts.content(current.name).then((blob) => { const url=URL.createObjectURL(blob); const anchor=document.createElement('a'); anchor.href=url; anchor.download=current.name; anchor.click(); URL.revokeObjectURL(url); onAction('Artifact downloaded from runtime') }).catch((error) => onAction(error instanceof Error ? error.message : 'Artifact download failed'))}><Icon name="arrow-down" size={13} /> Download</button>
            <button className="studio-button studio-button--active" type="button" onClick={() => onAction('Artifact handoff requires a runtime delivery target; no handoff endpoint is exposed yet') }><Icon name="send" size={13} /> Handoff</button>
          </div>
        </div>
        <div className="artifact-viewer__tabs" role="tablist" aria-label="Artifact views">
          {(['Preview', 'Metadata', 'Versions', 'Lineage'] as ArtifactTab[]).map((item) => <button type="button" key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'artifact-viewer__tab artifact-viewer__tab--active' : 'artifact-viewer__tab'} onClick={() => setTab(item)}>{item}</button>)}
        </div>
        <div className="artifact-viewer__content">
          {tab === 'Preview' && (
            <div className={current.type === 'Image' ? 'artifact-rich-preview artifact-rich-preview--image' : 'artifact-rich-preview'}>
              <div className="artifact-rich-preview__icon"><Icon name={current.type === 'Image' ? 'layout' : 'archive'} size={30} /></div>
              {contentText !== null ? <pre>{contentText}</pre> : contentUrl && current.type.toLowerCase().includes('image') ? <img src={contentUrl} alt={current.name} style={{maxWidth:'100%',maxHeight:'70vh',objectFit:'contain'}} /> : current.type === 'Document' || current.type === 'Structured' ? <pre>{previewLines.join('\n')}</pre> : <><strong>{current.name}</strong><span>{current.type} preview surface</span><small>{contentUrl ? 'Live content loaded from runtime.' : 'Live content is unavailable for this artifact.'}</small></>}
            </div>
          )}
          {tab === 'Metadata' && <div className="artifact-meta-grid"><Metric label="Type" value={current.type} /><Metric label="Size" value={current.size} /><Metric label="Run" value={current.run} /><Metric label="Version" value={current.version} /><Metric label="Status" value={current.status} /><Metric label="Updated" value={current.updated} /><Metric label="Checksum" value={current.name.startsWith('artifact-') ? 'Runtime checksum' : 'sha256 · preview'} /><Metric label="Source" value="Agent workspace" /></div>}
          {tab === 'Versions' && <div className="artifact-version-list">{['v4 · current · 2m ago','v3 · previous · 12m ago','v2 · archived · 31m ago'].map((version, index) => <button key={version} type="button" onClick={() => onAction('Artifact ' + version.split(' · ')[0] + ' opened in preview')}><span>{version.split(' · ')[0]}</span><div><strong>{version.split(' · ')[1]}</strong><small>{version.split(' · ')[2]}</small></div><Icon name={index === 0 ? 'check' : 'chevron-right'} size={13} /></button>)}</div>}
          {tab === 'Lineage' && <div className="artifact-lineage"><div><span>Source run</span><strong>{current.run}</strong></div><div className="lineage-arrow">→</div><div><span>Agent step</span><strong>Prepare handoff</strong></div><div className="lineage-arrow">→</div><div><span>Artifact</span><strong>{current.version}</strong></div><div className="lineage-arrow">→</div><div><span>Delivery</span><strong>Ready for handoff</strong></div></div>}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="platform-metric-card"><span>{label}</span><strong>{value}</strong></div>
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
