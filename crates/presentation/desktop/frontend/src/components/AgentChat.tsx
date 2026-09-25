import { useEffect, useState } from 'react';
import { runtime, RuntimeHttpError } from '../services/runtime';
import type { ChatMessage } from '../types/runtime';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

function toMessage(message: ChatMessage): Message | null {
  if (message.role !== 'user' && message.role !== 'assistant') return null;
  return {
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
  };
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof RuntimeHttpError) {
    return error.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export default function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId] = useState(() => `desktop-session-${Date.now()}`);
  const [isLoading, setIsLoading] = useState(false);
  const [backendHealth, setBackendHealth] = useState('checking...');

  useEffect(() => {
    void checkBackendHealth();
  }, []);

  async function checkBackendHealth() {
    try {
      const health = await runtime.health.get();
      setBackendHealth(health.status === 'healthy' ? 'healthy' : 'not_ready');
    } catch {
      setBackendHealth('offline');
    }
  }

  async function handleSendMessage() {
    const message = input.trim();
    if (!message || isLoading) return;

    setMessages((prev) => [...prev, { role: 'user', content: message, timestamp: Date.now() }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await runtime.chat.sendMessage(sessionId, message);
      const assistant = toMessage(response);
      if (!assistant) throw new Error('Runtime returned an invalid assistant message.');
      setMessages((prev) => [...prev, assistant]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${errorMessage(error, 'Backend communication failed.')}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLoadHistory() {
    try {
      const history = await runtime.conversations.history(sessionId);
      setMessages(history.map(toMessage).filter((message): message is Message => message !== null));
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${errorMessage(error, 'History request failed.')}`,
          timestamp: Date.now(),
        },
      ]);
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
            <button
              onClick={() => void handleLoadHistory()}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
            >
              Load History
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">Session: {sessionId}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-10">
            <p>No messages yet. Start a conversation!</p>
          </div>
        )}
        {messages.map((msg, index) => (
          <div
            key={`${msg.role}-${msg.timestamp ?? index}-${index}`}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'}`}
            >
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
