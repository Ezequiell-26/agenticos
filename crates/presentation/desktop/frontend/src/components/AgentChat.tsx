import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

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

export default function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [backendHealth, setBackendHealth] = useState<string>('checking...');

  useEffect(() => {
    // Check backend health on mount
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const health = await invoke<any>('get_backend_health');
      setBackendHealth(health.status === 'healthy' ? 'healthy' : 'not_ready');
    } catch (error) {
      setBackendHealth('offline');
      console.error('Backend health check failed:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response: AgentResponse = await invoke('send_agent_message', {
        message: input,
        sessionId: sessionId || undefined,
      });

      if (!sessionId) {
        setSessionId(response.session_id);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.content,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Error: Failed to communicate with backend. Please check if the backend is running.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadHistory = async () => {
    if (!sessionId) return;

    try {
      const history: Message[] = await invoke('get_conversation_history', {
        sessionId,
      });
      setMessages(history);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

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
                onClick={handleLoadHistory}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              >
                Load History
              </button>
            )}
          </div>
        </div>
        {sessionId && (
          <p className="text-xs text-gray-500 mt-1">Session: {sessionId}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-10">
            <p>No messages yet. Start a conversation!</p>
          </div>
        )}
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] p-3 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-100'
              }`}
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
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-white"
          />
          <button
            onClick={handleSendMessage}
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
