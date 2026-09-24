import { useEffect, useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { runtime } from '../../services/runtime'
import type { RuntimeApiRecord } from '../../types/runtime'
import { MetricCard } from './PlatformPrimitives'

type RuntimeProbePanelProps = { mode: string; onAction: (message: string) => void }
type ProbeState = { health: string; ready: string; summary: string; records: RuntimeApiRecord[] }

function asText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === undefined || value === null) return '—'
  return JSON.stringify(value)
}

export default function RuntimeProbePanel({ mode, onAction }: RuntimeProbePanelProps) {
  const [state, setState] = useState<ProbeState>({ health: 'Checking…', ready: 'Checking…', summary: 'No runtime probe yet', records: [] })
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')

  const probeTarget = useMemo(() => {
    if (mode === 'evaluations') return 'Evaluation cases'
    if (mode === 'audit' || mode === 'logs') return 'Audit events'
    if (mode === 'analytics' || mode === 'usage' || mode === 'token-observatory') return 'Runtime telemetry'
    if (mode === 'batch' || mode === 'background' || mode === 'tasks') return 'Scheduler jobs'
    if (mode === 'playground') return 'Live models'
    if (mode === 'routing') return 'Provider routes'
    if (mode === 'execution' || mode === 'environment-lab') return 'Sandbox'
    if (mode === 'knowledge' || mode === 'imports') return 'Source forge'
    if (mode === 'integrations') return 'A2A Agent Card'
    if (mode === 'sessions') return 'Conversation search'
    return 'Runtime health'
  }, [mode])

  async function refresh() {
    setBusy(true)
    try {
      const [health, ready] = await Promise.allSettled([runtime.health.get(), runtime.health.ready()])
      const next: ProbeState = {
        health: health.status === 'fulfilled' ? asText(health.value.status) : 'Offline',
        ready: ready.status === 'fulfilled' ? asText(ready.value.status) : 'Unavailable',
        summary: 'Runtime reachable',
        records: [],
      }
      if (mode === 'evaluations') {
        const records = await runtime.evaluation.cases(); next.records = records; next.summary = `${records.length} evaluation cases`
      } else if (mode === 'audit' || mode === 'logs') {
        const records = await runtime.audit.list(100); next.records = records; next.summary = `${records.length} recent audit events`
      } else if (mode === 'analytics' || mode === 'usage' || mode === 'token-observatory') {
        const [metrics, usage] = await Promise.all([runtime.metrics.get(), runtime.usage.summary()]); next.records = [metrics, usage]; next.summary = `Telemetry: ${asText(metrics.status ?? metrics.runtime ?? 'available')}`
      } else if (mode === 'batch' || mode === 'background' || mode === 'tasks') {
        const records = await runtime.jobs.list(); next.records = records; next.summary = `${records.length} scheduler jobs`
      } else if (mode === 'playground') {
        const models = await runtime.models.list(); next.records = models as unknown as RuntimeApiRecord[]; next.summary = `${records.length} live models`
      } else if (mode === 'routing') {
        const records = await runtime.providers.list(); next.records = records as unknown as RuntimeApiRecord[]; next.summary = `${records.length} runtime providers`
      } else if (mode === 'execution' || mode === 'environment-lab') {
        const sandbox = await runtime.sandbox.status(); next.records = [sandbox]; next.summary = `Sandbox: ${asText(sandbox.status ?? sandbox.state ?? 'unknown')}`
      } else if (mode === 'knowledge' || mode === 'imports') {
        next.summary = 'Source forge endpoint available'
      } else if (mode === 'integrations') {
        const card = await runtime.a2a.agentCard()
        next.records = [card]
        next.summary = typeof card.name === 'string' ? card.name : 'A2A Agent Card available'
      } else if (mode === 'sessions') {
        next.summary = query.trim() ? 'Conversation search ready' : 'Enter a query to test conversation search'
      }
      setState(next)
    } catch (error) {
      setState((current) => ({ ...current, health: 'Error', ready: 'Error', summary: error instanceof Error ? error.message : 'Runtime probe failed' }))
    } finally { setBusy(false) }
  }

  useEffect(() => { void refresh() }, [mode])

  async function executeAction() {
    try {
      if (mode === 'playground') {
        const models = await runtime.models.list()
        const model = window.prompt('Model ID', models[0]?.model_id ?? '')?.trim()
        const input = window.prompt('Prompt to execute')?.trim()
        if (!model || !input) return
        const result = await runtime.models.execute(model, input)
        onAction(`Model execution completed: ${asText(result.response ?? result.model ?? 'response received')}`)
        return
      }
      if (mode === 'evaluations') {
        const cases = await runtime.evaluation.cases()
        const caseId = window.prompt('Evaluation case ID', String(cases[0]?.case_id ?? cases[0]?.id ?? ''))?.trim()
        const output = window.prompt('Candidate output to evaluate') ?? ''
        if (!caseId || !output) return
        const result = await runtime.evaluation.run(caseId, output)
        onAction(`Evaluation completed: ${asText(result)}`)
        return
      }
      if (mode === 'knowledge' || mode === 'imports') {
        const source = window.prompt('GitHub source (owner/repo or URL)')?.trim()
        if (!source) return
        const result = await runtime.source.inspect(source)
        onAction(`Source inspection completed: ${asText(result)}`)
        return
      }
      if (mode === 'integrations') {
        const textMessage = window.prompt('A2A message text')?.trim()
        if (!textMessage) return
        const result = await runtime.a2a.sendMessage({
          message_id: 'ui-' + Date.now(),
          role: 'user',
          parts: [{ text: textMessage }],
        })
        onAction(`A2A message sent: ${asText(result.id ?? result.task_id ?? result)}`)
        return
      }
      if (mode === 'sessions') {
        const search = query.trim() || window.prompt('Conversation search query')?.trim()
        if (!search) return
        const result = await runtime.conversations.search(search, 20)
        onAction(`Conversation search returned ${result.count} results`)
        return
      }
      const objective = window.prompt('Objective for a runtime planning probe')?.trim()
      if (!objective) return
      const plan = await runtime.reasoning.plan(objective)
      onAction(`Runtime plan generated: ${asText(plan.plan ?? plan)}`)
    } catch (error) { onAction(error instanceof Error ? error.message : 'Runtime action failed') }
  }

  async function createRuntimeRun() {
    const objective = window.prompt('Run objective')?.trim()
    if (!objective) return
    try {
      const run = await runtime.runs.create(objective, undefined, `ui-${Date.now()}`)
      onAction(`Run created: ${run.run_id}`)
      await refresh()
    } catch (error) { onAction(error instanceof Error ? error.message : 'Run creation failed') }
  }

  return (
    <section className='runtime-probe-panel' aria-label='Live runtime integration'>
      <div className='runtime-probe-panel__head'>
        <div><span className='eyebrow'>Backend integration</span><strong>Live runtime probe</strong><small>{probeTarget} · no presentation mock is used for the probe itself.</small></div>
        <div className='runtime-probe-panel__actions'>
          {mode === 'sessions' && <label className='feature-search'><Icon name='search' size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Conversation query…' /></label>}
          <button className='studio-button' type='button' disabled={busy} onClick={() => void refresh()}><Icon name='refresh' size={13} /> {busy ? 'Refreshing…' : 'Refresh'}</button>
          <button className='studio-button studio-button--active' type='button' onClick={() => void executeAction()}><Icon name={mode === 'playground' ? 'play' : 'search'} size={13} /> Test runtime</button>
          <button className='studio-button' type='button' onClick={() => void createRuntimeRun()}><Icon name='plus' size={13} /> Create run</button>
        </div>
      </div>
      <div className='runtime-probe-panel__metrics'>
        <MetricCard label='Health' value={state.health} sub='GET /health' />
        <MetricCard label='Readiness' value={state.ready} sub='GET /ready' />
        <MetricCard label='Probe' value={state.summary} sub={probeTarget} />
        <MetricCard label='Records' value={String(state.records.length)} sub='Bounded response' />
      </div>
      {state.records.length > 0 && <div className='runtime-probe-panel__records'>{state.records.slice(0, 8).map((record, index) => {
        const identifier = typeof record.id === 'string' ? record.id : typeof record.run_id === 'string' ? record.run_id : typeof record.provider_id === 'string' ? record.provider_id : typeof record.name === 'string' ? record.name : `record-${index + 1}`
        const detail = typeof record.description === 'string' ? record.description : typeof record.state === 'string' ? record.state : typeof record.status === 'string' ? record.status : 'Runtime record'
        return <div className='runtime-probe-panel__record' key={identifier + index}><span>{String(index + 1).padStart(2, '0')}</span><strong>{identifier}</strong><small>{detail}</small></div>
      })}</div>}
    </section>
  )
}