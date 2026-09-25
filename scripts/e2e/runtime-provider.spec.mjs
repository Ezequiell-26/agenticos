import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const frontendDir = join(repoRoot, 'crates/presentation/desktop/frontend')
const apiBinary = join(repoRoot, 'target/debug/agenticos-api-server')

function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
      if (stderr.length > 20_000) stderr = stderr.slice(-20_000)
    })
    child.once('error', rejectPromise)
    child.once('exit', (code, signal) => {
      if (code === 0) resolvePromise()
      else rejectPromise(new Error(`Process ${command} exited with code ${code ?? 'null'} signal ${signal ?? 'null'}${stderr ? `\\n${stderr}` : ''}`))
    })
  })
}

function startProcess(command, args, env) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString()
    if (stdout.length > 12_000) stdout = stdout.slice(-12_000)
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
    if (stderr.length > 20_000) stderr = stderr.slice(-20_000)
  })
  return {
    child,
    getLogs: () => `stdout:\\n${stdout}\n\nstderr:\\n${stderr}`,
  }
}

async function freePort() {
  const server = createServer()
  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise))
  const port = server.address().port
  await new Promise((resolvePromise) => server.close(resolvePromise))
  return port
}

async function waitForHttp(url, processInfo, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (processInfo.child.exitCode !== null) {
      throw new Error(`Process exited before ${url} became available.\n${processInfo.getLogs()}`)
    }
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Service is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
  }
  throw new Error(`Timed out waiting for ${url}.\n${processInfo.getLogs()}`)
}

async function stopProcess(processInfo) {
  if (!processInfo || processInfo.child.exitCode !== null) return
  processInfo.child.kill('SIGTERM')
  await new Promise((resolvePromise) => {
    const timer = setTimeout(() => {
      if (processInfo.child.exitCode === null) processInfo.child.kill('SIGKILL')
    }, 5_000)
    processInfo.child.once('exit', () => {
      clearTimeout(timer)
      resolvePromise()
    })
  })
}

test.describe.configure({ timeout: 120_000 })

test.describe('AgentiCOS desktop runtime E2E', () => {
  let provider
  let api
  let preview
  let tempRoot
  let apiUrl
  let frontendUrl
  const receivedRequests = []

  test.beforeAll(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'agenticos-ui-e2e-'))
    const providerPort = await freePort()
    const apiPort = await freePort()
    const frontendPort = await freePort()

    provider = createServer(async (request, response) => {
      if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
        response.writeHead(404)
        response.end()
        return
      }
      const chunks = []
      for await (const chunk of request) chunks.push(chunk)
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      receivedRequests.push(payload)
      const message = payload?.messages?.find((item) => item?.role === 'user')?.content ?? ''
      const body = JSON.stringify({
        id: 'chatcmpl-agenticos-ui-e2e',
        object: 'chat.completion',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: `E2E provider response: ${message}` },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 },
      })
      response.writeHead(200, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
        connection: 'close',
      })
      response.end(body)
    })
    await new Promise((resolvePromise) => provider.listen(providerPort, '127.0.0.1', resolvePromise))

    apiUrl = `http://127.0.0.1:${apiPort}`
    const projectPath = '.'
    api = startProcess(apiBinary, [], {
      AGENTICOS_BIND_HOST: '127.0.0.1',
      AGENTICOS_BIND_PORT: String(apiPort),
      AGENTICOS_PROVIDER_URL: `http://127.0.0.1:${providerPort}/v1/chat/completions`,
      AGENTICOS_PROVIDER_NAME: 'e2e-provider',
      AGENTICOS_MODEL: 'e2e-model',
      AGENTICOS_ALLOW_ANONYMOUS_PROVIDER: 'true',
      AGENTICOS_DATABASE_URL: `sqlite://${join(tempRoot, 'agenticos.db').replaceAll('\\\\', '/') }?mode=rwc`,
      AGENTICOS_ARTIFACT_ROOT: join(tempRoot, 'artifacts'),
      AGENTICOS_PROJECT_PATH: projectPath,
      AGENTICOS_SKILLS_ROOT: 'skills',
      AGENTICOS_OUTBOX_PUBLISH_INTERVAL_MS: '5000',
      AGENTICOS_SESSION_RECOVERY_HISTORY_LIMIT: '16',
    })
    await waitForHttp(`${apiUrl}/ready`, api)

    preview = startProcess('npm', ['run', 'preview', '--prefix', frontendDir, '--', '--host', '127.0.0.1', '--port', String(frontendPort)], {
      env: { VITE_AGENTICOS_API_URL: apiUrl },
    })
    frontendUrl = `http://127.0.0.1:${frontendPort}`
    await waitForHttp(frontendUrl, preview)
  })

  test.afterAll(async () => {
    await stopProcess(preview)
    await stopProcess(api)
    if (provider) {
      await new Promise((resolvePromise) => provider.close(resolvePromise))
    }
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true })
  })

  test('connects the UI to the runtime, provider, response and persisted history', async ({ page }) => {
    await page.goto(frontendUrl, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-runtime="connected"]')).toBeVisible({ timeout: 30_000 })

    const composer = page.getByRole('textbox', { name: 'Message AgentiCOS' })
    await composer.fill('desktop UI E2E')
    await page.getByRole('button', { name: 'Send message' }).click()

    await expect(page.getByText('E2E provider response: desktop UI E2E', { exact: true })).toBeVisible({
      timeout: 30_000,
    })

    expect(receivedRequests).toHaveLength(1)
    expect(receivedRequests[0]?.model).toBe('e2e-model')
    expect(receivedRequests[0]?.messages?.[0]?.content).toBe('desktop UI E2E')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-runtime="connected"]')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('E2E provider response: desktop UI E2E', { exact: true })).toBeVisible({
      timeout: 30_000,
    })
  })
})
