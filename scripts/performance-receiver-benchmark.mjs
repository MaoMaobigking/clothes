import assert from 'node:assert/strict'
import express from 'express'
import { once } from 'node:events'
import { writeFileSync } from 'node:fs'
import { createPerformanceRouter } from '../server/routes/performance.mjs'
let accepted = 0
const app = express()
app.use(
  '/api/telemetry/performance',
  createPerformanceRouter({
    write: (record) => {
      accepted += record.events.length
    },
  }),
)
app.use((err, _req, res, _next) => res.status(err.status || 500).end())
const server = app.listen(0, '127.0.0.1')
await once(server, 'listening')
const url = `http://127.0.0.1:${server.address().port}/api/telemetry/performance`
const rows = []
try {
  for (let i = 0; i < 100; i++) {
    const events = Array.from({ length: 20 }, (_, j) => ({
      id: `batch-${i}-${j}`,
      name: 'api_request',
      value: 120,
      timestamp: Date.now(),
      page: 'pages/home/home',
      platform: 'h5',
      release: 'receiver-test',
      sessionId: 'session',
      sampleRate: 1,
      ok: true,
      endpoint: '/api/mall/products',
      method: 'GET',
    }))
    const body = JSON.stringify({ events })
    const start = performance.now()
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    await res.text()
    rows.push({
      batch: i,
      events: 20,
      bytes: Buffer.byteLength(body),
      status: res.status,
      roundTripMs: performance.now() - start,
    })
    assert.equal(res.status, 204)
  }
  assert.equal(accepted, 2000)
  const times = rows.map((r) => r.roundTripMs).sort((a, b) => a - b)
  const summary = {
    kind: 'real local HTTP, sequential, in-memory log sink; excludes production logging/storage/network',
    requests: 100,
    acceptedEvents: accepted,
    p50Ms: times[49],
    p95Ms: times[94],
    maxMs: times[99],
    bytes: rows.reduce((s, r) => s + r.bytes, 0),
  }
  writeFileSync('docs/perf-cycle-20261020/receiver.json', JSON.stringify({ summary, rows }, null, 2))
  console.log(JSON.stringify(summary))
} finally {
  await new Promise((done) => {
    server.close(done)
    server.closeAllConnections()
  })
}
