import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { once } from 'node:events'
import { createPerformanceRouter } from '../../../routes/performance.mjs'

function event(overrides = {}) {
  return {
    id: 'session-1',
    sessionId: 'session',
    name: 'api_request',
    value: 35,
    timestamp: Date.now(),
    page: 'pages/home/home',
    platform: 'h5',
    release: 'test',
    sampleRate: 1,
    ok: true,
    endpoint: '/api/orders/:id',
    ...overrides,
  }
}
async function fixture(t, write) {
  const app = express()
  app.use('/api/telemetry/performance', createPerformanceRouter({ write }))
  app.use(express.json({ limit: '12mb' }))
  app.use((err, _req, res, _next) => res.status(err.status || 500).end())
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve)
        server.closeAllConnections()
      }),
  )
  return (data) =>
    fetch(`http://127.0.0.1:${server.address().port}/api/telemetry/performance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
}
test('accepts anonymous batches, strips unknown fields, rejects invalid batches atomically', async (t) => {
  const records = []
  const post = await fixture(t, (record) => records.push(record))
  assert.equal((await post({ events: [event({ password: 'do-not-store' })] })).status, 204)
  assert.equal(records.length, 1)
  assert.equal(JSON.stringify(records).includes('do-not-store'), false)
  assert.equal((await post({ events: [event(), event({ value: -1 })] })).status, 400)
  assert.equal((await post({ events: [event({ endpoint: '/api/auth?token=secret' })] })).status, 400)
  assert.equal((await post({ events: [event({ ok: true, outcome: 'abandoned' })] })).status, 400)
  assert.equal((await post({ events: Array.from({ length: 21 }, () => event()) })).status, 400)
  assert.equal(records.length, 1)
})
test('small body limit precedes general JSON parser; failure does not return success', async (t) => {
  const post = await fixture(t, () => {
    throw new Error('logging unavailable')
  })
  assert.equal((await post({ events: [event()] })).status, 503)
  assert.equal((await post({ padding: 'x'.repeat(40000) })).status, 413)
})
test('bounds anonymous request rate', async (t) => {
  const post = await fixture(t, () => {})
  for (let i = 0; i < 120; i++) assert.equal((await post({ events: [event()] })).status, 204)
  assert.equal((await post({ events: [event()] })).status, 429)
})
