import { useEffect, useState } from 'react'
import { runtime } from '../../services/runtime'
import Icon from '../../components/Icon'

type WorkflowStepKind = 'trigger' | 'agent' | 'tool' | 'condition' | 'approval' | 'handoff'

type Step = { id: string; kind: WorkflowStepKind; title: string; detail: string; status: 'ready' | 'active' | 'blocked' }

const initialSteps: Step[] = [
  { id: 's1', kind: 'trigger', title: 'Git change detected', detail: 'Start when selected workspace changes', status: 'ready' },
  { id: 's2', kind: 'agent', title: 'Builder agent', detail: 'Inspect, plan and propose implementation', status: 'ready' },
  { id: 's3', kind: 'tool', title: 'Run verification', detail: 'Frontend build + targeted tests', status: 'ready' },
  { id: 's4', kind: 'condition', title: 'Quality gate', detail: 'Continue only when checks pass', status: 'blocked' },
  { id: 's5', kind: 'approval', title: 'Human approval', detail: 'Required for high-risk mutations', status: 'blocked' },
  { id: 's6', kind: 'handoff', title: 'Prepare delivery', detail: 'Artifact + summary + branch handoff', status: 'ready' },
]

const kindIcons: Record<WorkflowStepKind, 'clock' | 'bot' | 'tool' | 'shield' | 'check' | 'send'> = {
  trigger: 'clock',
  agent: 'bot',
  tool: 'tool',
  condition: 'check',
  approval: 'shield',
  handoff: 'send',
}

const kindLabels: Record<WorkflowStepKind, string> = {
  trigger: 'Trigger',
  agent: 'Agent',
  tool: 'Tool',
  condition: 'Condition',
  approval: 'Approval',
  handoff: 'Handoff',
}

export default function WorkflowBuilder({ onAction }: { onAction: (message: string) => void }) {
  const [steps, setSteps] = useState(initialSteps)
  const [selectedId, setSelectedId] = useState('s2')
  const [enabled, setEnabled] = useState(true)
  const [runtimeSyncing, setRuntimeSyncing] = useState(true)
  const [runtimeWorkflowId, setRuntimeWorkflowId] = useState<string | null>(null)
  const [runtimeState, setRuntimeState] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    let cancelled = false
    void runtime.workflows.list().then((remoteWorkflows) => {
      if (cancelled || remoteWorkflows.length === 0) return
      const workflow = remoteWorkflows[0]
      const remoteId = typeof workflow.workflow_id === 'string' ? workflow.workflow_id : typeof workflow.id === 'string' ? workflow.id : 'runtime-workflow'
      setRuntimeWorkflowId(remoteId)
      const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : []
      if (nodes.length > 0) {
        const mapped = nodes.map((node, index) => ({
          id: typeof node.id === 'string' ? node.id : `remote-${index + 1}`,
          kind: ['trigger','agent','tool','condition','approval','handoff'].includes(String(node.kind)) ? String(node.kind) as WorkflowStepKind : 'tool',
          title: typeof node.title === 'string' ? node.title : typeof node.name === 'string' ? node.name : `Runtime step ${index + 1}`,
          detail: typeof node.detail === 'string' ? node.detail : 'Runtime workflow node',
          status: 'ready' as const,
        }))
        setSteps(mapped)
        setSelectedId(mapped[0].id)
      }
      if (typeof workflow.enabled === 'boolean') setEnabled(workflow.enabled)
      onAction(`Loaded workflow ${remoteId} from runtime`)
    }).catch(() => {
      // Keep the local workflow draft while runtime is unavailable.
    }).finally(() => { if (!cancelled) setRuntimeSyncing(false) })
    return () => { cancelled = true }
  }, [])

  const selected = steps.find((step) => step.id === selectedId) ?? steps[0]

  function addStep() {
    const id = 's' + (steps.length + 1)
    const next: Step = { id, kind: 'tool', title: 'New tool step', detail: 'Configure capability and inputs', status: 'ready' }
    setSteps((current) => [...current, next])
    setSelectedId(id)
    onAction('Workflow step added locally')
  }

  async function saveRuntimeWorkflow() {
    const workflowId = runtimeWorkflowId ?? `workflow-${Date.now()}`
    try {
      const saved = await runtime.workflows.create({
        workflow_id: workflowId,
        name: 'AgentiCOS workflow',
        nodes: steps.map((step, index) => ({
          id: step.id,
          task: step.detail || step.title,
          depends_on: index === 0 ? [] : [steps[index - 1].id],
        })),
      })
      setRuntimeWorkflowId(typeof saved.workflow_id === 'string' ? saved.workflow_id : workflowId)
      onAction('Workflow saved to runtime')
      const state = await runtime.workflows.start(workflowId)
      setRuntimeState(state)
    } catch (error) {
      onAction(error instanceof Error ? error.message : 'Workflow save failed')
    }
  }

  async function startRuntimeWorkflow() {
    if (!runtimeWorkflowId) {
      await saveRuntimeWorkflow()
      return
    }
    try {
      const state = await runtime.workflows.start(runtimeWorkflowId)
      setRuntimeState(state)
      onAction('Workflow state initialized in runtime')
    } catch (error) {
      onAction(error instanceof Error ? error.message : 'Workflow start failed')
    }
  }

  async function transitionSelected(nextState: 'Ready' | 'Running' | 'Succeeded' | 'Failed') {
    if (!runtimeWorkflowId) {
      onAction('Save the workflow to runtime first')
      return
    }
    try {
      const state = await runtime.workflows.transition(runtimeWorkflowId, selected.id, nextState)
      setRuntimeState(state)
      setSteps((current) => current.map((step) => step.id === selected.id ? {
        ...step,
        status: nextState === 'Running' ? 'active' : nextState === 'Failed' ? 'blocked' : 'ready',
      } : step))
      onAction(`${selected.title} transitioned to ${nextState}`)
    } catch (error) {
      onAction(error instanceof Error ? error.message : 'Workflow transition failed')
    }
  }

  function moveSelected(direction: -1 | 1) {
    const index = steps.findIndex((step) => step.id === selectedId)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= steps.length) return
    setSteps((current) => {
      const copy = [...current]
      const [item] = copy.splice(index, 1)
      copy.splice(nextIndex, 0, item)
      return copy
    })
    onAction('Workflow step reordered in preview')
  }

  return (
    <div className="workflow-builder">
      <aside className="workflow-builder__sidebar">
        <div className="workflow-builder__sidebar-head"><div><span className="eyebrow">Workflow · {runtimeSyncing ? 'syncing' : 'runtime'}</span><strong>Frontend delivery</strong></div><span className={enabled ? 'state-pill state-pill--active' : 'state-pill state-pill--pending'}>{enabled ? 'Enabled' : 'Paused'}</span></div>
        <div className="workflow-builder__steps">
          {steps.map((step, index) => (
            <button type="button" key={step.id} className={selectedId === step.id ? 'workflow-builder__step workflow-builder__step--active' : 'workflow-builder__step'} onClick={() => setSelectedId(step.id)}>
              <span className="workflow-builder__step-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="workflow-builder__step-icon"><Icon name={kindIcons[step.kind]} size={13} /></span>
              <span><strong>{step.title}</strong><small>{kindLabels[step.kind]}</small></span>
              <span className={'workflow-builder__status workflow-builder__status--' + step.status} />
            </button>
          ))}
        </div>
        <button className="studio-button" type="button" onClick={addStep}><Icon name="plus" size={13} /> Add step</button>
      </aside>

      <section className="workflow-builder__canvas">
        <div className="workflow-builder__toolbar">
          <div><span className="mono-text">{runtimeWorkflowId ? `workflow://${runtimeWorkflowId}` : 'workflow://draft'}</span><span className="state-pill state-pill--completed">Draft saved</span></div>
          <div className="workflow-builder__toolbar-actions">
            <button className="studio-button" type="button" onClick={() => moveSelected(-1)}><Icon name="arrow-up" size={13} /> Up</button>
            <button className="studio-button" type="button" onClick={() => moveSelected(1)}><Icon name="arrow-down" size={13} /> Down</button>
            <button className="studio-button" type="button" onClick={() => void saveRuntimeWorkflow()}><Icon name="save" size={13} /> Save runtime</button>
            <button className="studio-button studio-button--active" type="button" onClick={() => void startRuntimeWorkflow()}><Icon name="play" size={13} /> Start</button>
            <button className={enabled ? 'studio-button studio-button--active' : 'studio-button'} type="button" onClick={() => setEnabled((value) => !value)}>{enabled ? 'Pause UI' : 'Enable UI'}</button>
          </div>
        </div>
        <div className="workflow-builder__flow">
          {steps.map((step, index) => (
            <div className="workflow-builder__node-wrap" key={step.id}>
              <button type="button" className={selectedId === step.id ? 'workflow-node workflow-node--active' : 'workflow-node'} onClick={() => setSelectedId(step.id)}>
                <span className="workflow-node__kind"><Icon name={kindIcons[step.kind]} size={14} /> {kindLabels[step.kind]}</span>
                <strong>{step.title}</strong>
                <small>{step.detail}</small>
                <span className={'workflow-node__status workflow-node__status--' + step.status}>{step.status}</span>
              </button>
              {index < steps.length - 1 && <div className="workflow-connector" aria-hidden="true"><span>↓</span></div>}
            </div>
          ))}
        </div>
      </section>

      <aside className="workflow-builder__inspector">
        <div className="workflow-builder__inspector-head"><span className="eyebrow">Step inspector</span><strong>{selected.title}</strong></div>
        <label className="workflow-field"><span>Type</span><select value={selected.kind} onChange={(event) => {
          const kind = event.target.value as WorkflowStepKind
          setSteps((current) => current.map((step) => step.id === selected.id ? { ...step, kind } : step))
        }}>{Object.entries(kindLabels).map(([kind, label]) => <option value={kind} key={kind}>{label}</option>)}</select></label>
        <label className="workflow-field"><span>Step name</span><input defaultValue={selected.title} onChange={(event) => setSteps((current) => current.map((step) => step.id === selected.id ? { ...step, title: event.target.value } : step))} /></label>
        <label className="workflow-field"><span>Instruction</span><textarea defaultValue={selected.detail} onChange={(event) => setSteps((current) => current.map((step) => step.id === selected.id ? { ...step, detail: event.target.value } : step))} /></label>
        <div className="workflow-inspector-group"><span>Runtime policy</span><div><span>Context</span><strong>Explicit</strong></div><div><span>Failure</span><strong>Fail closed</strong></div><div><span>Approval</span><strong>{selected.kind === 'approval' ? 'Required' : 'Policy based'}</strong></div><div><span>Runtime version</span><strong>{runtimeState && typeof runtimeState.version === 'number' ? String(runtimeState.version) : '—'}</strong></div></div>
        <div className="platform-actions"><button className="studio-button" type="button" onClick={() => void transitionSelected('Ready')}>Mark ready</button><button className="studio-button" type="button" onClick={() => void transitionSelected('Running')}><Icon name="play" size={13} /> Run step</button><button className="studio-button studio-button--active" type="button" onClick={() => void transitionSelected('Succeeded')}><Icon name="check" size={13} /> Complete step</button></div>
      </aside>
    </div>
  )
}
