import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5173'
const OUT = '.smoke'
mkdirSync(OUT, { recursive: true })

const routes = [
  ['home', '/home'],
  ['ai', '/ai'],
  ['closet', '/closet'],
  ['mall', '/mall'],
  ['me', '/me'],
  ['create', '/create'],
  ['test', '/test'],
  ['result', '/result'],
  ['free-match', '/free-match'],
  ['scene', '/scene'],
  ['magazine', '/magazine'],
  ['community', '/community'],
]

// 优先用系统已装的浏览器（Win11 自带 Edge），避免下载 Playwright 自带内核
async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel })
    } catch {
      /* try next */
    }
  }
  return await chromium.launch() // 回退到自带内核
}

const browser = await launch()
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
})

let totalErrors = 0
for (const [name, path] of routes) {
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console] ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/${name}.png` })
  } catch (e) {
    errors.push(`[nav] ${e.message}`)
  }
  // 过滤掉图片 404（现在还没放真实图，属预期）
  const real = errors.filter((e) => !/Failed to load resource|404|net::ERR/i.test(e))
  totalErrors += real.length
  const flag = real.length ? '❌' : '✅'
  console.log(`${flag} ${path}  ${real.length ? real.join(' | ') : 'ok'}`)
  await page.close()
}

await browser.close()
console.log(`\n=== 运行时错误(已忽略图片404): ${totalErrors} ===`)
process.exit(totalErrors ? 1 : 0)
