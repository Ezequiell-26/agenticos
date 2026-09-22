import { useState, useEffect } from 'react'

interface AgentStatusProps {
  apiUrl: string
}

function AgentStatus({ apiUrl }: AgentStatusProps) {
  const [status, setStatus] = useState<string>('Loading...')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/agent/status`)
        const data = await res.json()
        setStatus(data.agent_name || 'Unknown')
      } catch (error) {
        setStatus('Error loading status')
      } finally {
        setIsLoading(false)
      }
    }

    loadStatus()
  }, [apiUrl])

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Agent Status</h2>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <div>
          <p className="text-gray-300">Agent Name:</p>
          <p className="text-2xl font-bold">{status}</p>
        </div>
      )}
    </div>
  )
}

export default AgentStatus
