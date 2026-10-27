/** Reproducible browser experiment. All APIs and images are local fixtures. */
import assert from 'node:assert/strict'
import express from 'express'
import { once } from 'node:events'
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPerformanceRouter } from '../server/routes/performance.mjs'

const phase = process.argv[2] || 'before'
const build = resolve(process.argv[3] || '.tmp/perf-cycle-before/h5')
const directory = resolve('docs/perf-cycle-20261020')
mkdirSync(directory, { recursive: true })
const all = []
const failures = []
const records = []
let active = null
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160"><rect width="120" height="160" fill="#edb7c7"/></svg>'
const garment = {
  id: '123',
  name: '测试上装',
  category: 'top',
  img: '/uploads/garment.svg',
  emoji: '👕',
  season: 'spring',
  occasions: [],
  colors: [],
  fav: false,
}
const app = express()
app.use((req, res, next) => {
  const started = performance.now()
  const path = req.originalUrl.split('?')[0]
  const run = active
  res.on('finish', () =>
    run?.http.push({ path, method: req.method, status: res.statusCode, durationMs: performance.now() - started }),
  )
  next()
})
app.use(
  '/api/telemetry/performance',
  (req, res, next) => (active?.mode === 'receiver-down' ? res.status(503).end() : next()),
  createPerformanceRouter({
    write: (record) => {
      records.push(record)
      active?.records.push(record)
    },
  }),
)
app.use(express.json())
app.get('/api/auth/me', (_req, res) => res.json({ ok: true, user: { userId: 1, role: 'user' }, profile: {} }))
app.get('/api/garments', async (_req, res) => {
  await sleep(100)
  res.json({ items: [garment] })
})
app.get('/api/mall/products', async (_req, res) => {
  await sleep(120)
  if (active?.mode === 'api-failure') return res.status(503).json({ error: 'FIXTURE_FAILURE' })
  res.json({ categories: [], items: [{ id: '1', name: '测试商品', price: 10, imageUrl: '/uploads/garment.svg' }] })
})
app.post('/api/scene/plans', async (_req, res) => {
  await sleep(200)
  res.json({ plans: { pure: [] } })
})
app.get('/api/health', async (_req, res) => {
  await sleep(50)
  res.json({ bailian: { enabled: true } })
})
app.post('/api/tryon', async (_req, res) => {
  active.submissions++
  await sleep(150)
  if (active.mode === 'submit-failure') return res.status(503).json({ error: 'FIXTURE_FAILURE' })
  res.json({ task: { taskId: '12345678-1234-1234-1234-123456789abc', status: 'PENDING' } })
})
app.get('/api/tryon/:id', async (_req, res) => {
  active.polls++
  await sleep(100)
  const status = active.mode === 'generation-failure' ? 'FAILED' : active.polls === 1 ? 'RUNNING' : 'SUCCEEDED'
  res.json({
    task: {
      taskId: '12345678-1234-1234-1234-123456789abc',
      status,
      imageUrl: '/uploads/result.svg',
      errorMessage: status === 'FAILED' ? '测试生成失败' : undefined,
    },
  })
})
app.post('/api/wardrobe/upload', async (_req, res) => {
  await sleep(120)
  res.json({ items: [garment] })
})
app.get('/uploads/:file', async (req, res) => {
  if (req.params.file === 'result.svg') {
    if (active?.mode === 'image-timeout') return // Intentional hanging fixture; context closure aborts it.
    await sleep(300)
    if (active?.mode === 'image-failure') return res.status(404).end()
  }
  res.type('svg').send(svg)
})
app.use('/api', (_req, res) => res.json({ items: [], profile: {}, favorites: [] }))
app.use(express.static(build))
const server = app.listen(0, '127.0.0.1')
await once(server, 'listening')
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ headless: true })
const scenarios = [
  ...Array.from({ length: 10 }, (_, i) => ({ name: `home-${i + 1}`, mode: 'home', route: 'pages/home/home' })),
  ...Array.from({ length: 5 }, (_, i) => ({
    name: `tryon-${i + 1}`,
    mode: 'tryon',
    route: 'pages-sub/wardrobe/free-match/index',
  })),
  ...[
    'api-failure',
    'receiver-down',
    'submit-failure',
    'generation-failure',
    'image-failure',
    'abandoned',
    'upload',
  ].map((mode) => ({
    name: mode,
    mode,
    route: ['api-failure', 'receiver-down'].includes(mode)
      ? 'pages/home/home'
      : mode === 'upload'
        ? 'pages-sub/wardrobe/wardrobe-upload/index'
        : 'pages-sub/wardrobe/free-match/index',
  })),
]
if (process.env.PERF_EXTRA_SCENARIO === 'image-timeout') {
  scenarios.splice(0, scenarios.length, {
    name: 'image-timeout',
    mode: 'image-timeout',
    route: 'pages-sub/wardrobe/free-match/index',
  })
}
try {
  for (const scenario of scenarios) {
    const run = { ...scenario, records: [], http: [], submissions: 0, polls: 0, errors: [], checks: [] }
    active = run
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    page.on('pageerror', (error) => run.errors.push(error.message))
    await page.route('**/*', (route) => {
      const url = route.request().url()
      return url.startsWith(origin) || /^(data:|blob:)/.test(url) ? route.continue() : route.abort()
    })
    await page.addInitScript(() => localStorage.setItem('ai-fashion-token', 'local-fixture-token'))
    try {
      if (scenario.mode === 'image-timeout') await page.clock.install()
      await page.goto(`${origin}/#/${scenario.route}`)
      if (scenario.route.includes('free-match')) {
        await page.locator('[aria-label="换上测试上装"]').click()
        await sleep(200)
        await page.locator('[aria-label="AI 试衣"]').evaluate((el) => {
          el.click()
          el.click()
        })
        if (scenario.mode === 'abandoned') {
          await sleep(250)
          await page.evaluate(() => {
            location.hash = '#/pages/home/home'
          })
          await sleep(3200)
        } else if (scenario.mode === 'submit-failure' || scenario.mode === 'generation-failure') {
          await sleep(800)
        } else {
          await page.locator('.tryon-badge').waitFor({ timeout: 10000 })
          if (scenario.mode === 'image-timeout') await page.clock.fastForward(31000)
          else await sleep(800)
        }
      } else if (scenario.mode === 'upload') {
        const fileChooser = page.waitForEvent('filechooser')
        await page.getByText('从相册选择', { exact: true }).click()
        await (
          await fileChooser
        ).setFiles({
          name: 'test.png',
          mimeType: 'image/png',
          buffer: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
            'base64',
          ),
        })
        await page.getByText('识别 1 张旧衣', { exact: true }).click()
        await page.getByText('AI 识别建议', { exact: true }).waitFor()
      } else {
        await sleep(650)
      }
      const resource = await page.evaluate(() =>
        performance.getEntriesByType('resource').map((e) => ({ name: e.name, duration: e.duration })),
      )
      run.resources = resource
        .filter((e) => e.name.includes('/api/'))
        .map((e) => ({ path: new URL(e.name).pathname, durationMs: e.duration }))
      // Exercise real hide/flush hook without waiting 10s in every scenario.
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await sleep(300)
      const events = run.records.flatMap((r) => r.events)
      if (scenario.mode === 'receiver-down') {
        assert.equal(events.length, 0)
        assert.ok(run.http.some((r) => r.path === '/api/telemetry/performance' && r.status === 503))
        assert.ok((await page.locator('body').innerText()).includes('测试商品'))
      } else {
        assert.ok(events.some((e) => e.name === 'page_ready'))
        assert.ok(events.every((e) => e.platform === 'h5' && e.sampleRate === 1))
        assert.equal(new Set(events.map((e) => e.id)).size, events.length)
        assert.ok(!JSON.stringify(events).includes('local-fixture-token'))
        assert.ok(!JSON.stringify(events).includes('/uploads/'))
        if (scenario.mode === 'home') {
          for (const name of ['home_data_ready', 'recommendations_ready', 'fcp'])
            assert.ok(
              events.some((e) => e.name === name && e.ok),
              name,
            )
          run.timingErrorsMs = ['/api/mall/products', '/api/scene/plans'].map((path) => {
            const e = events.find((e) => e.name === 'api_request' && e.endpoint === path)
            const independent = run.resources.find((r) => r.path === path)
            assert.ok(e && independent)
            return Math.abs(e.value - independent.durationMs)
          })
          assert.ok(run.timingErrorsMs.every((e) => e <= 150))
        }
        if (scenario.mode === 'tryon') {
          for (const name of [
            'tryon_submit',
            'tryon_wait',
            'tryon_generate',
            'tryon_image_load',
            'tryon_result_loaded',
          ])
            assert.ok(
              events.some((e) => e.name === name && e.ok),
              name,
            )
          const get = (name) => events.find((e) => e.name === name).value
          assert.ok(get('tryon_submit') >= 150)
          assert.ok(get('tryon_wait') >= 2700)
          assert.ok(get('tryon_image_load') >= 300)
          assert.ok(
            Math.abs(get('tryon_result_loaded') - get('tryon_submit') - get('tryon_wait') - get('tryon_image_load')) <
              150,
          )
          assert.equal(new Set(events.filter((e) => e.name.startsWith('tryon')).map((e) => e.traceId)).size, 1)
        }
        if (scenario.mode === 'image-timeout') {
          for (const name of ['tryon_image_load', 'tryon_result_loaded']) {
            assert.ok(events.some((e) => e.name === name && e.outcome === 'timeout' && !e.ok))
          }
        }
        if (scenario.mode === 'api-failure')
          assert.ok(events.some((e) => e.name === 'api_request' && e.status === 503 && !e.ok))
        if (['submit-failure', 'generation-failure'].includes(scenario.mode))
          assert.ok(events.some((e) => e.name === 'tryon_generate' && !e.ok))
        if (scenario.mode === 'image-failure') assert.ok(events.some((e) => e.name === 'tryon_image_load' && !e.ok))
        if (scenario.mode === 'abandoned')
          assert.ok(events.some((e) => e.name === 'tryon_result_loaded' && e.outcome === 'abandoned'))
        if (scenario.mode === 'upload')
          assert.ok(events.some((e) => e.name === 'file_upload' && e.ok && e.value >= 120))
      }
      if (scenario.route.includes('free-match')) assert.equal(run.submissions, 1, 'duplicate clicks submitted twice')
      assert.deepEqual(run.errors, [])
      run.passed = true
    } catch (error) {
      run.passed = false
      run.failure = error.message
      failures.push({ name: run.name, error: error.message })
      await page.screenshot({ path: resolve(directory, `${phase}-${run.name}-failure.png`) }).catch(() => {})
    } finally {
      all.push(run)
      await context.close()
      console.log(`${phase} ${run.name}: ${run.passed ? 'PASS' : 'FAIL ' + run.failure}`)
      writeFileSync(
        resolve(directory, `browser-${phase}.json`),
        JSON.stringify(
          {
            phase,
            kind: 'real Chromium + fixed local API fixtures',
            browser: browser.version(),
            viewport: { width: 390, height: 844 },
            all,
            failures,
          },
          null,
          2,
        ),
      )
      writeFileSync(
        resolve(directory, `events-${phase}.jsonl`),
        records.map((r) => JSON.stringify(r)).join('\n') + '\n',
      )
    }
  }
} finally {
  await browser.close()
  await new Promise((done) => {
    server.close(done)
    server.closeAllConnections()
  })
}
assert.equal(failures.length, 0, JSON.stringify(failures))
