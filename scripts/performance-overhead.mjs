/** Paired, alternating-order enabled/disabled runs. No external requests allowed. */
import assert from 'node:assert/strict'
import express from 'express'
import { once } from 'node:events'
import { chromium } from 'playwright'
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import { createPerformanceRouter } from '../server/routes/performance.mjs'
const app = express()
let enabled = true
let records = []
const delay = (ms) => new Promise((done) => setTimeout(done, ms))
app.use('/api/telemetry/performance', createPerformanceRouter({ write: (r) => records.push(r) }))
app.use(express.json())
app.get('/api/auth/me', (_req, res) => res.json({ ok: true, user: { userId: 1, role: 'user' }, profile: {} }))
app.get('/api/mall/products', async (_req, res) => {
  await delay(120)
  res.json({ items: [], categories: [] })
})
app.post('/api/scene/plans', async (_req, res) => {
  await delay(200)
  res.json({ plans: { pure: [] } })
})
app.use('/api', (_req, res) => res.json({ items: [] }))
const on = express.static(resolve('.tmp/perf-cycle-after/h5'))
const off = express.static(resolve('.tmp/perf-cycle-off/h5'))
app.use((req, res, next) => (enabled ? on : off)(req, res, next))
const server = app.listen(0, '127.0.0.1')
await once(server, 'listening')
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ headless: true })
const rows = []
const warmupRows = []
const pairs = Number(process.env.PERF_OVERHEAD_PAIRS || 10)
const warmupPairs = Number(process.env.PERF_OVERHEAD_WARMUP || 0)
try {
  for (let pair = -warmupPairs; pair < pairs; pair++) {
    for (const state of pair % 2 ? [false, true] : [true, false]) {
      enabled = state
      records = []
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
      const page = await context.newPage()
      await page.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()))
      await page.addInitScript(() => localStorage.setItem('ai-fashion-token', 'fixture-token'))
      await page.goto(origin + '/#/pages/home/home')
      await delay(650)
      const metrics = await page.evaluate(() => ({
        fcp: performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint')?.startTime,
        resourceBytes: performance.getEntriesByType('resource').reduce((sum, e) => sum + e.transferSize, 0),
        jsBytes: performance
          .getEntriesByType('resource')
          .filter((e) => e.name.endsWith('.js'))
          .reduce((sum, e) => sum + e.encodedBodySize, 0),
      }))
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await delay(150)
      const events = records.flatMap((r) => r.events)
      assert.equal(events.length > 0, enabled)
      assert.ok(Number.isFinite(metrics.fcp))
      ;(pair < 0 ? warmupRows : rows).push({
        pair,
        enabled,
        ...metrics,
        events: events.length,
        telemetryBytes: records.reduce((sum, r) => sum + Buffer.byteLength(JSON.stringify({ events: r.events })), 0),
      })
      await context.close()
    }
    console.log(`paired overhead ${pair + 1}/${pairs}`)
  }
  writeFileSync(
    `docs/perf-cycle-20261020/${process.env.PERF_OVERHEAD_OUTPUT || 'overhead.json'}`,
    JSON.stringify(
      {
        kind: 'real browser, alternating paired ordering, fresh contexts per setting (count recorded in metadata), includes natural runtime noise',
        browser: browser.version(),
        pairs,
        warmupPairs,
        warmupRows,
        rows,
      },
      null,
      2,
    ),
  )
} finally {
  await browser.close()
  await new Promise((done) => {
    server.close(done)
    server.closeAllConnections()
  })
}
