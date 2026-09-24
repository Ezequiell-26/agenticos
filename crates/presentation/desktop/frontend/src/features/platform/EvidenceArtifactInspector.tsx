import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { MetricCard, Panel, Tag } from './PlatformPrimitives'

type Kind = 'Screenshot' | 'Video' | 'Log' | 'Diff' | 'Test report' | 'Handoff'
type Verification = 'Verified' | 'Pending' | 'Blocked'

const artifacts: Array<[string, Kind, string, string, string]> = [
  ['artifact-22', 'Screenshot', 'frontend-main.png', '812 KB', 'Visual verification'],
  ['artifact-23', 'Video', 'agent-run.mp4', '18.4 MB', 'Computer-use demo'],
  ['artifact-24', 'Log', 'tool-trace.jsonl', '124 KB', 'Execution evidence'],
  ['artifact-25', 'Diff', 'provider-routing.patch', '18 KB', 'Code change'],
  ['artifact-26', 'Test report', 'verification.json', '6 KB', 'Automated checks'],
  ['artifact-27', 'Handoff', 'review-package.md', '4 KB', 'Agent handoff'],
]

const verificationState: Record<string, Verification> = {
  'artifact-22': 'Verified',
  'artifact-23': 'Pending',
  'artifact-24': 'Verified',
  'artifact-25': 'Verified',
  'artifact-26': 'Pending',
  'artifact-27': 'Blocked',
}

function artifactIcon(kind: Kind): 'layout' | 'play' | 'activity' | 'git' | 'check-circle' | 'archive' {
  if (kind === 'Screenshot') return 'layout'
  if (kind === 'Video') return 'play'
  if (kind === 'Log') return 'activity'
  if (kind === 'Diff') return 'git'
  if (kind === 'Test report') return 'check-circle'
  return 'archive'
}

export function EvidenceArtifactInspector({ onAction }: { onAction: (message: string) => void }) {
  const [kind, setKind] = useState<Kind | 'All'>('All')
  const [verification, setVerification] = useState<Verification | 'All'>('All')
  const [selected, setSelected] = useState(artifacts[0][0])
  const [compare, setCompare] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = useMemo(
    () => artifacts.filter((artifact) =>
      (kind === 'All' || artifact[1] === kind) &&
      (verification === 'All' || verificationState[artifact[0]] === verification) &&
      artifact.join(' ').toLowerCase().includes(search.toLowerCase()),
    ),
    [kind, verification, search],
  )

  const current = filtered.find((artifact) => artifact[0] === selected) ?? filtered[0] ?? artifacts[0]
  const currentVerification = verificationState[current[0]]
  const act = (message: string) => onAction(message + ' staged in preview')

  return (
    <div className="evidence-inspector">
      <header className="evidence-inspector__hero">
        <div>
          <span className="eyebrow">Proof layer</span>
          <h1>Evidence & Artifact Inspector</h1>
          <p>Inspect screenshots, recordings, logs, diffs, reports and handoff packages with provenance and verification state.</p>
        </div>
        <div className="evidence-inspector__actions">
          <Tag label="Evidence chain" />
          <button className="studio-button" type="button" onClick={() => act('Export evidence package')}><Icon name="download" size={13} /> Export package</button>
          <button className="studio-button studio-button--active" type="button" onClick={() => act('Attach evidence')}><Icon name="plus" size={13} /> Attach</button>
        </div>
      </header>

      <div className="platform-metrics">
        <MetricCard label="Artifacts" value="14" sub="6 types" />
        <MetricCard label="Verified" value="11" sub="3 awaiting checks" />
        <MetricCard label="Sources" value="7" sub="Files, runs, browser and Git" />
        <MetricCard label="Integrity" value="SHA linked" sub="Provenance preserved" />
      </div>

      <div className="evidence-inspector__filters">
        <div className="evidence-search">
          <Icon name="search" size={12} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search artifacts…" aria-label="Search artifacts" />
        </div>
        {(['All', 'Screenshot', 'Video', 'Log', 'Diff', 'Test report', 'Handoff'] as const).map((item) => (
          <button type="button" className={kind === item ? 'studio-button studio-button--active' : 'studio-button'} key={item} onClick={() => { setKind(item); setSelected('') }}>{item}</button>
        ))}
        <span className="evidence-inspector__divider" aria-hidden="true" />
        {(['All', 'Verified', 'Pending', 'Blocked'] as const).map((item) => (
          <button type="button" className={verification === item ? 'studio-button studio-button--active' : 'studio-button'} key={item} onClick={() => { setVerification(item); setSelected('') }}>{item}</button>
        ))}
      </div>

      <div className="evidence-inspector__layout">
        <Panel title="Artifact index">
          <div className="artifact-list">
            {filtered.length === 0 && <div className="artifact-empty"><Icon name="search" size={18} /><strong>No evidence matches the current filters.</strong><small>Clear the search or verification filter to inspect another artifact.</small></div>}
            {filtered.map((artifact) => {
              const status = verificationState[artifact[0]]
              return (
                <button type="button" key={artifact[0]} className={selected === artifact[0] ? 'artifact-row artifact-row--active' : 'artifact-row'} onClick={() => setSelected(artifact[0])}>
                  <span className="artifact-row__icon"><Icon name={artifactIcon(artifact[1])} size={14} /></span>
                  <span><strong>{artifact[2]}</strong><small>{artifact[0]} · {artifact[4]}</small></span>
                  <span className="artifact-row__meta"><small>{artifact[3]}</small><span className={status === 'Verified' ? 'state-pill state-pill--completed' : status === 'Blocked' ? 'state-pill state-pill--pending' : 'state-pill'}>{status}</span></span>
                </button>
              )
            })}
          </div>
        </Panel>

        <Panel title="Inspector">
          <div className="artifact-preview">
            <div className="artifact-preview__visual">
              <Icon name={artifactIcon(current[1])} size={32} />
              <strong>{current[2]}</strong>
              <span>{current[1]} · {current[3]} · {currentVerification}</span>
            </div>

            <div className="artifact-facts">
              <div><span>Origin</span><strong>RUN-042</strong></div>
              <div><span>Generated at</span><strong>09:11:32</strong></div>
              <div><span>Source path</span><strong>artifacts/{current[2]}</strong></div>
              <div><span>Integrity</span><strong>SHA-256 linked</strong></div>
              <div><span>Verification</span><strong>{currentVerification}</strong></div>
              <div><span>Retention</span><strong>Workspace policy</strong></div>
            </div>

            <div className="artifact-provenance">
              <span className="eyebrow">Provenance chain</span>
              <p>Mission → Run → Event → Artifact → Verification</p>
              <div><Tag label="Mission" /><Tag label="RUN-042" /><Tag label="event:artifact" /><Tag label={currentVerification.toLowerCase()} /></div>
            </div>

            <div className="platform-actions">
              <button className="studio-button" type="button" onClick={() => act('Open artifact')}>Open</button>
              <button className={compare === current[0] ? 'studio-button studio-button--active' : 'studio-button'} type="button" onClick={() => setCompare(compare === current[0] ? null : current[0])}>Compare</button>
              <button className="studio-button" type="button" onClick={() => act('Inspect source event')}>Source event</button>
              <button className="studio-button studio-button--active" type="button" onClick={() => act('Export ' + current[2])}><Icon name="download" size={12} />Export</button>
            </div>

            {compare === current[0] && (
              <div className="artifact-compare">
                <span className="eyebrow">Comparison ready</span>
                <strong>{current[2]} ↔ baseline</strong>
                <small>Binary/text diff, provenance and verification metadata will be supplied by the runtime adapter.</small>
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className="evidence-inspector__footer">
        <span><Icon name="shield" size={12} /> Evidence metadata does not expose secrets.</span>
        <span>Artifact download, mutation and external publication require runtime authorization.</span>
      </div>
    </div>
  )
}
