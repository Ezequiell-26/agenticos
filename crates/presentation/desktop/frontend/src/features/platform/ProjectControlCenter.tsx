import { useEffect, useMemo, useState } from 'react'
import { runtime } from '../../services/runtime'
import Icon from '../../components/Icon'
import { MetricCard, Panel, Tag } from './PlatformPrimitives'

type Tab='overview'|'projects'|'workspace'|'tasks'|'git'|'environment'
const projects=[
 ['AgentiCOS','Rust runtime + Tauri + React','main','Active'],
 ['CCOS','C++ / Qt editor','feature/editor','Linked'],
 ['KinetixFitt','Fitness product workspace','develop','Linked'],
]
const tasks=[
 ['TASK-042','Frontend control-plane expansion','Builder','Running'],
 ['TASK-043','Navigation organization audit','Reviewer','Queued'],
 ['TASK-044','Verification evidence pack','QA','Blocked'],
 ['TASK-045','Runtime adapter planning','Architect','Planned'],
]
const git=[
 ['Branch','main','protected'],
 ['Working tree','Clean preview','0 changes'],
 ['Ahead / behind','0 / 0','origin/main'],
 ['Checkpoint','CP-031','restorable'],
]
const env=[
 ['Local Desktop','Tauri workstation','Ready'],
 ['Mission Worktree','Isolated Git checkout','Ready'],
 ['Cloud Agent VM','Remote long-running','Preview'],
 ['Remote SSH','User-managed host','Preview'],
]

export function ProjectControlCenter({onAction}:{onAction:(message:string)=>void}){
  const [tab,setTab]=useState<Tab>('overview')
  const [project,setProject]=useState(projects[0][0])
  const [filter,setFilter]=useState('')
  const [runtimeProjects,setRuntimeProjects]=useState<Array<{project_id:string;name:string;path:string;default_branch:string;description:string;status:string}>>([])
  const [runtimeJobs,setRuntimeJobs]=useState<any[]>([])
  const [runtimeRuns,setRuntimeRuns]=useState<any[]>([])
  const [runtimeProviders,setRuntimeProviders]=useState<any[]>([])
  const [health,setHealth]=useState<any|null>(null)
  const [readiness,setReadiness]=useState<any|null>(null)
  const [sandbox,setSandbox]=useState<any|null>(null)
  const [runtimeSyncing,setRuntimeSyncing]=useState(true)
  useEffect(()=>{let cancelled=false;void runtime.projects.list().then(remote=>{if(cancelled||remote.length===0)return;setRuntimeProjects(remote);setProject(current=>remote.some(item=>item.name===current)?current:remote[0].name)}).catch(()=>{}).finally(()=>{if(!cancelled)setRuntimeSyncing(false)});return()=>{cancelled=true}},[])
  useEffect(()=>{let cancelled=false;void Promise.allSettled([runtime.jobs.list(),runtime.runs.list(),runtime.providers.list(),runtime.health.get(),runtime.health.ready(),runtime.sandbox.status()]).then(results=>{if(cancelled)return;const [jobs,runs,providers,healthResult,readyResult,sandboxResult]=results;if(jobs.status==='fulfilled')setRuntimeJobs(jobs.value);if(runs.status==='fulfilled')setRuntimeRuns(runs.value);if(providers.status==='fulfilled')setRuntimeProviders(providers.value);if(healthResult.status==='fulfilled')setHealth(healthResult.value);if(readyResult.status==='fulfilled')setReadiness(readyResult.value);if(sandboxResult.status==='fulfilled')setSandbox(sandboxResult.value)}).finally(()=>{if(!cancelled)setRuntimeSyncing(false)});return()=>{cancelled=true}},[])

