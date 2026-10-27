/*
 * 社区页瀑布流布局验证 + 虚拟滚动性能测量。
 *
 * ── 为什么要有这个脚本 ──
 * MasonryList 用 transform 把卡片定位在**算好的**坐标上，而坐标是按
 * 「列宽 / aspectRatio」推出来的。社区卡片不是纯图片，它 = 封面 + 作者行 +
 * 文案 + 话题 + 互动按钮，比封面高。如果 aspectRatio 只按封面算，
 * 每张卡片的实际高度会超过格子高度 → 压住下一张。
 *
 * 这种错**构建不会报、类型检查抓不到、单元测试也测不到**（测的是纯函数，
 * 而真实卡片高度取决于字体、行高、换行 —— 只有把页面渲染出来才量得到）。
 * 所以这里用 H5 构建 + Playwright 实测每张卡片的真实盒子，和格子高度对比。
 *
 * 用法：
 *   node scripts/measure-community-masonry.mjs
 * 前置：H5 构建产物在 5056 端口上（python -m http.server 5056）
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://127.0.0.1:5056'
const COUNT = Number(process.env.COUNT || 300)

/** 造 N 条 share 数据，字段对齐 CommunityContent（见 api/community/type.ts）。 */
function buildShares(n) {
  const covers = [
    '/static/images/lookbook/look-01-front.jpg',
    '/static/images/lookbook/look-02-front.jpg',
    '/static/images/community/p1.jpg',
    '/static/images/model/front.jpg',
  ]
  const ratios = ['3 / 4', '1 / 1', '4 / 5']
  return Array.from({ length: n }, (_, i) => ({
    id: `m-${i + 1}`,
    type: 'share',
    authorUserId: 1,
    authorName: ['小鱼要暴富', '通勤小圈', '莫兰迪'][i % 3],
    authorAvatar: ['🐟', '💼', '🫧'][i % 3],
    title: `第 ${i + 1} 条搭配记录，标题长度不一，有的会折成两行`,
    subtitle: '高腰线 + 顺色下装',
    coverUrl: covers[i % covers.length],
    category: '用户分享',
    topics: ['#小个子穿搭', '#显高'],
    body: { caption: '高腰线 + 顺色下装', description: '显高记录' },
    publishedMonth: '2026-09',
    status: 'published',
    createdAt: '2026-09-27T00:00:00.000Z',
    updatedAt: '2026-09-27T00:00:00.000Z',
    likeCount: i % 7,
    commentCount: i % 3,
    favoriteCount: i % 5,
    completedCount: 0,
    liked: false,
    favorited: false,
    bookmarked: false,
    reported: false,
    completed: false,
    participantCount: 0,
    note: '',
    _ratio: ratios[i % 3],
  }))
}

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel })
    } catch {
      /* 试下一个 */
    }
  }
  return await chromium.launch()
}

const browser = await launch()
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})

/*
 * 注入登录态。两个 key 都要写：
 *   ai-fashion-token   裸 token 字符串
 *   ai-fashion-session JSON 字符串
 * 只写 token 的话启动守卫能过，但昵称/角色是空的（见 stores/auth.ts）。
 * 写入用 addInitScript 而不是 page.evaluate —— 每次导航前都会执行，SPA 内跳转也覆盖。
 */
await ctx.addInitScript(() => {
  localStorage.setItem('ai-fashion-token', 'measure-token')
  localStorage.setItem(
    'ai-fashion-session',
    JSON.stringify({
      userId: 1,
      nickname: '测量账号',
      avatarUrl: '🐟',
      role: 'user',
      account: 'measure',
      demoKind: null,
    }),
  )
})

const shares = buildShares(COUNT)

/*
 * 把所有 /api/ 请求打桩。
 *
 * 匹配用「路径以 /api/ 开头」而不是 glob 双星斜杠写法 —— 后者会连
 * src/api/*.ts 这些应用源码模块一起拦掉（dev 下 Vite 按源码分发），
 * 等于把 JS 换成 JSON，整页白屏。这个坑 ui-shot.mjs:63-73 记过。
 *
 * 不用 abort：abort 掉的请求会让 waitUntil:'networkidle' 永远等不到，goto 超时。
 */
await ctx.route('**/*', async (route) => {
  const url = route.request().url()
  const path = url.split('?')[0]
  if (!path.includes('/api/')) return route.continue()
  if (path.endsWith('/api/community/contents')) {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: shares }),
    })
  }
  // 其余接口（/me 校验、互动等）一律给空成功，避免被踢回登录页
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, items: [], user: { userId: 1, role: 'user' } }),
  })
})

const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(`${BASE}/#/pages-sub/content/community/index?tab=share`, {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
})
await page.waitForTimeout(3000)

// 确认没被踢回登录页
const hash = await page.evaluate(() => location.hash)

const result = await page.evaluate(() => {
  const scroll = document.querySelector('.masonry-scroll')
  const canvas = document.querySelector('.masonry-canvas')
  const cells = [...document.querySelectorAll('.masonry-cell')]
  if (!scroll || !canvas) return { error: '找不到虚拟滚动容器' }

  // 格子（MasonryList 算出来的盒子） vs 卡片（真实渲染出来的盒子）
  const rows = cells.map((cell) => {
    const card = cell.querySelector('.share-card')
    const cr = cell.getBoundingClientRect()
    const kr = card ? card.getBoundingClientRect() : null
    return {
      cellH: Math.round(cr.height),
      cardH: kr ? Math.round(kr.height) : 0,
      overflow: kr ? Math.round(kr.height - cr.height) : 0,
    }
  })

  const overflows = rows.map((r) => r.overflow)
  return {
    renderedCells: cells.length,
    canvasHeight: Math.round(canvas.getBoundingClientRect().height),
    scrollHeight: scroll.scrollHeight,
    viewportH: Math.round(scroll.getBoundingClientRect().height),
    // 关键指标：卡片比格子高多少。正数 = 压住下一张（穿帮），负数 = 留缝（可接受）
    maxOverflow: Math.max(...overflows),
    minOverflow: Math.min(...overflows),
    avgOverflow: Math.round(overflows.reduce((a, b) => a + b, 0) / overflows.length),
    sampleCells: rows.slice(0, 6),
  }
})

console.log('=== 社区页瀑布流布局测量 ===')
console.log('数据量（喂进列表的条数）:', COUNT)
console.log('路由:', decodeURIComponent(hash))
console.log('页面错误:', errors.length ? errors.slice(0, 3) : '无')
console.log()
console.log(JSON.stringify(result, null, 2))

/*
 * 真正的滚动元素。
 *
 * ⚠️ 别拿 `.masonry-scroll` 当滚动容器 —— 那是 uni-app 编译出来的
 * <uni-scroll-view> 自定义元素，H5 下它自己不滚，滚的是它内部那层
 * <div class="uni-scroll-view" style="overflow: hidden auto">。
 * 量错了的表现很隐蔽：clientHeight 和 scrollHeight 都等于视口高、scrollTop 设了不生效，
 * 于是「能滚」被误判成「不能滚」，而 FPS 反而看着更高（不滚动当然不掉帧）。
 */
const SCROLLER_SELECTOR = '.masonry-scroll div[style*="overflow"]'

// 滚动性能：滚到底，量耗时与帧数
const scrollPerf = await page.evaluate(async (selector) => {
  const scroller = document.querySelector(selector) || document.querySelector('.masonry-scroll')
  if (!scroller) return { error: '无滚动容器' }
  const cellsAtStart = document.querySelectorAll('.masonry-cell').length
  let frames = 0
  let running = true
  const tick = () => {
    frames++
    if (running) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  const t0 = performance.now()
  const total = scroller.scrollHeight - scroller.clientHeight
  let peakCells = cellsAtStart
  for (let y = 0; y <= total; y += 400) {
    scroller.scrollTop = y
    peakCells = Math.max(peakCells, document.querySelectorAll('.masonry-cell').length)
    await new Promise((r) => setTimeout(r, 16))
  }
  const dt = performance.now() - t0
  running = false
  return {
    scrollerClientH: scroller.clientHeight,
    scrollerScrollH: scroller.scrollHeight,
    scrollRangePx: total,
    // 证明真的滚了：末尾的 scrollTop 应该接近 total
    finalScrollTop: scroller.scrollTop,
    elapsedMs: Math.round(dt),
    frames,
    avgFps: Math.round((frames / dt) * 1000),
    cellsAtStart,
    peakCellsDuringScroll: peakCells,
  }
}, SCROLLER_SELECTOR)
console.log()
console.log('=== 滚动性能 ===')
console.log(JSON.stringify(scrollPerf, null, 2))

await browser.close()
