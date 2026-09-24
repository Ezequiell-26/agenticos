import { useState } from 'react'
import Icon from '../../components/Icon'
import { MetricCard, Panel, Tag } from './PlatformPrimitives'
import { runtime } from '../../services/runtime'
import type { RuntimeApiRecord } from '../../types/runtime'

type TaskState = 'running' | 'queued' | 'blocked' | 'complete'
type TaskFilter = 'all' | TaskState
const initialTasks=[
  ['TASK-042','Implement frontend orchestration surface','Builder','running','feature/ui-orchestration'],
  ['TASK-043','Review navigation and type safety','Reviewer','queued','feature/ui-orchestration'],
  ['TASK-044','Run targeted verification','QA','blocked','feature/ui-orchestration'],
  ['TASK-045','Prepare evidence package','Release','queued','feature/ui-orchestration'],
] as const
const terminals=[
  ['shell-01','PowerShell','Workspace root','running'],
  ['shell-02','Agent sandbox','Git worktree','idle'],
  ['shell-03','Verification','CI preview','running'],
] as const
const logs=[
  ['08:24:11','task','TASK-042','Agent selected files for implementation'],
  ['08:24:34','command','shell-01','git status --short'],
  ['08:25:03','tool','MCP/filesystem','Read 6 files'],
  ['08:25:41','policy','approval','Write operation classified as allowed'],
  ['08:26:09','test','shell-03','Targeted frontend check queued'],
]

export function TaskExecutionCenter({onAction}:{onAction:(message:string)=>void}){
 const [selected,setSelected]=useState<string>(initialTasks[0][0])
 const [taskState,setTaskState]=useState<Record<string,TaskState>>({})
 const [terminal,setTerminal]=useState<string>(terminals[0][0])
 const [logFilter,setLogFilter]=useState('')
 const [taskFilter,setTaskFilter]=useState<TaskFilter>('all')
 const [queuePaused,setQueuePaused]=useState(false)
 const [liveJobs,setLiveJobs]=useState<RuntimeApiRecord[]>([])
 const [runtimeSyncing,setRuntimeSyncing]=useState(true)
 const current=initialTasks.find(([id])=>id===selected)??initialTasks[0]
 const state=(id:string,base:TaskState)=>taskState[id]??base
 const runtimeJobRows=liveJobs.map((job,index)=>({
   id: typeof job.job_id==='string' ? job.job_id : 'JOB-'+String(index+1).padStart(3,'0'),
   title: typeof job.task==='string' ? job.task : 'Runtime scheduler job',
   owner: typeof job.lease_owner==='string' ? job.lease_owner : 'Scheduler',
   state: typeof job.state==='string' ? job.state.toLowerCase() : 'queued',
   branch: typeof job.run_id==='string' ? job.run_id : 'runtime',
 }))
 const displayTasks=runtimeJobRows.length>0 ? runtimeJobRows : initialTasks.map(([id,title,owner,base,branch])=>({id,title,owner,state:base,branch}))
 const selectedRuntimeJob=runtimeJobRows.find((job)=>job.id===selected)??runtimeJobRows[0]
 const filteredTasks=displayTasks.filter(([id,, ,base])=>taskFilter==='all'||state(id,base as TaskState)===taskFilter)
 const counts=displayTasks.reduce((acc,[id,,,base])=>{const key=state(id,base as TaskState); acc[key]+=1; return acc},{running:0,queued:0,blocked:0,complete:0} as Record<TaskState,number>)
 const selectedState=selectedRuntimeJob ? (selectedRuntimeJob.state==='running'?'running':selectedRuntimeJob.state==='succeeded'?'complete':selectedRuntimeJob.state==='failed'?'blocked':selectedRuntimeJob.state==='cancelled'?'complete':selectedRuntimeJob.state==='ready'||selectedRuntimeJob.state==='pending'?'queued':selectedRuntimeJob.state as TaskState) : state(current[0],current[3] as TaskState)
 const filteredLogs=logs.filter(item=>!logFilter||item.join(' ').toLowerCase().includes(logFilter.toLowerCase()))
 const act=(message:string)=>onAction(message+' staged in preview')
 const refreshJobs=async()=>{
   setRuntimeSyncing(true)
   try {
     const jobs=await runtime.jobs.list()
     setLiveJobs(jobs)
     if(jobs.length>0){
       const first=jobs[0]
       const id=typeof first.job_id==='string'?first.job_id:''
       if(id) setSelected((currentId)=>jobs.some((job)=>job.job_id===currentId)?currentId:id)
     }
     onAction('Scheduler jobs refreshed from runtime')
   } catch(error){ onAction(error instanceof Error?error.message:'Scheduler refresh failed') }
   finally{ setRuntimeSyncing(false) }
 }
 const transitionSelected=(next:TaskState, action:string)=>{setTaskState((v)=>({...v,[selected]:next}));act(action)}
 useEffect(()=>{void refreshJobs()},[])

 return <div className="task-execution">
  <header className="task-execution__hero"><div><span className="eyebrow">Execution workspace</span><h1>Task Execution Center</h1><p>Operate task queues, terminals, processes, approvals, logs and evidence from one bounded execution workspace.</p></div><div className="task-execution__actions"><Tag label={runtimeSyncing?'Syncing runtime':'Scheduler runtime'}/><button className="studio-button" type="button" onClick={()=>void refreshJobs()}>Refresh jobs</button><button className="studio-button" type="button" onClick={()=>{setQueuePaused(true);act('Pause all tasks')}}><Icon name="stop" size={13}/>{queuePaused?'Queue paused':'Pause all'}</button><button className="studio-button studio-button--active" type="button" onClick={()=>{setQueuePaused(false);act('Resume queue')}}><Icon name="play" size={13}/>Resume queue</button></div></header>
  <div className="platform-metrics"><MetricCard label="Tasks" value={counts.running + ' active'} sub={counts.queued + ' queued · ' + counts.blocked + ' blocked'}/><MetricCard label="Terminals" value="Runtime" sub="Use integrated terminal for sessions"/><MetricCard label="Approvals" value={counts.blocked ? String(counts.blocked) : '0'} sub={counts.blocked ? 'Execution gates pending' : 'No blocked tasks'}/><MetricCard label="Jobs source" value={liveJobs.length>0?'Live':'Fallback'} sub={liveJobs.length>0?'Scheduler API':'Presentation fixture'}/></div>

  <div className="task-execution__layout">
   <Panel title="Task queue">
    <div className="task-execution__filters" role="tablist" aria-label="Task queue filters" aria-orientation="horizontal">{(['all','running','queued','blocked','complete'] as TaskFilter[]).map((filter,index,tabs) => <button type="button" role="tab" id={'task-filter-tab-' + filter} tabIndex={taskFilter===filter?0:-1} aria-selected={taskFilter===filter} aria-controls="task-filter-panel" className={taskFilter===filter?'task-filter task-filter--active':'task-filter'} key={filter} onClick={()=>setTaskFilter(filter)} onKeyDown={(event)=>{const nextIndex=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index-1+tabs.length)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:-1;if(nextIndex>=0){event.preventDefault();const next=tabs[nextIndex];setTaskFilter(next);window.requestAnimationFrame(()=>document.getElementById('task-filter-tab-'+next)?.focus())}}}>{filter}<span>{filter==='all'?initialTasks.length:counts[filter]}</span></button>)}</div>
    <div id="task-filter-panel" className="task-execution__task-list" role="tabpanel" aria-labelledby={'task-filter-tab-' + taskFilter} tabIndex={0}>{filteredTasks.map(({id,title,owner,state:base,branch})=><button type="button" key={id} className={selected===id?'task-row task-row--active':'task-row'} onClick={()=>setSelected(id)}><span className={'task-state task-state--'+state(id,base as TaskState)}><Icon name={state(id,base as TaskState)==='complete'?'check':state(id,base as TaskState)==='blocked'?'lock':state(id,base as TaskState)==='running'?'activity':'clock'} size={12}/></span><span><strong>{title}</strong><small>{id} · {owner} · {branch}</small></span><span className="mono-text">{state(id,base as TaskState)}</span></button>)}</div>
    <div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Open task plan')}>Plan</button><button className="studio-button" type="button" onClick={()=>act('Delegate task')}>Delegate</button>{liveJobs.some((job)=>job.job_id===selected) ? <button className="studio-button studio-button--active" type="button" onClick={()=>void runtime.jobs.cancel(selected).then(()=>refreshJobs()).catch((error)=>onAction(error instanceof Error?error.message:'Job cancellation failed'))}><Icon name="stop" size={12}/>Cancel job</button> : <button className="studio-button" type="button" onClick={async()=>{try{const job=await runtime.workers.claim('ui-worker'); onAction(job?'Worker claimed '+String(job.job_id):'No ready runtime jobs available'); await refreshJobs()}catch(error){onAction(error instanceof Error?error.message:'Worker claim failed')}}}><Icon name="play" size={12}/>Claim ready job</button>}{queuePaused?<button className="studio-button studio-button--active" type="button" onClick={()=>setQueuePaused(false)}>Resume queue</button>:null}</div>
   </Panel>

   <Panel title="Selected task">
    <div className="task-execution__task-header"><div><span className="eyebrow">{current[2]}</span><h2>{current[1]}</h2><p>{current[0]} · isolated task scope · {current[4]}</p></div><span className={'state-pill ' + (selectedState==='running'?'state-pill--active':selectedState==='blocked'?'state-pill--pending':selectedState==='complete'?'state-pill--completed':'')}>{selectedState}</span></div>
    <div className="task-execution__facts"><div><span>Agent</span><strong>{current[2]}</strong></div><div><span>Workspace</span><strong>Git worktree</strong></div><div><span>Context</span><strong>31.4k / 128k</strong></div><div><span>Retries</span><strong>1 / 3</strong></div></div>
    <div className="task-execution__steps">{['Scope resolved','Plan accepted','Implementation','Verification','Evidence'].map((step,index)=>{const done=index<2||(selectedState==='complete'&&index<5)||(selectedState==='running'&&index===2); return <div key={step} className={done?'task-step task-step--done':'task-step'}><span>{done?'✓':index+1}</span><strong>{step}</strong></div>})}</div>
    <div className="task-execution__dependency"><span className="eyebrow">Dependency gate</span><strong>{selectedState==='blocked'?'Waiting on approval or prerequisite':'Ready to continue'}</strong><small>{current[0]} depends on repository scope, policy resolution and the preceding task state.</small></div>
    <div className="platform-actions"><button className="studio-button" type="button" onClick={()=>transitionSelected('running','Retry selected task')}>Retry</button><button className="studio-button" type="button" onClick={()=>act('Open checkpoint')}><Icon name="history" size={12}/>Checkpoint</button><button className="studio-button studio-button--active" type="button" onClick={()=>transitionSelected('blocked','Stop selected task')}>Stop</button></div>
   </Panel>
  </div>

  <div className="task-execution__layout task-execution__layout--lower">
   <Panel title="Terminal sessions">
    <div className="task-execution__terminal-tabs">{terminals.map(([id,shell,,status])=><button key={id} type="button" className={terminal===id?'terminal-tab terminal-tab--active':'terminal-tab'} onClick={()=>setTerminal(id)}><Icon name="terminal" size={12}/><span>{shell}</span><small>{status}</small></button>)}</div>
    <div className="terminal-preview"><div className="terminal-preview__bar"><span>{terminal}</span><Tag label="sandbox"/><button className="icon-button" aria-label="Clear terminal" type="button" onClick={()=>act('Clear terminal output')}><Icon name="x" size={13}/></button></div><pre>$ cargo check -p agenticos-api-server
Checking dependencies...
Checking agenticos-kernel
Checking frontend contract adapters...
<span>waiting for runtime verification evidence...</span></pre></div>
    <div className="platform-actions"><button className="studio-button" type="button" onClick={()=>act('Run command')}>Run command</button><button className="studio-button" type="button" onClick={()=>act('Create terminal session')}>New terminal</button><button className="studio-button studio-button--active" type="button" onClick={()=>act('Open command approval')}><Icon name="lock" size={12}/>Approval</button></div>
   </Panel>

   <Panel title="Process & resource state">
    <div className="process-list">{[['frontend-build','CPU 34%','running'],['test-runner','CPU 12%','queued'],['agent-worker','CPU 41%','running'],['browser-verify','CPU 0%','blocked']].map(([name,usage,status])=><div key={name}><div><strong>{name}</strong><span>{usage}</span></div><span className={status==='running'?'state-pill state-pill--completed':status==='blocked'?'state-pill state-pill--pending':'state-pill'}>{status}</span></div>)}</div>
    <div className="resource-meter"><span>Memory budget</span><b>5.8 / 16 GB</b><div><i style={{width:'36%'}}/></div></div>
    <div className="resource-meter"><span>Execution budget</span><b>18 / 48 tool turns</b><div><i style={{width:'38%'}}/></div></div>
   </Panel>
  </div>

  <Panel title="Event log">
   <div className="task-execution__log-toolbar"><div className="search-mini"><Icon name="search" size={12}/><input value={logFilter} onChange={e=>setLogFilter(e.target.value)} placeholder="Filter events…" aria-label="Filter execution events"/></div><button className="studio-button" type="button" onClick={()=>act('Export execution log')}>Export</button></div>
   <div className="task-execution__log">{filteredLogs.map(([time,kind,target,message])=><div key={time+message}><span className="mono-text">{time}</span><Tag label={kind}/><code>{target}</code><span>{message}</span></div>)}</div>
  </Panel>

  <div className="task-execution__boundary"><Icon name="shield" size={13}/><span>Scheduler queue and job cancellation are runtime-backed. Terminal execution, worker completion, task delegation and artifact operations use their dedicated runtime contracts.</span></div>
 </div>
}
