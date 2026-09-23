import { useState } from 'react'
import ChatInterface from './components/ChatInterface'
import ConversationHistory from './components/ConversationHistory'
import AgentStatus from './components/AgentStatus'

function App() {
  const [sessionId] = useState<string>('default')
  const apiUrl = 'http://127.0.0.1:8080'

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-4">AgentiCOS Desktop</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ChatInterface sessionId={sessionId} apiUrl={apiUrl} />
          </div>
          <div className="space-y-4">
            <AgentStatus apiUrl={apiUrl} />
            <ConversationHistory sessionId={sessionId} apiUrl={apiUrl} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
