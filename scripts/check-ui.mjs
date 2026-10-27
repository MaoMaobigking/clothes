/**
 * 浏览器契约验收：运行真实构建产物，API 使用隔离夹具。
 * 不调用线上账号、不产生模型费用；数据库集成验收另跑 server/scripts。
 */
import express from 'express'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
const root = fileURLToPath(new URL('../', import.meta.url))
const app = express()
app.use('/admin', express.static(join(root, 'admin/dist')))
app.get('/admin/*', (_req, res) => res.sendFile(join(root, 'admin/dist/index.html')))
app.use(express.static(join(root, 'miniapp/dist/build/h5')))
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s))
})
const base = `http://127.0.0.1:${server.address().port}`
let browser
try {
  try {
    browser = await chromium.launch()
  } catch {
    browser = await chromium.launch({ channel: 'msedge' })
  }
  const context = await browser.newContext()
  await context.addInitScript(() => localStorage.setItem('ai-fashion-token', 'ui-fixture-token'))
  let failFeed = false
  let chatRequests = []
  let adminAuthenticated = false
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (!url.pathname.startsWith('/api/')) {
      return url.origin === base ? route.continue() : route.abort()
    }
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (url.pathname === '/api/auth/me') return json({ ok: true, user: { userId: 1, role: 'user' }, profile: {} })
    if (url.pathname === '/api/scene/plans') {
      if (failFeed) return json({ message: 'fixture failure' }, 503)
      return json({
        plans: {
          pure: [
            {
              id: 'fixture-plan',
              title: '来自本人衣橱的验收搭配',
              items: [{ id: 'test-top', name: '测试上衣', imageUrl: '', emoji: '👕', from: '#eee', to: '#ddd' }],
            },
          ],
          mixed: [],
        },
      })
    }
    if (url.pathname === '/api/chat/stream') {
      const body = route.request().postDataJSON()
      chatRequests.push(body)
      const events =
        chatRequests.length === 1
          ? [
              { sequence: 1, sessionId: 7 },
              { sequence: 2, delta: '断线前' },
            ]
          : [
              { sequence: 2, delta: '断线前' },
              { sequence: 3, delta: '续接成功' },
              { sequence: 4, done: true, fullText: '断线前续接成功', sessionId: 7 },
            ]
      return route.fulfill({
        contentType: 'text/event-stream',
        body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
      })
    }
    if (url.pathname === '/api/auth/admin-login') {
      const valid = route.request().postDataJSON().password === 'ui-only-test-password'
      adminAuthenticated = valid
      return valid ? json({ token: 'ui-admin-token' }) : json({ message: '管理员密码不正确' }, 401)
    }
    if (url.pathname.startsWith('/api/admin/')) {
      if (!adminAuthenticated || route.request().headers().authorization !== 'Bearer ui-admin-token') {
        return json({ message: '需要管理员权限' }, 403)
      }
      if (url.pathname.endsWith('/overview'))
        return json({ users: 17, garments: 31, orders: 4, aiCalls: 9, failures: 1, latency: 120, daily: [] })
      return json({ items: [{ id: 1, nickname: '接口返回的测试用户', role: 'user' }], total: 1 })
    }
    return json({ items: [], tasks: [], profile: null, accounts: [] })
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${base}/#/pages/home/home`)
  await page.getByText('来自本人衣橱的验收搭配', { exact: true }).waitFor()
  await page.getByText('点击获取天气', { exact: true }).waitFor()
  assert.equal(await page.locator('.w-temp').count(), 0, '没有实况时不能展示假温度')
  failFeed = true
  await page.reload()
  await page.getByText('搭配加载失败，点击重试', { exact: true }).waitFor()
  assert.equal(await page.getByText('来自本人衣橱的验收搭配', { exact: true }).count(), 0)
  failFeed = false
  await page.getByText('搭配加载失败，点击重试', { exact: true }).click()
  await page.getByText('来自本人衣橱的验收搭配', { exact: true }).waitFor()
  await page.goto(`${base}/#/pages-sub/profile/stylist/index`)
  await page.locator('.composer input').fill('浏览器续接验收')
  await page.getByText('发送', { exact: true }).click()
  await page.getByText('断线前续接成功', { exact: true }).waitFor()
  assert.equal(chatRequests.length, 2)
  assert.equal(chatRequests[0].requestId, chatRequests[1].requestId)
  assert.equal(chatRequests[1].resumeFrom, 2)
  assert.equal(chatRequests[1].resume, true)
  await page.goto(`${base}/admin/login`)
  await page.getByPlaceholder('管理员密码').fill('admin123')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.getByText('管理员密码不正确', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => localStorage.getItem('admin_token')), null)
  await page.getByPlaceholder('管理员密码').fill('ui-only-test-password')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.getByText('运营概览', { exact: true }).waitFor()
  await page.getByText('用户数据', { exact: true }).click()
  await page.getByText('接口返回的测试用户', { exact: true }).waitFor()
  assert.deepEqual(errors, [], '页面不能出现未捕获异常')
  console.log('PASS: 首页真实响应/错误重试/无假天气、对话断线续接、后台鉴权与列表浏览器验收')
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}
