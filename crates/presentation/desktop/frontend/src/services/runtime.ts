import type {
  AgentStatusSnapshot,
  ChatMessage,
  RuntimeServices,
} from '../types/runtime'

interface HttpTransport {
  get<T>(path: string): Promise<T>
  post<T>(path: string, body: unknown): Promise<T>
}

class FetchTransport implements HttpTransport {
  constructor(private readonly baseUrl: string) {}

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`)
    if (!response.ok) throw new Error(`GET ${path} failed with ${response.status}`)
    return response.json() as Promise<T>
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`POST ${path} failed with ${response.status}`)
    return response.json() as Promise<T>
  }
}

const fallbackStatus: AgentStatusSnapshot = {
  agentName: 'AgentiCOS',
  state: 'idle',
  provider: 'Runtime offline',
  model: 'Waiting for backend',
}

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    content,
    timestamp: Date.now(),
  }
}

export class AgenticosRuntime implements RuntimeServices {
  private readonly transport: HttpTransport

  constructor(baseUrl = import.meta.env.VITE_AGENTICOS_API_URL ?? 'http://127.0.0.1:8080') {
    this.transport = new FetchTransport(baseUrl)
  }

  readonly chat = {
    sendMessage: async (sessionId: string, message: string): Promise<ChatMessage> => {
      try {
        const data = await this.transport.post<{ response?: string }>('/api/agent/chat', {
          message,
          session_id: sessionId,
        })
        return createMessage('assistant', data.response?.trim() || 'The runtime returned an empty response.')
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Unknown runtime error'
        return createMessage(
          'system',
          `Runtime unavailable. Start the AgentiCOS backend to send live requests.\n\n${detail}`,
        )
      }
    },
  }

  readonly status = {
    get: async (): Promise<AgentStatusSnapshot> => {
      try {
        const data = await this.transport.get<{ agent_name?: string }>('/api/agent/status')
        return {
          agentName: data.agent_name || 'AgentiCOS',
          state: 'idle',
          provider: 'Connected runtime',
          model: 'Provider selected by runtime',
        }
      } catch {
        return fallbackStatus
      }
    },
  }

  readonly conversations = {
    history: async (sessionId: string): Promise<ChatMessage[]> => {
      try {
        const data = await this.transport.get<{
          history?: Array<{ role?: string; content?: string; timestamp?: number }>
        }>(`/api/conversations/${encodeURIComponent(sessionId)}/history`)

        return (data.history ?? []).map((entry, index) => ({
          id: `history-${sessionId}-${index}-${entry.timestamp ?? 0}`,
          role: entry.role === 'user' ? 'user' : 'assistant',
          content: entry.content ?? '',
          timestamp: entry.timestamp ?? Date.now(),
        }))
      } catch {
        return []
      }
    },
  }
}

export const runtime = new AgenticosRuntime()
