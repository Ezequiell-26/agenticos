import { createInterface } from 'node:readline'

const input = createInterface({ input: process.stdin })
input.on('line', (line) => {
  let request
  try { request = JSON.parse(line) } catch { return }
  if (!request?.id) return
  const response = { jsonrpc: '2.0', id: request.id }
  if (request.method === 'initialize') {
    process.stdout.write(JSON.stringify({ ...response, result: {
      protocolVersion: '2025-06-18', capabilities: { tools: {} },
      serverInfo: { name: 'agenticos-e2e-mcp', version: '1.0.0' },
    } }) + '\n')
    return
  }
  if (request.method === 'tools/list') {
    process.stdout.write(JSON.stringify({ ...response, result: { tools: [{
      name: 'echo', description: 'Echo a message for AgentiCOS integration tests',
      inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
    }] } }) + '\n')
    return
  }
  if (request.method === 'tools/call') {
    const message = request.params?.arguments?.message ?? ''
    process.stdout.write(JSON.stringify({ ...response, result: {
      content: [{ type: 'text', text: 'MCP echo: ' + message }],
      structuredContent: { message },
    } }) + '\n')
    return
  }
  process.stdout.write(JSON.stringify({ ...response, error: { code: -32601, message: 'Method not found: ' + request.method } }) + '\n')
})
