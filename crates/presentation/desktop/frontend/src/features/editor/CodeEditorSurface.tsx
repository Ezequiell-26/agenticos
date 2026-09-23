import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../../components/Icon'

interface CodeEditorSurfaceProps {
  value: string
  onChange: (value: string) => void
  filePath: string
  showDiff?: boolean
  onSave?: () => void
}

export default function CodeEditorSurface({
  value,
  onChange,
  filePath,
  showDiff = false,
  onSave,
}: CodeEditorSurfaceProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [wrap, setWrap] = useState(false)
  const [minimap, setMinimap] = useState(false)
  const [focusedLine, setFocusedLine] = useState(1)
  const [aiPanel, setAiPanel] = useState(false)
  const [selection, setSelection] = useState('Current file')
  const [diagnostics, setDiagnostics] = useState(true)

  const lines = useMemo(() => value.split('\n'), [value])
  const language = filePath.endsWith('.rs')
    ? 'Rust'
    : filePath.endsWith('.md')
      ? 'Markdown'
      : filePath.endsWith('.json')
        ? 'JSON'
        : 'TypeScript React'

  const matchCount = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return 0
    return lines.reduce((count, line) => count + (line.toLowerCase().includes(term) ? 1 : 0), 0)
  }, [lines, query])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        onSave?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSave])

  function handleInput(valueNext: string) {
    onChange(valueNext)
    const selection = editorRef.current?.selectionStart ?? 0
    const beforeCursor = valueNext.slice(0, selection)
    setFocusedLine(beforeCursor.split('\n').length)
  }

  function jumpToMatch() {
    const term = query.trim().toLowerCase()
    if (!term) return
    const index = value.toLowerCase().indexOf(term)
    if (index < 0) return
    editorRef.current?.focus()
    editorRef.current?.setSelectionRange(index, index + term.length)
    setFocusedLine(value.slice(0, index).split('\n').length)
  }

  return (
    <div className="code-editor-shell">
      <div className="code-editor-toolbar">
        <div className="code-editor-toolbar__left">
          <span className="code-editor-language">{language}</span>
          <span className="code-editor-toolbar__separator" />
          <label className="code-editor-search">
            <Icon name="search" size={12} />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  jumpToMatch()
                }
              }}
              placeholder="Find in file"
              aria-label="Find in file"
            />
            {query && <small>{matchCount} match{matchCount === 1 ? '' : 'es'}</small>}
          </label>
        </div>
        <div className="code-editor-toolbar__right"><button type="button" className={aiPanel ? 'code-editor-tool code-editor-tool--active' : 'code-editor-tool'} onClick={()=>setAiPanel(v=>!v)}><Icon name="spark" size={12}/> AI</button>
          <button type="button" className={wrap ? 'code-editor-tool code-editor-tool--active' : 'code-editor-tool'} onClick={() => setWrap((current) => !current)} title="Toggle word wrap">
            <Icon name="layout" size={12} /> Wrap
          </button>
          <button type="button" className={minimap ? 'code-editor-tool code-editor-tool--active' : 'code-editor-tool'} onClick={() => setMinimap((current) => !current)} title="Toggle minimap">
            Mini
          </button>
          <button type="button" className="code-editor-tool" onClick={onSave} title="Save · Ctrl+S">
            <Icon name="check" size={12} /> Save
          </button>
        </div>
      </div>

      {aiPanel && <div className="code-editor-ai-panel"><div><span className="eyebrow">AI coding actions</span><strong>{filePath}</strong><small>Scoped to {selection.toLowerCase()} · review before apply</small></div><div>{['Explain selection','Refactor safely','Generate tests','Find edge cases','Add types','Fix diagnostics'].map(action=><button type="button" key={action} onClick={()=>onSave?.() || setDiagnostics(true)}>{action}</button>)}</div><select value={selection} onChange={e=>setSelection(e.target.value)} aria-label="AI context scope"><option>Current selection</option><option>Current file</option><option>Related files</option><option>Project context</option></select></div>}
      <div className={wrap ? 'code-editor code-editor--rich code-editor--wrap' : 'code-editor code-editor--rich'}>
        <div className="line-numbers" aria-hidden="true">
          {lines.map((_, index) => (
            <span key={index} className={focusedLine === index + 1 ? 'line-number--active' : ''}>{index + 1}</span>
          ))}
        </div>
        <textarea
          ref={editorRef}
          value={value}
          onChange={(event) => handleInput(event.target.value)}
          onClick={() => {
            const selection = editorRef.current?.selectionStart ?? 0
            setFocusedLine(value.slice(0, selection).split('\n').length)
          }}
          onKeyUp={() => {
            const selection = editorRef.current?.selectionStart ?? 0
            setFocusedLine(value.slice(0, selection).split('\n').length)
          }}
          spellCheck={false}
          wrap={wrap ? 'soft' : 'off'}
          aria-label={`Code editor: ${filePath}`}
        />
        {minimap && <div className="code-editor-minimap" aria-hidden="true">
          {lines.slice(0, 90).map((line, index) => <i key={index} style={{ width: `${Math.min(96, Math.max(14, line.length * 2))}%` }} />)}
        </div>}
      </div>

      {diagnostics && <div className="code-editor-diagnostics"><span><Icon name="check" size={11}/> 0 errors</span><span><Icon name="info" size={11}/> 2 suggestions</span><button type="button" onClick={()=>setDiagnostics(false)}>Hide diagnostics</button></div>}
      <div className="editor-status editor-status--rich">
        <span>Ln {focusedLine}, Col 1</span>
        <span>{language}</span>
        <span>{value.length.toLocaleString()} chars</span>
        <span>{showDiff ? 'Diff review' : 'Local draft'}</span>
        <span className="editor-status__spacer" />
        <span>Ctrl+F Find</span>
        <span>Ctrl+S Save</span>
      </div>
    </div>
  )
}
