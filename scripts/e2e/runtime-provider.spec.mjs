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
  const childEnv = { ...process.env, ...env }
  for (const [key, value] of Object.entries(env ?? {})) {
    if (value === undefined) delete childEnv[key]
  }
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: childEnv,
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
  let startApi
  const receivedRequests = []

  test.beforeAll(async () => {
    test.setTimeout(120_000)
    tempRoot = await mkdtemp(join(tmpdir(), 'agenticos-ui-e2e-'))
    const providerPort = await freePort()
    const apiPort = 8080
    const frontendPort = await freePort()

    provider = createServer(async (request, response) => {
      if (request.method === 'GET' && request.url === '/v1/models') {
        const body = JSON.stringify({
          object: 'list',
          data: [
            { id: 'e2e-model', object: 'model', owned_by: 'agenticos-e2e' },
            { id: 'e2e-embedding', object: 'model', owned_by: 'agenticos-e2e' },
          ],
        })
        response.writeHead(200, {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          connection: 'close',
        })
        response.end(body)
        return
      }

      if (request.method !== 'POST' || !['/v1/chat/completions', '/v1/embeddings'].includes(request.url)) {
        response.writeHead(404)
        response.end()
        return
      }

      const chunks = []
      for await (const chunk of request) chunks.push(chunk)
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))

      if (request.url === '/v1/embeddings') {
        const inputs = Array.isArray(payload.input) ? payload.input : [payload.input]
        const embeddings = inputs.map((value) =>
          String(value).toLowerCase().includes('rust') ? [1, 0] : [0, 1],
        )
        const body = JSON.stringify({
          object: 'list',
          data: embeddings.map((embedding, index) => ({
            object: 'embedding',
            index,
            embedding,
          })),
          model: payload.model ?? 'e2e-embedding',
        })
        response.writeHead(200, {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          connection: 'close',
        })
        response.end(body)
        return
      }

      receivedRequests.push(payload)
      const serializedPayload = JSON.stringify(payload)
      if (!serializedPayload.includes('desktop UI E2E')) {
        response.writeHead(400, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ error: { message: 'expected E2E input was not present' } }))
        return
      }
      const body = JSON.stringify({
        id: 'chatcmpl-agenticos-ui-e2e',
        object: 'chat.completion',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'E2E provider response' },
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

    apiUrl = 'http://127.0.0.1:8080'
    const projectPath = '.'
    const apiEnv = {
      AGENTICOS_BIND_HOST: '127.0.0.1',
      AGENTICOS_BIND_PORT: String(apiPort),
      AGENTICOS_PROVIDERS_JSON: undefined,
      AGENTICOS_PROVIDER_URL: `http://127.0.0.1:${providerPort}/v1/chat/completions`,
      AGENTICOS_PROVIDER_NAME: 'e2e-provider',
      AGENTICOS_MODEL: 'e2e-model',
      AGENTICOS_MEMORY_EMBEDDINGS: 'true',
      AGENTICOS_EMBEDDING_MODEL: 'e2e-embedding',
      AGENTICOS_EMBEDDING_PROVIDER: 'e2e-provider',
      AGENTICOS_ALLOW_ANONYMOUS_PROVIDER: 'true',
      AGENTICOS_DATABASE_URL: `sqlite://${join(tempRoot, 'agenticos.db').replaceAll('\\\\', '/') }?mode=rwc`,
      AGENTICOS_ARTIFACT_ROOT: join(tempRoot, 'artifacts'),
      AGENTICOS_PROJECT_PATH: projectPath,
      AGENTICOS_SKILLS_ROOT: 'skills',
      AGENTICOS_OUTBOX_PUBLISH_INTERVAL_MS: '5000',
      AGENTICOS_SESSION_RECOVERY_HISTORY_LIMIT: '16',
      AGENTICOS_DISABLE_SCHEDULER_WORKER: 'true',
    }
    startApi = async (verifyProvider = true) => {
      api = startProcess(apiBinary, [], apiEnv)
      await waitForHttp(`${apiUrl}/health`, api)
      if (verifyProvider) {
        const providerHealth = await fetch(
          `${apiUrl}/api/providers/e2e-provider/health`,
          { method: 'POST' },
        )
        if (!providerHealth.ok) {
          throw new Error(
            `Provider health check failed: HTTP ${providerHealth.status} ${await providerHealth.text()}`,
          )
        }
        await waitForHttp(`${apiUrl}/ready`, api)
      }
    }
    await startApi()
    
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
    const chatResponses = []
    page.on('response', async (response) => {
      if (response.url().endsWith('/api/agent/chat') && response.request().method() === 'POST') {
        let body = ''
        try { body = await response.text() } catch {}
        chatResponses.push({ status: response.status(), body })
      }
    })

    await page.goto(frontendUrl, { waitUntil: 'domcontentloaded' })
    const shell = page.locator('.app-shell')
    await expect(shell).toBeVisible({ timeout: 30_000 })

    const composer = page.getByRole('textbox', { name: 'Message AgentiCOS' })
    await composer.fill('desktop UI E2E')
    await page.getByRole('button', { name: 'Send message' }).click()

    try {
      await expect(page.getByText('E2E provider response', { exact: true })).toBeVisible({
        timeout: 30_000,
      })
    } catch (error) {
      const bodyText = await page.locator('body').innerText()
      throw new Error(
        `UI did not render the provider response. chatResponses=${JSON.stringify(chatResponses)}\\nbody=\\n${bodyText}\\n${error}`,
      )
    }
    await expect.poll(async () => shell.getAttribute('data-runtime'), { timeout: 10_000 }).toBe('connected')

    expect(receivedRequests).toHaveLength(1)
    expect(receivedRequests[0]?.model).toBe('e2e-model')
    expect(JSON.stringify(receivedRequests[0])).toContain('desktop UI E2E')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(shell).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('E2E provider response', { exact: true })).toBeVisible({
      timeout: 30_000,
    })
  })

  test('exercises semantic memory coverage and evaluation through the API', async () => {
    const rustMemory = await fetch(apiUrl + '/api/memory', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        namespace: 'project:semantic-e2e',
        key: 'rust-runtime',
        value: 'durable Rust runtime and worker recovery',
        tags: ['runtime'],
        importance: 0.9,
      }),
    })
    expect(rustMemory.status).toBe(200)
    const rustRecord = await rustMemory.json()

    const pythonMemory = await fetch(apiUrl + '/api/memory', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        namespace: 'project:semantic-e2e',
        key: 'python-notes',
        value: 'python scripting notes',
        tags: ['notes'],
        importance: 0.4,
      }),
    })
    expect(pythonMemory.status).toBe(200)

    const providersResponse = await fetch(apiUrl + '/api/providers')
    expect(providersResponse.status).toBe(200)
    const providersBody = await providersResponse.json()
    const e2eProvider = providersBody.providers.find((provider) => provider.provider_id === 'e2e-provider')
    expect(e2eProvider).toBeTruthy()
    expect(e2eProvider.capabilities).toContain('embeddings')
    expect(e2eProvider.models).toContain('e2e-embedding')

    const backfill = await fetch(apiUrl + '/api/memory/backfill', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        namespace: 'project:semantic-e2e',
        limit: 2,
      }),
    })
    if (!backfill.ok) {
      throw new Error(
        `Memory embedding backfill failed: HTTP ${backfill.status} ${await backfill.text()}`,
      )
    }

    const coverage = await fetch(
      apiUrl + '/api/memory/coverage?namespace=project%3Asemantic-e2e',
    )
    expect(coverage.status).toBe(200)
    const coverageBody = await coverage.json()
    expect(coverageBody.total_records).toBe(2)
    expect(coverageBody.embedded_records).toBe(2)
    expect(coverageBody.missing_records).toBe(0)

    const evaluation = await fetch(apiUrl + '/api/memory/evaluate-semantic', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        namespace: 'project:semantic-e2e',
        cases: [{
          query_embedding: [1, 0],
          relevant_memory_ids: [rustRecord.memory_id],
        }],
        limit: 2,
      }),
    })
    expect(evaluation.status).toBe(200)
    const evaluationBody = await evaluation.json()
    expect(evaluationBody.evaluated_queries).toBe(1)
    expect(evaluationBody.hit_at_1).toBe(1)
    expect(evaluationBody.hit_at_k).toBe(1)
    expect(evaluationBody.mean_reciprocal_rank).toBe(1)

    const search = await fetch(
      apiUrl + '/api/memory?namespace=project%3Asemantic-e2e&q=rust&limit=2',
    )
    expect(search.status).toBe(200)
    const searchBody = await search.json()
    expect(searchBody.records[0].key).toBe('rust-runtime')
  })

  test('executes a durable two-node workflow through the scheduler API', async () => {
    const workflow = await fetch(`${apiUrl}/api/workflows`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workflow: {
          workflow_id: 'workflow-e2e',
          name: 'workflow E2E',
          nodes: [
            { id: 'step-a', task: 'workflow step A', depends_on: [] },
            { id: 'step-b', task: 'workflow step B', depends_on: ['step-a'] },
          ],
        },
      }),
    })
    expect(workflow.status).toBe(201)

    const start = await fetch(`${apiUrl}/api/workflows/workflow-e2e/start`, {
      method: 'POST',
    })
    expect(start.status).toBe(202)
    const startBody = await start.json()
    expect(startBody.workflow_id).toBe('workflow-e2e')
    expect(startBody.jobs).toBe(2)
    expect(startBody.run_id).toBeTruthy()

    const initialReady = await fetch(`${apiUrl}/api/workflows/workflow-e2e/ready`)
    expect(initialReady.status).toBe(200)
    const initialReadyBody = await initialReady.json()
    expect(initialReadyBody.nodes.map((node) => node.id)).toEqual(['step-a'])

    const claimA = await fetch(`${apiUrl}/api/workers/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worker_id: 'workflow-worker-a', lease_seconds: 30 }),
    })
    expect(claimA.status).toBe(200)
    const claimABody = await claimA.json()
    expect(claimABody.job.spec.job_type).toBe('workflow_node')
    expect(claimABody.job.spec.metadata.workflow_id).toBe('workflow-e2e')
    expect(claimABody.job.spec.metadata.node_id).toBe('step-a')

    const completeA = await fetch(
      `${apiUrl}/api/workers/jobs/${claimABody.job.spec.job_id}/complete`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          worker_id: 'workflow-worker-a',
          lease_token: claimABody.job.lease_token,
          success: true,
          output: 'step A complete',
        }),
      },
    )
    expect(completeA.status).toBe(200)

    const afterAState = await fetch(`${apiUrl}/api/workflows/workflow-e2e/state`)
    expect(afterAState.status).toBe(200)
    const afterAStateBody = await afterAState.json()
    expect(afterAStateBody.nodes['step-a']).toBe('Succeeded')
    expect(afterAStateBody.nodes['step-b']).toBe('Ready')

    const readyJobs = await fetch(`${apiUrl}/api/jobs/ready`)
    expect(readyJobs.status).toBe(200)
    const readyJobsBody = await readyJobs.json()
    expect(readyJobsBody.jobs.some((job) => job.spec.job_id.endsWith('-step-b'))).toBe(true)

    const claimB = await fetch(`${apiUrl}/api/workers/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worker_id: 'workflow-worker-b', lease_seconds: 30 }),
    })
    expect(claimB.status).toBe(200)
    const claimBBody = await claimB.json()
    expect(claimBBody.job.spec.metadata.node_id).toBe('step-b')

    const completeB = await fetch(
      `${apiUrl}/api/workers/jobs/${claimBBody.job.spec.job_id}/complete`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          worker_id: 'workflow-worker-b',
          lease_token: claimBBody.job.lease_token,
          success: true,
          output: 'step B complete',
        }),
      },
    )
    expect(completeB.status).toBe(200)

    const finalRun = await fetch(`${apiUrl}/api/runs/${startBody.run_id}`)
    expect(finalRun.status).toBe(200)
    const finalRunBody = await finalRun.json()
    expect(finalRunBody.state).toBe('Completed')

    const finalWorkflowState = await fetch(`${apiUrl}/api/workflows/workflow-e2e/state`)
    expect(finalWorkflowState.status).toBe(200)
    const finalWorkflowStateBody = await finalWorkflowState.json()
    expect(finalWorkflowStateBody.nodes['step-a']).toBe('Succeeded')
    expect(finalWorkflowStateBody.nodes['step-b']).toBe('Succeeded')
  })
  test('recovers workflow definition and state after API restart', async () => {
    const workflow = await fetch(apiUrl + '/api/workflows', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workflow: {
          workflow_id: 'workflow-restart-e2e',
          name: 'restart recovery',
          nodes: [
            { id: 'step-a', task: 'restart step A', depends_on: [] },
            { id: 'step-b', task: 'restart step B', depends_on: ['step-a'] },
          ],
        },
      }),
    })
    expect(workflow.status).toBe(201)

    const started = await fetch(apiUrl + '/api/workflows/workflow-restart-e2e/start', {
      method: 'POST',
    })
    expect(started.status).toBe(202)
    const startedBody = await started.json()
    expect(startedBody.run_id).toBeTruthy()

    const initialState = await fetch(apiUrl + '/api/workflows/workflow-restart-e2e/state')
    expect(initialState.status).toBe(200)
    const initialStateBody = await initialState.json()
    expect(initialStateBody.nodes['step-a']).toBe('Ready')
    expect(initialStateBody.nodes['step-b']).toBe('Pending')

    await stopProcess(api)
    api = null
    await startApi(false)

    const recoveredState = await fetch(apiUrl + '/api/workflows/workflow-restart-e2e/state')
    expect(recoveredState.status).toBe(200)
    const recoveredStateBody = await recoveredState.json()
    expect(recoveredStateBody.nodes['step-a']).toBe('Ready')
    expect(recoveredStateBody.nodes['step-b']).toBe('Pending')

    const recoveredReady = await fetch(apiUrl + '/api/workflows/workflow-restart-e2e/ready')
    expect(recoveredReady.status).toBe(200)
    const recoveredReadyBody = await recoveredReady.json()
    expect(recoveredReadyBody.nodes.map((node) => node.id)).toEqual(['step-a'])

    const claimA = await fetch(apiUrl + '/api/workers/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worker_id: 'workflow-restart-worker-a', lease_seconds: 30 }),
    })
    expect(claimA.status).toBe(200)
    const claimABody = await claimA.json()
    expect(claimABody.job.spec.metadata.node_id).toBe('step-a')

    const completeA = await fetch(
      apiUrl + '/api/workers/jobs/' + claimABody.job.spec.job_id + '/complete',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          worker_id: 'workflow-restart-worker-a',
          lease_token: claimABody.job.lease_token,
          success: true,
          output: 'restart step A complete',
        }),
      },
    )
    expect(completeA.status).toBe(200)

    const claimB = await fetch(apiUrl + '/api/workers/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worker_id: 'workflow-restart-worker-b', lease_seconds: 30 }),
    })
    expect(claimB.status).toBe(200)
    const claimBBody = await claimB.json()
    expect(claimBBody.job.spec.metadata.node_id).toBe('step-b')

    const completeB = await fetch(
      apiUrl + '/api/workers/jobs/' + claimBBody.job.spec.job_id + '/complete',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          worker_id: 'workflow-restart-worker-b',
          lease_token: claimBBody.job.lease_token,
          success: true,
          output: 'restart step B complete',
        }),
      },
    )
    expect(completeB.status).toBe(200)

    const recoveredRun = await fetch(apiUrl + '/api/runs/' + startedBody.run_id)
    expect(recoveredRun.status).toBe(200)
    const recoveredRunBody = await recoveredRun.json()
    expect(recoveredRunBody.state).toBe('Completed')
  })
  test('recovers an expired worker lease and fences the stale worker', async () => {
    const createRun = await fetch(`${apiUrl}/api/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        objective: 'recover worker after restart',
        run_id: 'worker-recovery-run',
      }),
    })
    if (!createRun.ok) {
      throw new Error(
        `Run creation failed: HTTP ${createRun.status} ${await createRun.text()}`,
      )
    }
    const claimA = await fetch(`${apiUrl}/api/workers/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worker_id: 'worker-a', lease_seconds: 5 }),
    })
    expect(claimA.status).toBe(200)
    const claimBody = await claimA.json()
    expect(claimBody.worker_id).toBe('worker-a')
    expect(claimBody.job.state).toBe('Running')
    expect(claimBody.job.lease_owner).toBe('worker-a')
    const staleToken = claimBody.job.lease_token

    await stopProcess(api)
    api = null

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 6_000))

    await startApi(false)

    const recoveredBeforeClaim = await fetch(
      `${apiUrl}/api/jobs/job-worker-recovery-run`,
    )
    if (!recoveredBeforeClaim.ok) {
      throw new Error(
        `Recovered job lookup failed: HTTP ${recoveredBeforeClaim.status} ${await recoveredBeforeClaim.text()}`,
      )
    }
    const recoveredBeforeClaimBody = await recoveredBeforeClaim.json()
    if (recoveredBeforeClaimBody.state !== 'Ready') {
      throw new Error(
        `Recovered job was not ready for reclaim: ${JSON.stringify(recoveredBeforeClaimBody)}`,
      )
    }

    const readyJobs = await fetch(`${apiUrl}/api/jobs/ready`)
    if (!readyJobs.ok) {
      throw new Error(
        `Ready jobs lookup failed: HTTP ${readyJobs.status} ${await readyJobs.text()}`,
      )
    }
    const readyJobsBody = await readyJobs.json()
    if (!readyJobsBody.jobs.some((job) => job.spec?.job_id === 'job-worker-recovery-run')) {
      throw new Error(
        `Recovered job was not present in /api/jobs/ready: recovered=${JSON.stringify(recoveredBeforeClaimBody)} ready=${JSON.stringify(readyJobsBody)}`,
      )
    }

    const claimB = await fetch(`${apiUrl}/api/workers/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worker_id: 'worker-b', lease_seconds: 30 }),
    })
    if (claimB.status !== 200) {
      throw new Error(
        `Worker reclaim failed: HTTP ${claimB.status} ${await claimB.text()}`,
      )
    }
    const claimBBody = await claimB.json()
    expect(claimBBody.worker_id).toBe('worker-b')
    expect(claimBBody.job.attempts).toBe(2)
    expect(claimBBody.job.lease_owner).toBe('worker-b')
    expect(claimBBody.job.lease_token).toBeGreaterThan(staleToken)

    const staleHeartbeat = await fetch(
      `${apiUrl}/api/workers/jobs/job-worker-recovery-run/heartbeat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          worker_id: 'worker-a',
          lease_token: staleToken,
          lease_seconds: 30,
        }),
      },
    )
    expect(staleHeartbeat.status).toBe(409)

    const completion = await fetch(
      `${apiUrl}/api/workers/jobs/job-worker-recovery-run/complete`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          worker_id: 'worker-b',
          lease_token: claimBBody.job.lease_token,
          success: true,
          output: 'recovered',
        }),
      },
    )
    expect(completion.status).toBe(200)

    const recoveredJob = await fetch(`${apiUrl}/api/jobs/job-worker-recovery-run`)
    expect(recoveredJob.status).toBe(200)
    const recoveredBody = await recoveredJob.json()
    expect(recoveredBody.state).toBe('Succeeded')
  })
})
