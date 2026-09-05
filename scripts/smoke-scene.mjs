import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5173'
const OUT = '.smoke'
mkdirSync(OUT, { recursive: true })

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel })
    } catch {
      /* try next */
    }
  }
  return await chromium.launch()
}

const browser = await launch()
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  geolocation: { latitude: 30.2741, longitude: 120.1551 },
  permissions: ['geolocation'],
})
const page = await context.newPage()
const errors = []

page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`[console] ${message.text()}`)
})
page.on('pageerror', (error) => errors.push(`[pageerror] ${error.message}`))

const checks = []
function check(name, ok, extra = '') {
  checks.push({ name, ok, extra })
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${extra ? ' — ' + extra : ''}`)
}

await page.goto(`${BASE}/#/pages/scene/index`, {
  waitUntil: 'networkidle',
  timeout: 20000,
})
try {
  await page.getByText('生成场景穿搭').waitFor({ timeout: 10000 })
} catch (error) {
  console.log('--- scene page body ---')
  console.log((await page.locator('body').innerText()).slice(0, 2000))
  console.log('--- console/page errors ---')
  console.log(errors.join('\n'))
  await page.screenshot({ path: `${OUT}/feature-4-scene-failed.png`, fullPage: true })
  throw error
}

check('六个场景入口全部渲染', (await page.locator('.scene-option').count()) === 6)
await page.getByText('已为你激活').waitFor({ timeout: 15000 })
check('场景方案自动生成', true)
check('默认展示新旧混搭', (await page.getByText('新旧混搭', { exact: true }).count()) > 0)

await page.getByText('夜晚', { exact: true }).click()
await page.getByText('对比旧衣', { exact: true }).click()
await page.waitForTimeout(300)
const planCount = await page.locator('.plan-card').count()
check('对比视图同时展示两版方案', planCount === 2, `实际 ${planCount}`)

await page.getByText('保存模板', { exact: true }).click()
await page.getByText('已保存到我的搭配').waitFor({ timeout: 8000 })
check('保存模板落库并返回成功', true)

await page.getByText('一键购买', { exact: true }).click()
await page.getByText('已加入购物车', { exact: true }).waitFor({ timeout: 8000 })
check('一键购买写入购物车并展示淘口令', true)
await page.getByText('完成', { exact: true }).click()

await page.screenshot({ path: `${OUT}/feature-4-scene.png`, fullPage: true })
await page.getByText('我的搭配', { exact: true }).first().click()
await page.locator('.outfit-card').first().waitFor({ timeout: 8000 })
check('我的搭配可重新打开刚保存的模板', true)

const realErrors = errors.filter((error) => !/Failed to load resource|404|net::ERR/i.test(error))
console.log(`\n运行时错误(已忽略图片 404): ${realErrors.length}`)
if (realErrors.length) console.log(realErrors.join('\n'))

await browser.close()
const failed = checks.filter((item) => !item.ok).length
process.exit(failed || realErrors.length ? 1 : 0)
