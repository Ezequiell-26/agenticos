import { useEffect, useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

interface AgentResponse {
  content: string;
  is_complete: boolean;
  session_id: string;
}

interface BackendHealth {
  status: string;
  version: string;
  uptime_seconds: number;
}

interface HistoryResponse {
  history: Array<{
    role: string;
    content: string;
    timestamp?: number;
  }>;
}

const API_BASE_URL = (import.meta.env.VITE_AGENTICOS_API_URL ?? 'http://127.0.0.1:8080').replace(/\/+$/, '');
const API_TOKEN = import.meta.env.VITE_AGENTICOS_API_TOKEN as string | undefined;

function headers(): Record<string, string> {
  return {
    ...(API_TOKEN?.trim() ? { Authorization: `Bearer ${API_TOKEN.trim()}` } : {}),
  };
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `API request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export default function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [backendHealth, setBackendHealth] = useState('checking...');

  useEffect(() => {
    void checkBackendHealth();
  }, []);

  async function checkBackendHealth() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, { headers: headers() });
      const health = await readJson<BackendHealth>(response);
      setBackendHealth(health.status === 'healthy' ? 'healthy' : 'not_ready');
    } catch {
      setBackendHealth('offline');
    }
  }

  async function handleSendMessage() {
    const message = input.trim();
    if (!message) return;

    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/agent/chat`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          session_id: sessionId,
        }),
      });
      const data = await readJson<AgentResponse>(response);

      setSessionId((current) => current ?? data.session_id);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.content }]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Backend communication failed.';
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${detail}` }]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLoadHistory() {
    if (!sessionId) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/conversations/${encodeURIComponent(sessionId)}/history`,
        { headers: headers() },
      );
      const data = await readJson<HistoryResponse>(response);
      setMessages(
        data.history.map((entry) => ({
          role: entry.role === 'user' ? 'user' : 'assistant',
          content: entry.content,
          timestamp: entry.timestamp,
        })),
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'History request failed.';
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${detail}` }]);
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">AgentiCOS Chat</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              Backend: <span className={backendHealth === 'healthy' ? 'text-green-400' : 'text-red-400'}>{backendHealth}</span>
            </span>
            {sessionId && (
              <button
                onClick={() => void handleLoadHistory()}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              >
                Load History
              </button>
            )}
          </div>
        </div>
        {sessionId && <p className="text-xs text-gray-500 mt-1">Session: {sessionId}</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-10">
            <p>No messages yet. Start a conversation!</p>
          </div>
        )}
        {messages.map((msg, index) => (
          <div key={`${msg.role}-${msg.timestamp ?? index}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'}`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 p-3 rounded-lg">
              <p className="text-gray-400">Thinking...</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleSendMessage();
              }
            }}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-white"
          />
          <button
            onClick={() => void handleSendMessage()}
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded font-medium"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
