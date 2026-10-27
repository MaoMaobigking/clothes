import express from 'express'
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
const app = express()
app.use(express.static(process.env.AUDIT_BUILD || '.tmp/perf-audit/h5'))
const server = await new Promise((r) => {
  const s = app.listen(0, '127.0.0.1', () => r(s))
})
const base = `http://127.0.0.1:${server.address().port}`
let browser
const results = []
try {
  for (const channel of ['msedge', 'chrome', undefined]) {
    try {
      browser = await chromium.launch(channel ? { channel } : {})
      break
    } catch {
      // ��ǰ�����������ʱ������һ����
    }
  }
  if (!browser) throw Error('No browser')
  for (const count of [20, 100]) {
    for (let run = 1; run <= 3; run++) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
      await ctx.addInitScript(() => {
        localStorage.setItem('ai-fashion-token', 'audit-token')
        localStorage.setItem('ai-fashion-session', JSON.stringify({ userId: 1, nickname: 'audit', role: 'user' }))
      })
      const calls = [],
        images = [],
        blocked = []
      await ctx.route('**/*', async (route) => {
        const url = new URL(route.request().url())
        if (url.origin !== base) {
          blocked.push(url.origin)
          return route.abort()
        }
        if (url.pathname === '/api/garments') {
          const call = { start: Date.now() }
          calls.push(call)
          await new Promise((r) => setTimeout(r, 250))
          await route.fulfill({
            json: {
              items: Array.from({ length: count }, (_, i) => ({
                id: String(i + 1),
                name: `衣服${i + 1}`,
                category: 'top',
                img: `/uploads/audit-${i}.svg`,
                season: 'spring',
                occasions: [],
                colors: [],
              })),
            },
          })
          call.end = Date.now()
          return
        }
        if (url.pathname.startsWith('/api/'))
          return route.fulfill({ json: { ok: true, items: [], user: { userId: 1, role: 'user' } } })
        if (url.pathname.startsWith('/uploads/')) {
          images.push(url.pathname)
          return route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="250"><rect width="200" height="250" fill="#ddd"/></svg>',
          })
        }
        return route.continue()
      })
      const page = await ctx.newPage()
      await page.goto(base + '/#/pages/closet/closet', { waitUntil: 'networkidle' })
      await page.waitForSelector('.grid .cell')
      const initial = await page.evaluate(() => ({
        cells: document.querySelectorAll('.grid .cell').length,
        dom: document.querySelectorAll('*').length,
      }))
      const imagesBeforeScroll = images.length
      const scroll = await page.evaluate(async () => {
        const el = [...document.querySelectorAll('.grid-scroll *')].find(
          (e) => e.scrollHeight > e.clientHeight && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY),
        )
        if (!el) return null
        for (let y = 0; y < el.scrollHeight; y += 400) {
          el.scrollTop = y
          await new Promise((r) => setTimeout(r, 80))
        }
        el.scrollTop = el.scrollHeight
        await new Promise((r) => setTimeout(r, 300))
        return { top: el.scrollTop, height: el.scrollHeight, viewport: el.clientHeight }
      })
      results.push({
        count,
        run,
        ...initial,
        imagesBeforeScroll,
        imagesAfterScroll: images.length,
        loadedImages: await page
          .locator('.grid .cell img')
          .evaluateAll((nodes) => nodes.filter((img) => img.complete && img.naturalWidth > 0).length),
        garmentRequests: calls.length,
        overlapping: calls.length > 1 && calls[1].start < calls[0].end,
        calls,
        scroll,
        blocked,
      })
      await ctx.close()
    }
  }
  await mkdir('docs/performance-audit-20261020', { recursive: true })
  await writeFile(
    `docs/performance-audit-20261020/${process.env.AUDIT_OUTPUT || 'closet-check'}.json`,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        environment: 'Local H5 Chromium, synthetic garments and 250ms API delay; no production requests',
        results,
      },
      null,
      2,
    ),
  )
  console.log(JSON.stringify(results, null, 2))
  if (
    results.some(
      (r) =>
        r.garmentRequests !== 1 ||
        r.imagesBeforeScroll >= r.count ||
        !r.scroll?.top ||
        r.imagesAfterScroll !== r.count ||
        r.loadedImages !== r.count,
    )
  )
    throw Error('Expected one request, deferred images and loading after scroll')
} finally {
  await browser?.close()
  server.close()
}
