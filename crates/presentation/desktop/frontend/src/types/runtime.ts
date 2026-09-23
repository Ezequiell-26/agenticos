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

export interface AgentStatusSnapshot {
  agentName: string
  state: AgentRunState
  provider: string
  model: string
  latencyMs?: number
}

export interface ConversationSummary {
  id: string
  title: string
  preview: string
  timestamp: number
  pinned?: boolean
}

export interface RuntimeServices {
  chat: {
    sendMessage(sessionId: string, message: string): Promise<ChatMessage>
  }
  status: {
    get(): Promise<AgentStatusSnapshot>
  }
  conversations: {
    history(sessionId: string): Promise<ChatMessage[]>
  }
}
