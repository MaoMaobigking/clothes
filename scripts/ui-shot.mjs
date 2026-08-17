/*
 * UI 截图脚本（H5）。
 *
 * 和 smoke.mjs 的区别：smoke.mjs 用的是旧 web 端的路由（/home），
 * 迁到 uni-app 之后 H5 是 hash 模式的 #/pages/xxx/xxx，这里按新路由来。
 *
 * 会先塞一个假 token，否则 App.vue 的启动守卫会把每个页面都重定向到登录页。
 * 后端没起时 fetchMe() 是网络错误（不是 401），不会触发请求层的踢登录逻辑，
 * 所以能截到真实布局。
 *
 * 用法：node scripts/ui-shot.mjs [页面名...]
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5173'
const OUT = '.uishot'
mkdirSync(OUT, { recursive: true })

const ALL = {
  home: 'pages/home/home',
  closet: 'pages/closet/closet',
  mall: 'pages/mall/mall',
  me: 'pages/me/me',
  ai: 'pages/ai/ai',
  create: 'pages/create/index',
  'free-match': 'pages/free-match/index',
  scene: 'pages/scene/index',
  accessory: 'pages/accessory/index',
  community: 'pages/community/index',
  test: 'pages/test/index',
}

const picked = process.argv.slice(2)
const routes = picked.length
  ? picked.filter((n) => ALL[n]).map((n) => [n, ALL[n]])
  : Object.entries(ALL)

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel })
    } catch {
      /* 换下一个 */
    }
  }
  return chromium.launch()
}

const browser = await launch()
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})

// uni-app H5 的 setStorageSync 存字符串时是原样写 localStorage
await ctx.addInitScript(() => {
  localStorage.setItem('ai-fashion-token', 'ui-shot-fake-token')
})

const page = await ctx.newPage()

/*
 * 把后端请求就地伪造成 503，让截图结果和后端状态解耦。
 *
 * 匹配用的是「路径以 /api/ 开头」而不是 glob `**\/api/**`：后者会连
 * /src/api/http.ts 这些**应用自己的源码模块**一起拦掉（dev 下 Vite 就是按源码
 * 路径提供的），等于把 app 的 JS 换成 JSON，整页白屏。
 *
 * 为什么不是 abort：abort 掉的请求会让 waitUntil:'networkidle' 永远等不到，
 * goto 超时抛错，截到的是一张根本没导航的空白页。
 * 为什么不是放行：后端起着时接口返 401，请求层会把每个页面都踢回登录页。
 */
await page.route(
  (url) => url.pathname.startsWith('/api/'),
  (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'ui-shot: backend stubbed' }),
    }),
)

const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))

for (const [name, path] of routes) {
  errors.length = 0
  await page.goto(`${BASE}/#/${path}`, { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  const url = page.url()
  const redirected = !url.includes(path)
  console.log(
    `${redirected ? '✗' : '✓'} ${name.padEnd(12)} ${redirected ? `→ 被重定向到 ${url.split('#')[1]}` : ''}` +
      (errors.length ? `  [${errors.length} 个控制台错误] ${errors[0].slice(0, 120)}` : ''),
  )
}

await browser.close()
console.log(`\n截图在 ${OUT}/`)
