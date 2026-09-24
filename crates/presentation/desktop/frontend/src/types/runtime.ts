export type AgentRunState =
  | 'idle'
  | 'queued'
  | 'planning'
  | 'awaiting-approval'
  | 'executing'
  | 'tool-call'
  | 'streaming'
  | 'verifying'
  | 'repairing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface RuntimeApiRecord {
  [key: string]: unknown
}

export interface RuntimeProviderStatus {
  provider_id: string
  name: string
  configured: boolean
  models: string[]
  health: string
  requests_used: number
  requests_per_minute?: number | null
  tokens_used: number
  tokens_per_minute?: number | null
}

export interface AgentStatusSnapshot {
  agentName: string
  state: AgentRunState
  runtimeState?: string
  provider: string
  model: string
  providers?: RuntimeProviderStatus[]
  latencyMs?: number
}

export interface RuntimeHealth {
  status: string
  service?: string
  backend?: string
  database?: string
  provider_configured?: boolean
  sandbox?: string | null
  [key: string]: unknown
}

export interface RuntimeReadiness {
  status: string
  provider_configured: boolean
  healthy_provider: boolean
  [key: string]: unknown
}

export interface ConversationSummary {
  id: string
  title: string
  preview: string
  timestamp: number
  pinned?: boolean
}

export interface RuntimeModel {
  model_id: string
  provider_id: string
  name: string
  context_window?: number | null
  capabilities: string[]
}

export interface RuntimeModelResponse extends RuntimeApiRecord {
  response?: string
  request_id?: string
  model?: string
  tokens?: number
}

export interface RuntimeStreamEvent {
  type: 'message' | 'done' | 'error'
  request_id?: string
  delta?: string
  error?: string
}

export interface RuntimeProviderRegistration {
  provider_id: string
  name: string
  base_url: string
  models: string[]
  capabilities: string[]
  api_key?: string
}

export interface RuntimeHealthCheck {
  provider_id: string
  status: string
  last_check: number
  message?: string | null
}

export interface RuntimeQuota {
  provider_id: string
  requests_per_minute?: number | null
  tokens_per_minute?: number | null
  current_usage: number
  current_token_usage?: number
}

export interface RuntimeRetryPolicy {
  max_attempts: number
  initial_backoff_ms: number
  max_backoff_ms: number
  exponential_backoff: boolean
}

export interface RuntimeFallbackConfig {
  primary_provider: string
  fallback_providers: string[]
  auto_failover: boolean
}

export interface RuntimeRun {
  run_id: string
  state: string
  version: number
  objective?: string
}

export interface RuntimeWorkspaceEntry {
  path: string
  directory: boolean
  file: boolean
  size_bytes?: number | null
}

export interface RuntimeProject {
  project_id: string
  name: string
  path: string
  default_branch: string
  description: string
  status: string
}

export interface RuntimeChannel {
  channel_id: string
  name: string
  channel_type: string
  enabled: boolean
  mode: string
  threading: boolean
  attachments: boolean
  voice: boolean
  delivery: string
}

export interface RuntimeChannelEvent extends RuntimeApiRecord {
  schemaVersion?: number
  eventId?: string
  channelId?: string
  profileId?: string
  sessionId?: string | null
  senderId?: string | null
  receivedAt?: string
  payload?: RuntimeApiRecord
  attachments?: RuntimeApiRecord[]
}

export interface RuntimeWorkspaceFile {
  path: string
  content: string
  bytes: number
}

export interface RuntimeMemoryRecord {
  namespace: string
  key: string
  value: string
  tags?: string[]
  importance?: number
  expires_at?: number
  updated_at?: number
  created_at?: number
}

export interface RuntimeSearchResult {
  query: string
  results: RuntimeApiRecord[]
  count: number
}

export interface RuntimeWorkerJob extends RuntimeApiRecord {
  worker_id?: string
}

export interface RuntimeServices {
  health: {
    get(): Promise<RuntimeHealth>
    ready(): Promise<RuntimeReadiness>
  }
  chat: {
    sendMessage(sessionId: string, message: string, options?: ChatSendOptions): Promise<ChatMessage>
  }
  status: {
    get(): Promise<AgentStatusSnapshot>
  }
  conversations: {
    history(sessionId: string): Promise<ChatMessage[]>
    search(query: string, limit?: number): Promise<RuntimeSearchResult>
  }
  models: {
    list(): Promise<RuntimeModel[]>
    execute(model: string, input: string, parameters?: string, requestId?: string): Promise<RuntimeModelResponse>
    stream(
      model: string,
      input: string,
      parameters?: string,
      requestId?: string,
    ): AsyncGenerator<RuntimeStreamEvent, void, unknown>
  }
  providers: {
    list(): Promise<RuntimeProviderStatus[]>
    register(request: RuntimeProviderRegistration): Promise<RuntimeProviderStatus | null>
    remove(providerId: string): Promise<void>
    models(providerId: string): Promise<string[]>
    refreshModels(providerId: string): Promise<string[]>
    health(providerId: string): Promise<RuntimeHealthCheck>
    quota(providerId: string): Promise<RuntimeQuota>
    setQuota(providerId: string, quota: Omit<RuntimeQuota, 'provider_id'>): Promise<RuntimeQuota>
    retry(providerId: string): Promise<RuntimeRetryPolicy>
    setRetry(providerId: string, policy: RuntimeRetryPolicy): Promise<RuntimeRetryPolicy>
    fallback(providerId: string): Promise<RuntimeFallbackConfig>
    setFallback(providerId: string, config: Omit<RuntimeFallbackConfig, 'primary_provider'> & { primary_provider?: string }): Promise<RuntimeFallbackConfig>
  }
  tools: {
    list(): Promise<RuntimeApiRecord[]>
    call(request: { tool_id: string; agent_id: string; grant_id: string; parameters?: unknown }): Promise<RuntimeApiRecord>
    execute(request: { session_id: string; user_id?: string; grant_id: string; command: string; timeout_ms?: number }): Promise<RuntimeApiRecord>
  }
  mcp: {
    list(): Promise<RuntimeApiRecord[]>
    register(server: RuntimeApiRecord): Promise<RuntimeApiRecord>
    remove(serverId: string): Promise<void>
    setEnabled(serverId: string, enabled: boolean): Promise<RuntimeApiRecord>
    tools(serverId: string): Promise<RuntimeApiRecord[]>
    call(serverId: string, toolName: string, argumentsValue: unknown, grantId: string): Promise<RuntimeApiRecord>
    sync(serverId: string): Promise<RuntimeApiRecord>
  }
  runs: {
    list(): Promise<RuntimeRun[]>
    create(objective: string, runId?: string, idempotencyKey?: string): Promise<RuntimeRun>
    get(runId: string): Promise<RuntimeRun>
    cancel(runId: string): Promise<RuntimeApiRecord>
    snapshot(runId: string): Promise<RuntimeApiRecord>
    artifacts(runId: string): Promise<RuntimeApiRecord[]>
  }
  subagents: {
    list(): Promise<RuntimeApiRecord[]>
    create(agent: RuntimeApiRecord): Promise<RuntimeApiRecord>
    children(parentRunId: string): Promise<RuntimeApiRecord[]>
    delegate(parentRunId: string, request: RuntimeApiRecord): Promise<RuntimeApiRecord>
  }
  jobs: {
    list(): Promise<RuntimeApiRecord[]>
    ready(): Promise<RuntimeApiRecord[]>
    create(job: RuntimeApiRecord): Promise<RuntimeApiRecord>
    get(jobId: string): Promise<RuntimeApiRecord>
    cancel(jobId: string): Promise<RuntimeApiRecord>
  }
  workers: {
    claim(workerId: string, leaseSeconds?: number): Promise<RuntimeWorkerJob | null>
    heartbeat(jobId: string, request: { worker_id: string; lease_token: number; lease_seconds?: number }): Promise<RuntimeWorkerJob>
    complete(jobId: string, request: { worker_id: string; lease_token: number; success: boolean; output?: string; error?: string }): Promise<RuntimeApiRecord>
  }
  workflows: {
    list(): Promise<RuntimeApiRecord[]>
    create(workflow: RuntimeApiRecord): Promise<RuntimeApiRecord>
    start(workflowId: string): Promise<RuntimeApiRecord>
    ready(workflowId: string): Promise<RuntimeApiRecord[]>
    state(workflowId: string): Promise<RuntimeApiRecord>
    transition(workflowId: string, nodeId: string, state: string): Promise<RuntimeApiRecord>
  }
  memory: {
    list(namespace: string, query?: string, limit?: number): Promise<RuntimeMemoryRecord[]>
    upsert(record: Omit<RuntimeMemoryRecord, 'updated_at' | 'created_at'>): Promise<RuntimeMemoryRecord>
    remove(namespace: string, key: string): Promise<void>
    purge(): Promise<{ removed: number }>
  }
  capabilities: {
    list(): Promise<RuntimeApiRecord[]>
    issue(request: { capability_type: string; resource: string; permission: string; expires_at?: number; grant_id: string }): Promise<RuntimeApiRecord>
    revoke(grantId: string): Promise<void>
  }
  approvals: {
    list(): Promise<RuntimeApiRecord[]>
    create(request: { run_id: string; action: string; resource: string; expires_at?: number }): Promise<RuntimeApiRecord>
    resolve(approvalId: string, approved: boolean): Promise<RuntimeApiRecord>
  }
  skills: {
    list(): Promise<RuntimeApiRecord[]>
  }
  projects: {
    list(): Promise<RuntimeProject[]>
    register(project: RuntimeProject): Promise<RuntimeProject>
    remove(projectId: string): Promise<void>
  }
  channels: {
    list(): Promise<RuntimeChannel[]>
    register(channel: RuntimeChannel): Promise<RuntimeChannel>
    remove(channelId: string): Promise<void>
    events(channelId: string, limit?: number): Promise<RuntimeChannelEvent[]>
    sendEvent(channelId: string, request: { profile_id: string; session_id?: string; sender_id?: string; payload: RuntimeApiRecord; attachments?: RuntimeApiRecord[] }): Promise<RuntimeChannelEvent>
  }
  workspace: {
    list(path: string, grantId: string): Promise<RuntimeWorkspaceEntry[]>
    readFile(path: string, grantId: string): Promise<RuntimeWorkspaceFile>
    writeFile(path: string, content: string, grantId: string): Promise<RuntimeApiRecord>
    patchFile(path: string, expected: string, replacement: string, grantId: string): Promise<RuntimeApiRecord>
  }
  source: {
    inspect(source: string): Promise<RuntimeApiRecord>
    analyze(source: string): Promise<RuntimeApiRecord>
    file(owner: string, repo: string, path: string, reference?: string): Promise<RuntimeApiRecord>
  }
  evaluation: {
    cases(): Promise<RuntimeApiRecord[]>
    create(testCase: RuntimeApiRecord): Promise<RuntimeApiRecord>
    run(caseId: string, output: string): Promise<RuntimeApiRecord>
    result(caseId: string): Promise<RuntimeApiRecord>
  }
  terminal: {
    list(grantId?: string): Promise<RuntimeApiRecord[]>
    create(request: { command: string; cwd?: string; grant_id: string }): Promise<RuntimeApiRecord>
    get(terminalId: string, grantId: string): Promise<RuntimeApiRecord>
    input(terminalId: string, input: string, grantId: string): Promise<RuntimeApiRecord>
    output(terminalId: string, grantId: string, after?: number, limit?: number): Promise<RuntimeApiRecord>
    close(terminalId: string, grantId: string): Promise<RuntimeApiRecord>
    remove(terminalId: string, grantId: string): Promise<void>
  }
  artifacts: {
    list(options?: { runId?: string; limit?: number }): Promise<RuntimeApiRecord[]>
    create(request: RuntimeApiRecord): Promise<RuntimeApiRecord>
    upload(content: Blob | ArrayBuffer, options?: { kind?: string; mimeType?: string; runId?: string; trusted?: boolean; expiresAt?: number; metadata?: RuntimeApiRecord }): Promise<RuntimeApiRecord>
    get(artifactId: string): Promise<RuntimeApiRecord>
    content(artifactId: string): Promise<Blob>
    remove(artifactId: string): Promise<void>
  }
  reasoning: {
    plan(objective: string): Promise<RuntimeApiRecord>
  }
  metrics: {
    get(): Promise<RuntimeApiRecord>
  }
  audit: {
    list(limit?: number): Promise<RuntimeApiRecord[]>
  }
  usage: {
    summary(): Promise<RuntimeApiRecord>
    records(): Promise<RuntimeApiRecord[]>
    setPricing(request: RuntimeApiRecord): Promise<RuntimeApiRecord>
  }
  sandbox: {
    status(): Promise<RuntimeApiRecord>
  }
  a2a: {
    agentCard(): Promise<RuntimeApiRecord>
    sendMessage(message: RuntimeApiRecord): Promise<RuntimeApiRecord>
    getTask(taskId: string): Promise<RuntimeApiRecord>
    cancelTask(taskId: string): Promise<RuntimeApiRecord>
  }
}

export interface ChatSendOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  responseFormat?: 'Markdown' | 'Plain text' | 'Structured' | 'Code first'
}
