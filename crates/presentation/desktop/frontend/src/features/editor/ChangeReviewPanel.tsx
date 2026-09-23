import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'

type ReviewState = 'pending' | 'approved' | 'rejected'

const files = [
  ['ChatSurface.tsx', '4 hunks', '+32 / -4'],
  ['AgentPanel.tsx', '2 hunks', '+28 / -8'],
  ['index.css', '7 hunks', '+184 / -6'],
]

const hunks = [
  ['ChatSurface.tsx', 'Context controls', '+18 / -2', 'Add explicit context scope and agent mode controls.'],
  ['ChatSurface.tsx', 'Composer actions', '+14 / -2', 'Expose background, checkpoint and branch actions.'],
  ['AgentPanel.tsx', 'Inspector tabs', '+22 / -6', 'Split agent, context, task and safety views.'],
  ['index.css', 'Design tokens', '+36 / -0', 'Formalize monochrome product tokens.'],
]

export default function ChangeReviewPanel({ onClose, onAction }: { onClose: () => void; onAction: (message: string) => void }) {
  const [states, setStates] = useState<Record<string, ReviewState>>({})
  const [comments, setComments] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState('ChatSurface.tsx')
  const [comment, setComment] = useState('')

  const summary = useMemo(() => {
    const values = Object.values(states)
    return { approved: values.filter((value) => value === 'approved').length, rejected: values.filter((value) => value === 'rejected').length, pending: hunks.length - values.filter((value) => value !== undefined).length }
  }, [states])

  function setState(key: string, state: ReviewState) {
    setStates((current) => ({ ...current, [key]: state }))
  }

  function addComment() {
    const value = comment.trim()
    if (!value) return
    setComments((current) => ({ ...current, [selected]: value }))
    setComment('')
    onAction('Review comment added in preview')
  }

  function approveAll() {
    const next: Record<string, ReviewState> = {}
    for (const [, , , description] of hunks) next[description] = 'approved'
    setStates(next)
    onAction('All change hunks approved in preview')
  }

  return (
    <aside className="change-review-panel" aria-label="Change review">
      <div className="change-review-panel__head">
        <div><span className="eyebrow">Change control</span><strong>Review changes</strong><small>Inspect and annotate local preview diffs before handoff.</small></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close review"><Icon name="x" size={14} /></button>
      </div>
      <div className="change-review-summary">
        <div><span>Pending</span><strong>{summary.pending}</strong></div>
        <div><span>Approved</span><strong>{summary.approved}</strong></div>
        <div><span>Rejected</span><strong>{summary.rejected}</strong></div>
      </div>
      <div className="change-review-body">
        <div className="change-review-files">
          <div className="surface-block__heading"><span>Files</span><span className="mono-text">{files.length}</span></div>
          {files.map(([file, count, delta]) => <button type="button" key={file} className={selected === file ? 'change-review-file change-review-file--active' : 'change-review-file'} onClick={() => setSelected(file)}><div><strong>{file}</strong><span>{count}</span></div><small>{delta}</small></button>)}
        </div>
        <div className="change-review-hunks">
          <div className="surface-block__heading"><span>Hunks</span><span className="mono-text">preview</span></div>
          {hunks.filter(([file]) => file === selected).map(([file, title, delta, description]) => {
            const state = states[description] ?? 'pending'
            return <div className="change-hunk" key={title}><div className="change-hunk__top"><div><strong>{title}</strong><span>{file} · {delta}</span></div><span className={state === 'approved' ? 'state-pill state-pill--completed' : state === 'rejected' ? 'state-pill state-pill--pending' : 'state-pill state-pill--active'}>{state}</span></div><p>{description}</p><pre>@@ {title.toLowerCase().replace(/ /g, '_')}
- previous implementation
+ proposed frontend behavior</pre><div className="change-hunk__actions"><button className="icon-button" type="button" title="Reject hunk" onClick={() => setState(description, 'rejected')}><Icon name="x" size={13} /></button><button className="icon-button" type="button" title="Approve hunk" onClick={() => setState(description, 'approved')}><Icon name="check" size={13} /></button></div>{comments[description] && <div className="change-comment"><Icon name="message" size={12} /><span>{comments[description]}</span></div>}</div>
          })}
          {hunks.filter(([file]) => file === selected).length === 0 && <div className="review-empty">No hunks for this file in the preview.</div>}
        </div>
      </div>
      <div className="change-review-comment">
        <input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addComment() }} placeholder="Add review comment…" aria-label="Add review comment" />
        <button className="studio-button" type="button" onClick={addComment}><Icon name="message" size={13} /> Comment</button>
      </div>
      <div className="change-review-panel__foot">
        <button className="studio-button" type="button" onClick={() => onAction('Review request sent in preview')}>Request review</button>
        <button className="studio-button studio-button--active" type="button" onClick={approveAll}><Icon name="check" size={13} /> Approve all</button>
      </div>
    </aside>
  )
}
