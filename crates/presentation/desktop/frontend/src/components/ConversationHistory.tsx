import { useState, useEffect } from 'react'

interface ConversationHistoryProps {
  sessionId: string
  apiUrl: string
}

interface ConversationEntry {
  role: string
  content: string
  timestamp: number
}

function ConversationHistory({ sessionId, apiUrl }: ConversationHistoryProps) {
  const [history, setHistory] = useState<ConversationEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadHistory = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`${apiUrl}/api/conversations/${sessionId}/history`)
      const data = await res.json()
      setHistory(data.history || [])
    } catch (error) {
      console.error('Failed to load history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [sessionId, apiUrl])

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Conversation History</h2>
      {isLoading ? (
        <p>Loading...</p>
      ) : history.length === 0 ? (
        <p className="text-gray-400">No conversation history</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {history.map((entry, index) => (
            <div key={index} className="p-2 bg-gray-700 rounded">
              <div className="font-semibold text-sm text-gray-300">
                {entry.role}
              </div>
              <p className="text-sm">{entry.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ConversationHistory
