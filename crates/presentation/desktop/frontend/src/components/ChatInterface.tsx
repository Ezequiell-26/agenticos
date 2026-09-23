import { useState } from 'react'

interface ChatInterfaceProps {
  sessionId: string
  apiUrl: string
}

function ChatInterface({ sessionId, apiUrl }: ChatInterfaceProps) {
  const [message, setMessage] = useState('')
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = async () => {
    if (!message.trim()) return

    setIsLoading(true)
    try {
      const res = await fetch(`${apiUrl}/api/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          session_id: sessionId,
        }),
      })

      const data = await res.json()
      setResponse(data.response || 'No response')
      setMessage('')
    } catch (error) {
      setResponse(`Error: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Chat Interface</h2>
      <div className="space-y-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          className="w-full h-32 p-2 bg-gray-700 rounded text-white resize-none"
          disabled={isLoading}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !message.trim()}
          className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-600"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
        {response && (
          <div className="mt-4 p-4 bg-gray-700 rounded">
            <h3 className="font-semibold mb-2">Response:</h3>
            <p className="whitespace-pre-wrap">{response}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatInterface
