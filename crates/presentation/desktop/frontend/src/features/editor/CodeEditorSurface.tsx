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
  const [replaceText, setReplaceText] = useState('')
  const [findOpen, setFindOpen] = useState(false)
  const [matchCase, setMatchCase] = useState(false)
  const [wrap, setWrap] = useState(false)
  const [minimap, setMinimap] = useState(false)
  const [gotoLineOpen, setGotoLineOpen] = useState(false)
  const [gotoLine, setGotoLine] = useState('1')
  const [focusedLine, setFocusedLine] = useState(1)
  const [focusedColumn, setFocusedColumn] = useState(1)
  const [dirty, setDirty] = useState(false)

  const lines = useMemo(() => value.split('\n'), [value])
  const language = filePath.endsWith('.rs')
    ? 'Rust'
    : filePath.endsWith('.md')
      ? 'Markdown'
      : filePath.endsWith('.json')
        ? 'JSON'
        : 'TypeScript React'

  const matchRanges = useMemo(() => {
    const term = query.trim()
    if (!term) return [] as Array<[number, number]>
    const haystack = matchCase ? value : value.toLowerCase()
    const needle = matchCase ? term : term.toLowerCase()
    const ranges: Array<[number, number]> = []
    let offset = 0
    while (offset <= haystack.length) {
      const index = haystack.indexOf(needle, offset)
      if (index < 0) break
      ranges.push([index, index + needle.length])
      offset = index + Math.max(needle.length, 1)
    }
    return ranges
  }, [matchCase, query, value])
  const matchCount = matchRanges.length
  const matchIndex = useMemo(() => {
    const cursor = editorRef.current?.selectionStart ?? 0
    const index = matchRanges.findIndex(([start, end]) => cursor >= start && cursor <= end)
    return index < 0 ? 0 : index
  }, [matchRanges, focusedColumn, focusedLine])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setFindOpen(true)
        searchRef.current?.focus()
        searchRef.current?.select()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'h') {
        event.preventDefault()
        setFindOpen(true)
        searchRef.current?.focus()
        searchRef.current?.select()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'g') {
        event.preventDefault()
        setGotoLineOpen(true)
        setGotoLine(String(focusedLine))
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (onSave) onSave()
        setDirty(false)
      }
      if (event.key === 'Escape') {
        if (gotoLineOpen) setGotoLineOpen(false)
        else if (findOpen) setFindOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSave])

  function syncCursor() {
    const selection = editorRef.current?.selectionStart ?? 0
    const beforeCursor = value.slice(0, selection)
    const lastBreak = beforeCursor.lastIndexOf('\n')
    setFocusedLine(beforeCursor.split('\n').length)
    setFocusedColumn(selection - lastBreak)
  }

  function handleInput(valueNext: string) {
    onChange(valueNext)
    setDirty(true)
    const selection = editorRef.current?.selectionStart ?? 0
    const beforeCursor = valueNext.slice(0, selection)
    const lastBreak = beforeCursor.lastIndexOf('\n')
    setFocusedLine(beforeCursor.split('\n').length)
    setFocusedColumn(selection - lastBreak)
  }

  function selectRange(start: number, end: number) {
    requestAnimationFrame(() => {
      editorRef.current?.focus()
      editorRef.current?.setSelectionRange(start, end)
      syncCursor()
    })
  }

  function moveMatch(direction: 1 | -1) {
    if (!matchRanges.length) return
    const cursor = editorRef.current?.selectionStart ?? 0
    const current = matchRanges.findIndex(([start]) => start >= cursor)
    const next = direction > 0
      ? (current < 0 ? 0 : (current + (matchRanges[current]?.[0] === cursor ? 1 : 0)) % matchRanges.length)
      : (current <= 0 ? matchRanges.length - 1 : current - 1)
    const [start, end] = matchRanges[next]
    selectRange(start, end)
  }

  function replaceCurrent() {
    const current = matchRanges[matchIndex]
    if (!current) return
    const [start, end] = current
    const nextValue = value.slice(0, start) + replaceText + value.slice(end)
    onChange(nextValue)
    setDirty(true)
    selectRange(start, start + replaceText.length)
  }

  function replaceAll() {
    const term = query.trim()
    if (!term) return
    const haystack = matchCase ? value : value.toLowerCase()
    const needle = matchCase ? term : term.toLowerCase()
    let result = ''
    let cursor = 0
    while (cursor <= haystack.length) {
      const index = haystack.indexOf(needle, cursor)
      if (index < 0) {
        result += value.slice(cursor)
        break
      }
      result += value.slice(cursor, index) + replaceText
      cursor = index + needle.length
    }
    onChange(result)
    setDirty(true)
  }

  function goToLine() {
    const target = Math.min(lines.length, Math.max(1, Number.parseInt(gotoLine, 10) || 1))
    let offset = 0
    for (let index = 1; index < target; index += 1) offset += (lines[index - 1]?.length ?? 0) + 1
    setGotoLine(String(target))
    setGotoLineOpen(false)
    selectRange(offset, offset)
    setFocusedLine(target)
    setFocusedColumn(1)
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
                  moveMatch(event.shiftKey ? -1 : 1)
                } else if (event.key === 'Escape') {
                  setFindOpen(false)
                }
              }}
              placeholder="Find in file"
              aria-label="Find in file"
              aria-expanded={findOpen}
              onFocus={() => setFindOpen(true)}
            />
            {query && <small>{matchCount} match{matchCount === 1 ? '' : 'es'}</small>}
          </label>
        </div>
        <div className="code-editor-toolbar__right">
          {findOpen && <div className="code-editor-find-tools">
            <button type="button" className="code-editor-tool" onClick={() => moveMatch(-1)} title="Previous match">Prev</button>
            <button type="button" className="code-editor-tool" onClick={() => moveMatch(1)} title="Next match">Next</button>
            <button type="button" className={matchCase ? 'code-editor-tool code-editor-tool--active' : 'code-editor-tool'} aria-pressed={matchCase} onClick={() => setMatchCase((value) => !value)} title="Match case">Aa</button>
            <input value={replaceText} onChange={(event) => setReplaceText(event.target.value)} placeholder="Replace…" aria-label="Replace text" />
            <button type="button" className="code-editor-tool" onClick={replaceCurrent} disabled={!matchCount} title="Replace current match">Replace</button>
            <button type="button" className="code-editor-tool" onClick={replaceAll} disabled={!matchCount} title="Replace all matches">All</button>
            <button type="button" className="code-editor-tool" onClick={() => setFindOpen(false)} aria-label="Close find and replace" title="Close find and replace"><Icon name="x" size={12} /></button>
          </div>}
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

      {gotoLineOpen && <div className="code-editor-goto">
        <label>Go to line <input autoFocus value={gotoLine} onChange={(event) => setGotoLine(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); goToLine() } if (event.key === 'Escape') setGotoLineOpen(false) }} /></label>
        <button type="button" className="code-editor-tool" onClick={goToLine}>Go</button>
      </div>}

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
          onClick={syncCursor}
          onKeyUp={syncCursor}
          onSelect={syncCursor}
          spellCheck={false}
          wrap={wrap ? 'soft' : 'off'}
          aria-label={`Code editor: ${filePath}`}
        />
        {minimap && <div className="code-editor-minimap" aria-hidden="true">
          {lines.slice(0, 90).map((line, index) => <i key={index} style={{ width: `${Math.min(96, Math.max(14, line.length * 2))}%` }} />)}
        </div>}
      </div>

      <div className="editor-status editor-status--rich">
        <span>Ln {focusedLine}, Col {focusedColumn}</span>
        <span className={dirty ? "editor-status__dirty" : ""}>{dirty ? "Unsaved changes" : "Saved"}</span>
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
