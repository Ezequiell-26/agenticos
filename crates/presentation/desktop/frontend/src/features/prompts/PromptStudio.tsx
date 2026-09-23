import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'

type PromptTab = 'Library' | 'Variables' | 'Versions' | 'Test'

const promptLibrary = [
  { id: 'code-review', name: 'Code review', category: 'Engineering', version: 'v4', text: 'Review the current change set. Identify regressions, verify tests and propose the smallest safe fix.' },
  { id: 'architecture', name: 'Architecture slice', category: 'Planning', version: 'v7', text: 'Design the next implementation slice with explicit dependencies, rollback and verification evidence.' },
  { id: 'research', name: 'Evidence research', category: 'Research', version: 'v3', text: 'Gather evidence, separate facts from assumptions and cite material claims before recommending implementation.' },
  { id: 'ui', name: 'UI critique', category: 'Design', version: 'v5', text: 'Audit the interface for hierarchy, density, accessibility, discoverability and responsive behavior.' },
  { id: 'debug', name: 'Narrow debug', category: 'Engineering', version: 'v2', text: 'Find the smallest reproducible cause, validate the hypothesis and propose a reversible correction.' },
  { id: 'release', name: 'Release evidence', category: 'DevOps', version: 'v6', text: 'Prepare a release checklist with build, test, rollback and evidence requirements.' },
]

export default function PromptStudio({ onAction }: { onAction: (message: string) => void }) {
  const [selected, setSelected] = useState(promptLibrary[0].id)
  const [tab, setTab] = useState<PromptTab>('Library')
  const [query, setQuery] = useState('')
  const [text, setText] = useState(promptLibrary[0].text)
  const current = promptLibrary.find((prompt) => prompt.id === selected) ?? promptLibrary[0]
  const visible = useMemo(() => promptLibrary.filter((prompt) => !query || (prompt.name + ' ' + prompt.category + ' ' + prompt.text).toLowerCase().includes(query.toLowerCase())), [query])

  function selectPrompt(id: string) {
    const prompt = promptLibrary.find((item) => item.id === id) ?? promptLibrary[0]
    setSelected(id)
    setText(prompt.text)
  }

  return (
    <div className="prompt-studio">
      <aside className="prompt-studio__list">
        <div className="prompt-search"><Icon name="search" size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search prompts…" aria-label="Search prompts" /></div>
        <div className="prompt-list__header"><span>Library</span><span>{visible.length}</span></div>
        <div className="prompt-library">{visible.map((prompt) => <button type="button" key={prompt.id} className={selected === prompt.id ? 'prompt-library__row prompt-library__row--active' : 'prompt-library__row'} onClick={() => selectPrompt(prompt.id)}><span className="prompt-library__icon"><Icon name="spark" size={13} /></span><div><strong>{prompt.name}</strong><small>{prompt.category} · {prompt.version}</small></div></button>)}</div>
      </aside>
      <section className="prompt-studio__main">
        <header className="prompt-studio__head"><div><span className="eyebrow">{current.category}</span><h2>{current.name}</h2><small>prompt://{current.id}/{current.version}</small></div><div className="studio-header__actions"><button className="studio-button" type="button" onClick={() => onAction('Prompt duplicated in preview')}><Icon name="code" size={13} /> Duplicate</button><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Prompt saved in preview')}><Icon name="check" size={13} /> Save</button></div></header>
        <div className="prompt-studio__tabs" role="tablist" aria-label="Prompt views">
          {(['Library','Variables','Versions','Test'] as PromptTab[]).map((item) => <button type="button" key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'prompt-studio__tab prompt-studio__tab--active' : 'prompt-studio__tab'} onClick={() => setTab(item)}>{item}</button>)}
        </div>
        <div className="prompt-studio__content">
          {tab === 'Library' && <><div className="prompt-editor-meta"><span>Editable instruction</span><span className="mono-text">Markdown · autosave preview</span></div><textarea className="prompt-editor-large" value={text} onChange={(event) => setText(event.target.value)} aria-label="Prompt editor" /><div className="prompt-editor-footer"><span>1,284 chars</span><span>3 variables</span><span>Token estimate 412</span></div></>}
          {tab === 'Variables' && <div className="prompt-variables"><div className="variable-card"><strong>{'{{workspace}}'}</strong><span>Current workspace name and path</span><input placeholder="AgentiCOS" /></div><div className="variable-card"><strong>{'{{diff}}'}</strong><span>Current pending change set</span><textarea placeholder="Generated from active review context" /></div><div className="variable-card"><strong>{'{{constraints}}'}</strong><span>Rules and safety constraints</span><textarea placeholder="Fail-closed · preserve contracts" /></div><button className="studio-button" type="button" onClick={() => onAction('New prompt variable added in preview')}><Icon name="plus" size={13} /> Add variable</button></div>}
          {tab === 'Versions' && <div className="prompt-version-list">{['v4 · current · 2m ago','v3 · previous · 1d ago','v2 · archived · 4d ago','v1 · initial · 7d ago'].map((version, index) => <button type="button" key={version} onClick={() => onAction(version.split(' · ')[0] + ' opened in preview')}><span>{version.split(' · ')[0]}</span><div><strong>{version.split(' · ')[1]}</strong><small>{version.split(' · ')[2]}</small></div><Icon name={index === 0 ? 'check' : 'chevron-right'} size={13} /></button>)}</div>}
          {tab === 'Test' && <div className="prompt-test"><div className="prompt-test__toolbar"><span>Test input</span><button className="studio-button studio-button--active" type="button" onClick={() => onAction('Prompt test executed in preview')}><Icon name="play" size={13} /> Run test</button></div><textarea defaultValue="Inspect the current frontend and identify the next safe implementation slice." aria-label="Prompt test input" /><div className="prompt-test__result"><span>Preview output</span><strong>Structured response staged</strong><small>Use the real model runtime to render actual output and citations.</small></div></div>}
        </div>
      </section>
    </div>
  )
}
