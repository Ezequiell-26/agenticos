import './PromptLab.css'
import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { Panel, Metric, Tag } from './PlatformPrimitives'

type Props = { onAction: (message: string) => void }

const versions = [
  ['PROMPT-042', 'Repository Reviewer', 'v3.4', 'Published', '2h ago', '92.4%'],
  ['PROMPT-041', 'Repository Reviewer', 'v3.3', 'Archived', '1d ago', '89.8%'],
  ['PROMPT-018', 'Research Analyst', 'v2.1', 'Published', '3d ago', '95.1%'],
]
const layers = [
  ['System', 'You are a repository-aware engineering agent. Preserve existing contracts and verify changes before completion.', '8.2k'],
  ['Developer', 'Follow project rules, inspect relevant files first, prefer reversible changes, and record implementation evidence.', '4.1k'],
  ['User', '{{task}}', '0.4k'],
]
const tests = [
  ['Reviewer catches unsafe deletion', 'Safety', 'Pass', '1.8s'],
  ['Reviewer preserves runtime contracts', 'Regression', 'Pass', '2.1s'],
  ['Reviewer requests evidence before completion', 'Quality', 'Pass', '1.6s'],
  ['Reviewer handles ambiguous scope', 'Robustness', 'Review', '2.7s'],
]

export function PromptLab({ onAction }: Props) {
  const [selected, setSelected] = useState(versions[0][0])
  const [tab, setTab] = useState<'editor' | 'tests' | 'diff' | 'variables'>('editor')
  const [draft, setDraft] = useState(layers[1][1])
  const [published, setPublished] = useState(false)
  const [temperature, setTemperature] = useState(0.2)
  const selectedVersion = useMemo(() => versions.find((item) => item[0] === selected) ?? versions[0], [selected])

  return (
    <div className="prompt-lab">
      <div className="platform-grid platform-grid--4">
        <Metric label="Prompt versions" value="12" />
        <Metric label="Published" value="4" />
        <Metric label="Test coverage" value="94%" />
        <Metric label="Avg. tokens" value="12.7k" />
      </div>

      <div className="prompt-lab__layout">
        <Panel title="Prompt registry">
          <div className="prompt-version-list">
            {versions.map(([id, name, version, state, age, score]) => (
              <button key={id} type="button" className={selected === id ? 'prompt-version prompt-version--active' : 'prompt-version'} onClick={() => setSelected(id)}>
                <div><strong>{name}</strong><span>{id} · {version}</span></div>
                <div><Tag label={state} /><small>{score} · {age}</small></div>
              </button>
            ))}
          </div>
          <button className="studio-button" type="button" onClick={() => onAction('New prompt draft opened in preview')}><Icon name="plus" size={13} /> New version</button>
        </Panel>

        <Panel title={selectedVersion[1]}>
          <div className="prompt-lab__identity">
            <div><span className="eyebrow">{selectedVersion[0]} · {selectedVersion[2]}</span><p>Layered prompt contract with variables, model compatibility and repeatable evaluation.</p></div>
            <span className={published ? 'state-pill state-pill--completed' : 'state-pill state-pill--pending'}>{published ? 'Publish staged' : selectedVersion[3]}</span>
          </div>

          <div className="prompt-tabs" role="tablist" aria-label="Prompt Lab sections">
            {(['editor', 'tests', 'diff', 'variables'] as const).map((item) => (
              <button key={item} type="button" className={tab === item ? 'studio-button studio-button--active' : 'studio-button'} onClick={() => setTab(item)} role="tab" aria-selected={tab === item}>{item}</button>
            ))}
          </div>

          {tab === 'editor' && <div className="prompt-editor">
            {layers.map(([name, value, tokens], index) => <div className="prompt-layer" key={name}><div className="prompt-layer__head"><strong>{name}</strong><span>{tokens} tokens</span></div><textarea value={index === 1 ? draft : value} readOnly={index !== 1} onChange={(event) => index === 1 && setDraft(event.target.value)} aria-label={name + ' prompt layer'} /></div>)}
            <div className="prompt-settings"><label>Temperature <input type="range" min="0" max="1" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} /></label><strong>{temperature.toFixed(1)}</strong><Tag label="JSON output compatible" /><Tag label="Tools allowed" /></div>
          </div>}

          {tab === 'variables' && <div className="prompt-variable-grid">{[['task', 'string', 'Required', 'Repository task or objective'], ['project', 'string', 'Optional', 'Current project identifier'], ['files', 'array', 'Optional', 'Relevant files already selected'], ['risk_mode', 'enum', 'Guarded', 'normal | guarded | strict']].map(([name, type, required, detail]) => <div className="prompt-variable" key={name}><code>{'{{' + name + '}}'}</code><strong>{type}</strong><span>{required}</span><small>{detail}</small></div>)}</div>}

          {tab === 'tests' && <div className="prompt-tests">{tests.map(([name, category, state, duration]) => <div className="prompt-test" key={name}><span className={state === 'Pass' ? 'state-dot state-dot--pass' : 'state-dot'} /><div><strong>{name}</strong><span>{category} · {duration}</span></div><Tag label={state} /></div>)}</div>}

          {tab === 'diff' && <div className="prompt-diff"><div><span>v3.3 → v3.4</span><Tag label="+2 rules" /></div><pre>- Complete when code compiles
+ Complete only after verification evidence
+ Preserve runtime contracts
- Use best judgment on risky operations</pre><small>Change note: strengthened completion criteria and safety boundary.</small></div>}

          <div className="platform-actions">
            <button className="studio-button" type="button" onClick={() => onAction('Prompt diff opened in preview')}>Compare versions</button>
            <button className="studio-button" type="button" onClick={() => onAction('Prompt evaluation staged in preview')}><Icon name="play" size={13} /> Test prompt</button>
            <button className="studio-button" type="button" onClick={() => onAction('Prompt rollback preview opened')}><Icon name="history" size={13} /> Rollback</button>
            <button className={published ? 'studio-button studio-button--active' : 'studio-button'} type="button" onClick={() => { setPublished(true); onAction('Prompt publish preview staged') }}>Publish preview</button>
          </div>
        </Panel>
      </div>

      <div className="platform-grid platform-grid--2">
        <Panel title="Compatibility">
          <div className="prompt-compat"><div><span>Models</span><strong>Auto route · GPT · Claude · Gemini · DeepSeek</strong></div><div><span>Context</span><strong>128k minimum target</strong></div><div><span>Tools</span><strong>Structured tool calling</strong></div><div><span>Output</span><strong>Text + JSON</strong></div></div>
        </Panel>
        <Panel title="Release guard">
          <div className="prompt-guard"><Icon name="shield" size={17} /><div><strong>Evidence required</strong><span>Publishing remains a preview action. Runtime prompt deployment must be owned by the backend release contract.</span></div></div>
          <div className="platform-actions"><button className="studio-button" type="button" onClick={() => onAction('Release checklist opened in preview')}>Release checklist</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Prompt branch created in preview')}><Icon name="branch" size={13} /> Create branch</button></div>
        </Panel>
      </div>
    </div>
  )
}
