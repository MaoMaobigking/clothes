/** Local H5 verification: only mocked APIs, never calls a model or production backend. */
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import express from 'express'
import { chromium } from 'playwright'
import { createPerformanceRouter } from '../server/routes/performance.mjs'

const records = []
const app = express()
app.use('/api/telemetry/performance', createPerformanceRouter({ write: (record) => records.push(record) }))
app.get('/api/auth/demo-accounts', (_req, res) => res.json({ accounts: [] }))
app.post('/api/auth/login-password', (_req, res) =>
  res.status(401).json({ error: 'LOGIN_FAILED', message: '本地测试：密码不匹配' }),
)
app.use('/api', (_req, res) => res.status(404).json({ error: 'MOCK_NOT_FOUND' }))
app.use(express.static(resolve(process.argv[2] || '.tmp/perf-h5')))
const server = app.listen(0, '127.0.0.1')
await once(server, 'listening')
const origin = `http://127.0.0.1:${server.address().port}`
let browser
try {
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', (route) => {
    const url = route.request().url()
    return url.startsWith(origin) || url.startsWith('data:') ? route.continue() : route.abort()
  })
  await page.goto(origin)
  await page.getByText('演示账号', { exact: true }).click()
  await page.locator('input').nth(0).fill('local-only')
  await page.locator('input').nth(1).fill('must-not-be-logged')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.getByText('本地测试：密码不匹配', { exact: true }).waitFor()
  // A real interval verifies batching; the server receives the actual browser payload.
  const deadline = Date.now() + 25000
  while (Date.now() < deadline) {
    const events = records.flatMap((record) => record.events)
    if (events.some((event) => event.name === 'api_request' && !event.ok)) break
    await new Promise((done) => setTimeout(done, 200))
  }
  const events = records.flatMap((record) => record.events)
  assert.ok(
    events.some((event) => event.name === 'page_ready'),
    'missing page_ready',
  )
  assert.ok(
    events.some((event) => event.name === 'fcp'),
    'missing FCP',
  )
  assert.ok(
    events.some((event) => event.name === 'api_request' && event.ok),
    'missing successful API timing',
  )
  assert.ok(
    events.some((event) => event.name === 'api_request' && !event.ok && event.status === 401),
    'missing failed API timing',
  )
  assert.ok(
    events
      .filter((event) => ['home_data_ready', 'recommendations_ready'].includes(event.name))
      .every((event) => event.outcome === 'abandoned'),
    'login redirects must not inflate failure rate',
  )
  assert.ok(events.every((event) => event.platform === 'h5'))
  assert.ok(events.every((event) => event.release === 'local-perf-test' && event.sampleRate === 1))
  assert.ok(!JSON.stringify(records).includes('must-not-be-logged'))
  assert.deepEqual(errors, [])
  mkdirSync('.tmp', { recursive: true })
  writeFileSync('.tmp/performance-browser.jsonl', records.map((record) => JSON.stringify(record)).join('\n') + '\n')
  console.log(
    `PASS: browser -> receiver, ${events.length} events; success/failure, page_ready, FCP and privacy checked`,
  )
} finally {
  await browser?.close()
  await new Promise((done) => {
    server.close(done)
    server.closeAllConnections()
  })
}
