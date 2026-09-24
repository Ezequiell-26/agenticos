import type {
  AgentStatusSnapshot,
  ChatMessage,
  ChatSendOptions,
  RuntimeApiRecord,
  RuntimeFallbackConfig,
  RuntimeHealth,
  RuntimeHealthCheck,
  RuntimeMemoryRecord,
  RuntimeModel,
  RuntimeModelResponse,
  RuntimeProviderRegistration,
  RuntimeProviderStatus,
  RuntimeQuota,
  RuntimeReadiness,
  RuntimeRetryPolicy,
  RuntimeRun,
  RuntimeSearchResult,
  RuntimeServices,
  RuntimeStreamEvent,
  RuntimeWorkerJob,
  RuntimeProject,
  RuntimeChannel,
  RuntimeChannelEvent,
  RuntimeWorkspaceEntry,
  RuntimeWorkspaceSearchMatch,
  RuntimeWorkspaceFile,
} from '../types/runtime'

export class RuntimeHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'RuntimeHttpError'
  }
}

interface HttpTransport {
  get<T>(path: string): Promise<T>
  getBlob(path: string): Promise<Blob>
  post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T>
  postStream(path: string, body?: unknown, headers?: Record<string, string>): Promise<Response>
  postRaw<T>(path: string, body: BodyInit, headers?: Record<string, string>): Promise<T>
  put<T>(path: string, body?: unknown): Promise<T>
  patch<T>(path: string, body?: unknown): Promise<T>
  delete<T = void>(path: string): Promise<T>
}

class FetchTransport implements HttpTransport {
  constructor(
    private readonly baseUrl: string,
    private readonly apiToken?: string,
  ) {}

  private headers(body?: unknown, headers?: Record<string, string>): Record<string, string> {
    return {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {}),
      ...headers,
    }
  }

  private async parseError(response: Response, method: string, path: string): Promise<never> {
    const text = await response.text()
    let data: unknown
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
    }
    const record = isRecord(data) ? data : {}
    const message = readString(record, 'error') ?? `${method} ${path} failed with ${response.status}`
    throw new RuntimeHttpError(message, response.status, readString(record, 'code'), data)
  }

  private async request<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(body, headers),
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    if (!response.ok) return this.parseError(response, method, path)

    const text = await response.text()
    if (!text) return undefined as T
    try {
      return JSON.parse(text) as T
    } catch {
      return text as T
    }
  }

  async getBlob(path: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.headers(),
    })
    if (!response.ok) return this.parseError(response, 'GET', path)
    return response.blob()
  }

  async postStream(path: string, body?: unknown, headers?: Record<string, string>): Promise<Response> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(body, headers),
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) return this.parseError(response, 'POST', path)
    return response
  }

  async postRaw<T>(path: string, body: BodyInit, headers?: Record<string, string>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(undefined, headers),
      body,
    })
    if (!response.ok) return this.parseError(response, 'POST', path)
    const text = await response.text()
    if (!text) return undefined as T
    try {
      return JSON.parse(text) as T
    } catch {
      return text as T
    }
  }

  get<T>(path: string) { return this.request<T>('GET', path) }
  post<T>(path: string, body?: unknown, headers?: Record<string, string>) { return this.request<T>('POST', path, body, headers) }
  put<T>(path: string, body?: unknown) { return this.request<T>('PUT', path, body) }
  patch<T>(path: string, body?: unknown) { return this.request<T>('PATCH', path, body) }
  delete<T = void>(path: string) { return this.request<T>('DELETE', path) }
}

const fallbackStatus: AgentStatusSnapshot = {
  agentName: 'AgentiCOS',
  state: 'idle',
  runtimeState: 'offline',
  provider: 'Runtime offline',
  model: 'Waiting for backend',
}

function isRecord(value: unknown): value is RuntimeApiRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: RuntimeApiRecord, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function readNumber(record: RuntimeApiRecord, key: string): number | undefined {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function arrayOfRecords(value: unknown): RuntimeApiRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function unwrapArray(data: unknown, key: string): RuntimeApiRecord[] {
  return isRecord(data) ? arrayOfRecords(data[key]) : []
}

function unwrapStrings(data: unknown, key: string): string[] {
  return isRecord(data) ? arrayOfStrings(data[key]) : []
}

function toTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 10_000_000_000 ? value : value * 1000
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return Date.now()
}

function createMessage(role: ChatMessage['role'], content: string, timestamp = Date.now(), id?: string): ChatMessage {
  return { id: id ?? `${role}-${timestamp}-${Math.random().toString(36).slice(2, 8)}`, role, content, timestamp }
}

function normalizeAgentState(value: unknown): AgentStatusSnapshot['state'] {
  switch (String(value).toLowerCase()) {
    case 'queued': return 'queued'
    case 'planning': return 'planning'
    case 'executing':
    case 'running': return 'executing'
    case 'streaming': return 'streaming'
    case 'verifying': return 'verifying'
    case 'repairing': return 'repairing'
    case 'failed':
    case 'error': return 'failed'
    case 'cancelled':
    case 'canceled': return 'cancelled'
    case 'completed':
    case 'ready':
    case 'idle':
    default: return 'idle'
  }
}

function parseSseEvent(block: string): RuntimeStreamEvent | null {
  const lines = block.split(/\\r?\\n/)
  let eventType = 'message'
  const dataLines: string[] = []
  for (const line of lines) {
    if (line.startsWith('event:')) eventType = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
  }
  if (dataLines.length === 0) return null

  const raw = dataLines.join('\\n')
  try {
    const data = JSON.parse(raw) as RuntimeApiRecord
    if (eventType === 'done' || data.done === true) return {
      type: 'done',
      request_id: readString(data, 'request_id'),
    }
    if (eventType === 'error' || readString(data, 'error')) return {
      type: 'error',
      request_id: readString(data, 'request_id'),
      error: readString(data, 'error') ?? 'Runtime stream failed',
    }
    return {
      type: 'message',
      request_id: readString(data, 'request_id'),
      delta: readString(data, 'delta') ?? '',
    }
  } catch {
    return { type: 'message', delta: raw }
  }
}

export class AgenticosRuntime implements RuntimeServices {
  private readonly transport: HttpTransport
  readonly baseUrl: string

  constructor(
    baseUrl = import.meta.env.VITE_AGENTICOS_API_URL ?? 'http://127.0.0.1:8080',
    apiToken = import.meta.env.VITE_AGENTICOS_API_TOKEN as string | undefined,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.transport = new FetchTransport(this.baseUrl, apiToken?.trim() || undefined)
  }

  readonly health = {
    get: async (): Promise<RuntimeHealth> => this.transport.get<RuntimeHealth>('/health'),
    ready: async (): Promise<RuntimeReadiness> => this.transport.get<RuntimeReadiness>('/ready'),
  }

  readonly chat = {
    sendMessage: async (sessionId: string, message: string, options?: ChatSendOptions): Promise<ChatMessage> => {
      const model = options?.model && options.model !== 'Auto route' ? options.model : undefined
      const data = await this.transport.post<RuntimeApiRecord>('/api/agent/chat', {
        message,
        session_id: sessionId,
        ...(model ? { model } : {}),
        ...(options?.maxTokens || options?.temperature || options?.responseFormat
          ? {
              parameters: {
                agenticos: {
                  ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
                  ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
                  ...(options.responseFormat
                    ? {
                        response_format: {
                          type: options.responseFormat === 'Structured'
                            ? 'json_object'
                            : 'text',
                        },
                      }
                    : {}),
                },
              },
            }
          : {}),
      })
      const response = readString(data, 'response')?.trim() ?? ''
      if (!response) throw new RuntimeHttpError('The runtime returned an empty response.', 502, 'EMPTY_RESPONSE', data)
      return createMessage('assistant', response)
    },
  }

  readonly status = {
    get: async (): Promise<AgentStatusSnapshot> => {
      try {
        const data = await this.transport.get<RuntimeApiRecord>('/api/agent/status')
        const providers = arrayOfRecords(data.providers).map((entry) => entry as unknown as RuntimeProviderStatus)
        const configured = providers.filter((provider) => provider.configured)
        return {
          agentName: readString(data, 'agent_name') ?? 'AgentiCOS',
          state: normalizeAgentState(data.state),
          runtimeState: readString(data, 'state') ?? 'unknown',
          provider: configured.map((provider) => provider.name).join(' + ') || 'No provider configured',
          model: readString(data, 'model') ?? 'Runtime-selected model',
          providers,
        }
      } catch {
        return fallbackStatus
      }
    },
  }

  readonly conversations = {
    history: async (sessionId: string): Promise<ChatMessage[]> => {
      const data = await this.transport.get<RuntimeApiRecord>(`/api/conversations/${encodeURIComponent(sessionId)}/history`)
      return arrayOfRecords(data.history).map((entry, index) => {
        const roleRaw = readString(entry, 'role')
        const role: ChatMessage['role'] = roleRaw === 'user' ? 'user' : roleRaw === 'system' ? 'system' : 'assistant'
        return createMessage(role, readString(entry, 'content') ?? '', toTimestamp(entry.timestamp), `history-${sessionId}-${index}-${String(entry.timestamp ?? index)}`)
      })
    },
    search: async (query: string, limit = 20): Promise<RuntimeSearchResult> => {
      const data = await this.transport.get<RuntimeApiRecord>(`/api/conversations/search?q=${encodeURIComponent(query)}&limit=${Math.min(100, Math.max(1, limit))}`)
      return { query, results: arrayOfRecords(data.results), count: readNumber(data, 'count') ?? 0 }
    },
  }

  readonly models = {
    list: async (): Promise<RuntimeModel[]> => {
      const data = await this.transport.get<RuntimeApiRecord>('/api/models')
      return arrayOfRecords(data.models).map((entry) => ({
        model_id: readString(entry, 'model_id') ?? '',
        provider_id: readString(entry, 'provider_id') ?? '',
        name: readString(entry, 'name') ?? readString(entry, 'model_id') ?? '',
        context_window: readNumber(entry, 'context_window') ?? null,
        capabilities: arrayOfStrings(entry.capabilities),
      })).filter((model) => model.model_id)
    },
    execute: async (model: string, input: string, parameters?: string, requestId?: string): Promise<RuntimeModelResponse> =>
      this.transport.post<RuntimeModelResponse>('/api/models/execute', {
        model,
        input,
        ...(parameters ? { parameters } : {}),
        ...(requestId ? { request_id: requestId } : {}),
      }),
    stream: (model: string, input: string, parameters?: string, requestId?: string) => {
      const transport = this.transport
      return (async function* (): AsyncGenerator<RuntimeStreamEvent, void, unknown> {
      const response = await transport.postStream('/api/models/stream', {
        model,
        input,
        ...(parameters ? { parameters } : {}),
        ...(requestId ? { request_id: requestId } : {}),
      })
      if (!response.body) {
        throw new RuntimeHttpError('Runtime stream body is unavailable.', 502, 'STREAM_BODY_UNAVAILABLE')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const blocks = buffer.split(/\\n\\n/)
          buffer = blocks.pop() ?? ''
          for (const block of blocks) {
            const parsed = parseSseEvent(block)
            if (parsed) yield parsed
          }
        }
        buffer += decoder.decode()
        if (buffer.trim()) {
          const parsed = parseSseEvent(buffer)
          if (parsed) yield parsed
        }
      } finally {
        reader.releaseLock()
      }
      })()
    },
  }

  readonly providers = {
    list: async (): Promise<RuntimeProviderStatus[]> => {
      const data = await this.transport.get<RuntimeApiRecord>('/api/providers')
      return arrayOfRecords(data.providers).map((entry) => entry as unknown as RuntimeProviderStatus)
    },
    register: async (request: RuntimeProviderRegistration): Promise<RuntimeProviderStatus | null> => {
      const data = await this.transport.post<RuntimeApiRecord>('/api/providers', request)
      return isRecord(data) ? data as unknown as RuntimeProviderStatus : null
    },
    remove: async (providerId: string) => { await this.transport.delete(`/api/providers/${encodeURIComponent(providerId)}`) },
    models: async (providerId: string) => {
      const data = await this.transport.get<RuntimeApiRecord>(`/api/providers/${encodeURIComponent(providerId)}/models`)
      return unwrapStrings(data, 'models')
    },
    refreshModels: async (providerId: string) => {
      const data = await this.transport.post<RuntimeApiRecord>(`/api/providers/${encodeURIComponent(providerId)}/models/refresh`)
      return unwrapStrings(data, 'models')
    },
    health: async (providerId: string) => this.transport.post<RuntimeHealthCheck>(`/api/providers/${encodeURIComponent(providerId)}/health`),
    quota: async (providerId: string) => this.transport.get<RuntimeQuota>(`/api/providers/${encodeURIComponent(providerId)}/quota`),
    setQuota: async (providerId: string, quota: Omit<RuntimeQuota, 'provider_id'>) => this.transport.put<RuntimeQuota>(`/api/providers/${encodeURIComponent(providerId)}/quota`, quota),
    retry: async (providerId: string) => this.transport.get<RuntimeRetryPolicy>(`/api/providers/${encodeURIComponent(providerId)}/retry`),
    setRetry: async (providerId: string, policy: RuntimeRetryPolicy) => this.transport.put<RuntimeRetryPolicy>(`/api/providers/${encodeURIComponent(providerId)}/retry`, policy),
    fallback: async (providerId: string) => this.transport.get<RuntimeFallbackConfig>(`/api/providers/${encodeURIComponent(providerId)}/fallback`),
    setFallback: async (providerId: string, config: Omit<RuntimeFallbackConfig, 'primary_provider'> & { primary_provider?: string }) => this.transport.put<RuntimeFallbackConfig>(`/api/providers/${encodeURIComponent(providerId)}/fallback`, config),
  }

  readonly tools = {
    list: async () => unwrapArray(await this.transport.get<RuntimeApiRecord>('/api/tools'), 'tools'),
    call: async (request: { tool_id: string; agent_id: string; grant_id: string; parameters?: unknown }) => this.transport.post<RuntimeApiRecord>('/api/tools/call', request),
    execute: async (request: { session_id: string; user_id?: string; grant_id: string; command: string; timeout_ms?: number }) => this.transport.post<RuntimeApiRecord>('/api/tools/execute', request),
  }

  readonly mcp = {
    list: async () => unwrapArray(await this.transport.get<RuntimeApiRecord>('/api/mcp'), 'servers'),
    register: async (server: RuntimeApiRecord) => this.transport.post<RuntimeApiRecord>('/api/mcp', { server }),
    remove: async (serverId: string) => { await this.transport.delete(`/api/mcp/${encodeURIComponent(serverId)}`) },
    setEnabled: async (serverId: string, enabled: boolean) => this.transport.post<RuntimeApiRecord>(`/api/mcp/${encodeURIComponent(serverId)}/${enabled ? 'enable' : 'disable'}`),
    tools: async (serverId: string) => unwrapArray(await this.transport.get<RuntimeApiRecord>(`/api/mcp/${encodeURIComponent(serverId)}/tools`), 'tools'),
    call: async (serverId: string, toolName: string, argumentsValue: unknown, grantId: string) => this.transport.post<RuntimeApiRecord>(`/api/mcp/${encodeURIComponent(serverId)}/tools/${encodeURIComponent(toolName)}/call`, { arguments: argumentsValue, grant_id: grantId }),
    sync: async (serverId: string) => this.transport.post<RuntimeApiRecord>(`/api/tools/mcp/${encodeURIComponent(serverId)}/sync`),
  }

  readonly runs = {
    list: async (): Promise<RuntimeRun[]> => {
      const data = await this.transport.get<RuntimeApiRecord>('/api/runs')
      return arrayOfRecords(data.runs).map((run) => ({
        run_id: readString(run, 'run_id') ?? '',
        state: readString(run, 'state') ?? 'Unknown',
        version: readNumber(run, 'version') ?? 0,
        objective: readString(run, 'objective'),
      })).filter((run) => run.run_id)
    },
    create: async (objective: string, runId?: string, idempotencyKey?: string) => {
      const headers = idempotencyKey?.trim() ? { 'Idempotency-Key': idempotencyKey.trim() } : undefined
      return this.transport.post<RuntimeRun>('/api/runs', { objective, ...(runId ? { run_id: runId } : {}) }, headers)
    },
    get: async (runId: string) => this.transport.get<RuntimeRun>(`/api/runs/${encodeURIComponent(runId)}`),
    cancel: async (runId: string) => this.transport.post<RuntimeApiRecord>(`/api/runs/${encodeURIComponent(runId)}/cancel`),
    snapshot: async (runId: string) => this.transport.post<RuntimeApiRecord>(`/api/runs/${encodeURIComponent(runId)}/snapshot`),
    artifacts: async (runId: string) => unwrapArray(await this.transport.get<RuntimeApiRecord>(`/api/runs/${encodeURIComponent(runId)}/artifacts`), 'artifacts'),
  }

  readonly subagents = {
    list: async () => unwrapArray(await this.transport.get<RuntimeApiRecord>('/api/subagents'), 'agents'),
    create: async (agent: RuntimeApiRecord) => this.transport.post<RuntimeApiRecord>('/api/subagents', { agent }),
    children: async (parentRunId: string) => unwrapArray(await this.transport.get<RuntimeApiRecord>(`/api/subagents/${encodeURIComponent(parentRunId)}/children`), 'children'),
    delegate: async (parentRunId: string, request: RuntimeApiRecord) => this.transport.post<RuntimeApiRecord>(`/api/subagents/${encodeURIComponent(parentRunId)}/children`, request),
  }

  readonly jobs = {
    list: async () => unwrapArray(await this.transport.get<RuntimeApiRecord>('/api/jobs'), 'jobs'),
    ready: async () => unwrapArray(await this.transport.get<RuntimeApiRecord>('/api/jobs/ready'), 'jobs'),
    create: async (job: RuntimeApiRecord) => this.transport.post<RuntimeApiRecord>('/api/jobs', { job }),
    get: async (jobId: string) => this.transport.get<RuntimeApiRecord>(`/api/jobs/${encodeURIComponent(jobId)}`),
    cancel: async (jobId: string) => this.transport.post<RuntimeApiRecord>(`/api/jobs/${encodeURIComponent(jobId)}/cancel`),
  }

  readonly workers = {
    claim: async (workerId: string, leaseSeconds?: number): Promise<RuntimeWorkerJob | null> => {
      const response = await this.transport.post<RuntimeApiRecord>('/api/workers/claim', { worker_id: workerId, ...(leaseSeconds ? { lease_seconds: leaseSeconds } : {}) })
      return Object.keys(response ?? {}).length === 0 ? null : response as RuntimeWorkerJob
    },
    heartbeat: async (jobId: string, request: { worker_id: string; lease_token: number; lease_seconds?: number }) =>
      this.transport.post<RuntimeWorkerJob>(`/api/workers/jobs/${encodeURIComponent(jobId)}/heartbeat`, request),
    complete: async (jobId: string, request: { worker_id: string; lease_token: number; success: boolean; output?: string; error?: string }) =>
      this.transport.post<RuntimeApiRecord>(`/api/workers/jobs/${encodeURIComponent(jobId)}/complete`, request),
  }

  readonly workflows = {
    list: async () => unwrapArray(await this.transport.get<RuntimeApiRecord>('/api/workflows'), 'workflows'),
    create: async (workflow: RuntimeApiRecord) => this.transport.post<RuntimeApiRecord>('/api/workflows', { workflow }),
    start: async (workflowId: string) => this.transport.post<RuntimeApiRecord>(`/api/workflows/${encodeURIComponent(workflowId)}/start`),
    ready: async (workflowId: string) => unwrapArray(await this.transport.get<RuntimeApiRecord>(`/api/workflows/${encodeURIComponent(workflowId)}/ready`), 'nodes'),
    state: async (workflowId: string) => this.transport.get<RuntimeApiRecord>(`/api/workflows/${encodeURIComponent(workflowId)}/state`),
    transition: async (workflowId: string, nodeId: string, state: string) =>
      this.transport.post<RuntimeApiRecord>(`/api/workflows/${encodeURIComponent(workflowId)}/nodes/${encodeURIComponent(nodeId)}/transition`, { state }),
  }

  readonly memory = {
    list: async (namespace: string, query?: string, limit = 100) => {
      const params = new URLSearchParams({ namespace, limit: String(Math.min(500, Math.max(1, limit))) })
      if (query?.trim()) params.set('q', query.trim())
      const data = await this.transport.get<RuntimeApiRecord>(`/api/memory?${params.toString()}`)
      return arrayOfRecords(data.records).map((entry) => entry as unknown as RuntimeMemoryRecord)
    },
    upsert: async (record: Omit<RuntimeMemoryRecord, 'updated_at' | 'created_at'>) => this.transport.post<RuntimeMemoryRecord>('/api/memory', record),
    remove: async (namespace: string, key: string) => { await this.transport.delete(`/api/memory/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`) },
    purge: async () => this.transport.post<{ removed: number }>('/api/memory/purge'),
  }

  readonly capabilities = {
    list: async () => unwrapArray(await this.transport.get<RuntimeApiRecord>('/api/capabilities'), 'grants'),
    issue: async (request: { capability_type: string; resource: string; permission: string; expires_at?: number; grant_id: string }) =>
      this.transport.post<RuntimeApiRecord>('/api/capabilities', request),
    revoke: async (grantId: string) => { await this.transport.delete(`/api/capabilities/${encodeURIComponent(grantId)}`) },
  }

  readonly approvals = {
    list: async () => unwrapArray(await this.transport.get<RuntimeApiRecord>('/api/approvals'), 'approvals'),
    create: async (request: { run_id: string; action: string; resource: string; expires_at?: number }) => this.transport.post<RuntimeApiRecord>('/api/approvals', request),
    resolve: async (approvalId: string, approved: boolean) => this.transport.post<RuntimeApiRecord>(`/api/approvals/${encodeURIComponent(approvalId)}`, { approved }),
  }

  readonly skills = {
    list: async () => unwrapArray(await this.transport.get<RuntimeApiRecord>('/api/skills'), 'skills'),
  }

  readonly projects = {
    list: async (): Promise<RuntimeProject[]> => {
      const data = await this.transport.get<RuntimeApiRecord>('/api/projects')
      return arrayOfRecords(data.projects) as unknown as RuntimeProject[]
    },
    register: async (project: RuntimeProject): Promise<RuntimeProject> =>
      this.transport.post<RuntimeProject>('/api/projects', { project }),
    remove: async (projectId: string) => {
      await this.transport.delete(`/api/projects/${encodeURIComponent(projectId)}`)
    },
  }

  readonly channels = {
    list: async (): Promise<RuntimeChannel[]> => {
      const data = await this.transport.get<RuntimeApiRecord>('/api/channels')
      return arrayOfRecords(data.channels) as unknown as RuntimeChannel[]
    },
    register: async (channel: RuntimeChannel): Promise<RuntimeChannel> =>
      this.transport.post<RuntimeChannel>('/api/channels', { channel }),
    remove: async (channelId: string) => {
      await this.transport.delete(`/api/channels/${encodeURIComponent(channelId)}`)
    },
    events: async (channelId: string, limit = 50): Promise<RuntimeChannelEvent[]> => {
      const data = await this.transport.get<RuntimeApiRecord>(`/api/channels/${encodeURIComponent(channelId)}/events?limit=${Math.min(500, Math.max(1, limit))}`)
      return arrayOfRecords(data.events) as unknown as RuntimeChannelEvent[]
    },
    sendEvent: async (channelId: string, request: { profile_id: string; session_id?: string; sender_id?: string; payload: RuntimeApiRecord; attachments?: RuntimeApiRecord[] }): Promise<RuntimeChannelEvent> =>
      this.transport.post<RuntimeChannelEvent>(`/api/channels/${encodeURIComponent(channelId)}/events`, request),
  }

  readonly workspace = {
    list: async (path: string, grantId: string): Promise<RuntimeWorkspaceEntry[]> => {
      const params = new URLSearchParams({ path, grant_id: grantId })
      const data = await this.transport.get<RuntimeApiRecord>(`/api/workspace/list?${params.toString()}`)
      return arrayOfRecords(data.entries).map((entry) => ({
        path: readString(entry, 'path') ?? '',
        directory: Boolean(entry.directory),
        file: Boolean(entry.file),
        size_bytes: typeof entry.size_bytes === 'number' ? entry.size_bytes : null,
      })).filter((entry) => entry.path)
    },
    readFile: async (path: string, grantId: string): Promise<RuntimeWorkspaceFile> => {
      const params = new URLSearchParams({ path, grant_id: grantId })
      return this.transport.get<RuntimeWorkspaceFile>(`/api/workspace/file?${params.toString()}`)
    },
    search: async (path: string, query: string, grantId: string, limit = 50): Promise<RuntimeWorkspaceSearchMatch[]> => {
      const params = new URLSearchParams({ path, q: query, grant_id: grantId, limit: String(Math.min(500, Math.max(1, limit))) })
      const data = await this.transport.get<RuntimeApiRecord>(`/api/workspace/search?${params.toString()}`)
      return arrayOfRecords(data.matches).map((entry) => ({
        path: readString(entry, 'path') ?? '',
        line: readNumber(entry, 'line') ?? 0,
        column: readNumber(entry, 'column') ?? 0,
        preview: readString(entry, 'preview') ?? '',
      })).filter((entry) => entry.path)
    },
    writeFile: async (path: string, content: string, grantId: string) =>
      this.transport.post<RuntimeApiRecord>('/api/workspace/file', { path, content, grant_id: grantId }),
    patchFile: async (path: string, expected: string, replacement: string, grantId: string) =>
      this.transport.post<RuntimeApiRecord>('/api/workspace/patch', { path, expected, replacement, grant_id: grantId }),
  }

  readonly source = {
    inspect: async (source: string) => this.transport.post<RuntimeApiRecord>('/api/source/github/inspect', { source }),
    analyze: async (source: string) => this.transport.post<RuntimeApiRecord>('/api/source/github/analyze', { source }),
    file: async (owner: string, repo: string, path: string, reference?: string) => {
      const params = new URLSearchParams({ path })
      if (reference) params.set('reference', reference)
      return this.transport.get<RuntimeApiRecord>(`/api/source/github/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/file?${params.toString()}`)
    },
  }

  readonly evaluation = {
    cases: async () => unwrapArray(await this.transport.get<RuntimeApiRecord>('/api/evaluation/cases'), 'cases'),
    create: async (testCase: RuntimeApiRecord) => this.transport.post<RuntimeApiRecord>('/api/evaluation/cases', { case: testCase }),
    run: async (caseId: string, output: string) => this.transport.post<RuntimeApiRecord>(`/api/evaluation/cases/${encodeURIComponent(caseId)}/run`, { output }),
    result: async (caseId: string) => this.transport.get<RuntimeApiRecord>(`/api/evaluation/cases/${encodeURIComponent(caseId)}/result`),
  }

  readonly terminal = {
    list: async (grantId?: string) => {
      const params = grantId ? `?grant_id=${encodeURIComponent(grantId)}` : ''
      return unwrapArray(await this.transport.get<RuntimeApiRecord>(`/api/terminals${params}`), 'terminals')
    },
    create: async (request: { command: string; cwd?: string; grant_id: string }) => this.transport.post<RuntimeApiRecord>('/api/terminals', request),
    get: async (terminalId: string, grantId: string) => this.transport.get<RuntimeApiRecord>(`/api/terminals/${encodeURIComponent(terminalId)}?grant_id=${encodeURIComponent(grantId)}`),
    input: async (terminalId: string, input: string, grantId: string) => this.transport.post<RuntimeApiRecord>(`/api/terminals/${encodeURIComponent(terminalId)}/input`, { input, grant_id: grantId }),
    output: async (terminalId: string, grantId: string, after?: number, limit?: number) => {
      const params = new URLSearchParams({ grant_id: grantId })
      if (after !== undefined) params.set('after', String(after))
      if (limit !== undefined) params.set('limit', String(limit))
      return this.transport.get<RuntimeApiRecord>(`/api/terminals/${encodeURIComponent(terminalId)}/output?${params.toString()}`)
    },
    close: async (terminalId: string, grantId: string) => this.transport.post<RuntimeApiRecord>(`/api/terminals/${encodeURIComponent(terminalId)}/close?grant_id=${encodeURIComponent(grantId)}`),
    remove: async (terminalId: string, grantId: string) => { await this.transport.delete(`/api/terminals/${encodeURIComponent(terminalId)}?grant_id=${encodeURIComponent(grantId)}`) },
  }

  readonly artifacts = {
    list: async (options: { runId?: string; limit?: number } = {}) => {
      const params = new URLSearchParams()
      if (options.runId?.trim()) params.set('run_id', options.runId.trim())
      if (options.limit !== undefined) params.set('limit', String(Math.min(500, Math.max(1, options.limit))))
      const suffix = params.toString() ? `?${params.toString()}` : ''
      return unwrapArray(await this.transport.get<RuntimeApiRecord>(`/api/artifacts${suffix}`), 'artifacts')
    },
    create: async (request: RuntimeApiRecord) => this.transport.post<RuntimeApiRecord>('/api/artifacts', request),
    upload: async (content: Blob | ArrayBuffer, options: { kind?: string; mimeType?: string; runId?: string; trusted?: boolean; expiresAt?: number; metadata?: RuntimeApiRecord } = {}) => {
      const headers: Record<string, string> = {
        'Content-Type': options.mimeType ?? (content instanceof Blob ? content.type : 'application/octet-stream'),
      }
      if (options.kind) headers['x-artifact-kind'] = options.kind
      if (options.runId) headers['x-run-id'] = options.runId
      if (options.trusted !== undefined) headers['x-artifact-trusted'] = String(options.trusted)
      if (options.expiresAt !== undefined) headers['x-artifact-expires-at'] = String(options.expiresAt)
      if (options.metadata) headers['x-artifact-metadata'] = JSON.stringify(options.metadata)
      return this.transport.postRaw<RuntimeApiRecord>('/api/artifacts', content, headers)
    },
    get: async (artifactId: string) => this.transport.get<RuntimeApiRecord>(`/api/artifacts/${encodeURIComponent(artifactId)}`),
    content: async (artifactId: string) => this.transport.getBlob(`/api/artifacts/${encodeURIComponent(artifactId)}/content`),
    remove: async (artifactId: string) => { await this.transport.delete(`/api/artifacts/${encodeURIComponent(artifactId)}`) },
  }

  readonly reasoning = {
    plan: async (objective: string) => this.transport.post<RuntimeApiRecord>('/api/reasoning/plan', { objective }),
  }

  readonly metrics = {
    get: async () => this.transport.get<RuntimeApiRecord>('/api/metrics'),
  }

  readonly audit = {
    list: async (limit = 100) => {
      const data = await this.transport.get<RuntimeApiRecord>(`/api/audit?limit=${Math.min(500, Math.max(1, limit))}`)
      return unwrapArray(data, 'events')
    },
  }

  readonly usage = {
    summary: async () => this.transport.get<RuntimeApiRecord>('/api/usage/summary'),
    records: async () => unwrapArray(await this.transport.get<RuntimeApiRecord>('/api/usage/records'), 'records'),
    setPricing: async (request: RuntimeApiRecord) => this.transport.post<RuntimeApiRecord>('/api/usage/pricing', request),
  }

  readonly sandbox = {
    status: async () => this.transport.get<RuntimeApiRecord>('/api/sandbox/status'),
  }

  readonly a2a = {
    agentCard: async () => this.transport.get<RuntimeApiRecord>('/.well-known/agent-card.json'),
    sendMessage: async (message: RuntimeApiRecord) => this.transport.post<RuntimeApiRecord>('/a2a', {
      jsonrpc: '2.0',
      id: 'ui-' + Date.now(),
      method: 'message/send',
      params: { message },
    }).then((response) => isRecord(response) && isRecord(response.result) ? response.result : response),
    getTask: async (taskId: string) => this.transport.post<RuntimeApiRecord>('/a2a', {
      jsonrpc: '2.0',
      id: 'ui-' + Date.now(),
      method: 'tasks/get',
      params: { id: taskId },
    }).then((response) => isRecord(response) && isRecord(response.result) ? response.result : response),
    cancelTask: async (taskId: string) => this.transport.post<RuntimeApiRecord>('/a2a', {
      jsonrpc: '2.0',
      id: 'ui-' + Date.now(),
      method: 'tasks/cancel',
      params: { id: taskId },
    }).then((response) => isRecord(response) && isRecord(response.result) ? response.result : response),
  }
}

export const runtime = new AgenticosRuntime()
