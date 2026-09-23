import { useState } from 'react'
import type { ChatMessage } from '../types/runtime'

interface ChatInterfaceProps {
  sessionId: string
  onSend: (sessionId: string, message: string) => Promise<ChatMessage>
}

function ChatInterface({ sessionId, onSend }: ChatInterfaceProps) {
  const [message, setMessage] = useState('')
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = async () => {
    const trimmed = message.trim()
    if (!trimmed || isLoading) return

    setIsLoading(true)
    try {
      const result = await onSend(sessionId, trimmed)
      setResponse(result.content)
      setMessage('')
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'The request could not be completed.'
      setResponse('Request failed: ' + detail)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="legacy-chat-interface" aria-label="Chat interface">
      <div className="legacy-chat-interface__header">
        <div>
          <span className="eyebrow">Compatibility surface</span>
          <h2>Chat interface</h2>
        </div>
        <span className="state-pill state-pill--pending">Service-owned</span>
      </div>
      <div className="legacy-chat-interface__body">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Type a message…"
          disabled={isLoading}
          aria-label="Message"
          rows={4}
        />
        <button
          type="button"
          onClick={() => void sendMessage()}
          disabled={isLoading || !message.trim()}
          className="studio-button studio-button--active"
        >
          {isLoading ? 'Sending…' : 'Send'}
        </button>
        {response && (
          <div className="legacy-chat-interface__response">
            <span className="eyebrow">Response</span>
            <p>{response}</p>
          </div>
        )}
      </div>
    </section>
  )
}

export default ChatInterface
