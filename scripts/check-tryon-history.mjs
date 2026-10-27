import express from 'express'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
const root = fileURLToPath(new URL('../', import.meta.url))
const app = express()
app.use(express.static(join(root, 'miniapp/dist/build/h5')))
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s))
})
const base = 'http://127.0.0.1:' + server.address().port
let browser
try {
  try {
    browser = await chromium.launch()
  } catch {
    browser = await chromium.launch({ channel: 'msedge' })
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await context.addInitScript(() => localStorage.setItem('ai-fashion-token', 'history-fixture-token'))
  const imageUrl = '/api/tryon/images/11111111-1111-4111-8111-111111111111.png'
  const png = process.env.CHECK_TRYON_IMAGE
    ? 'data:image/png;base64,' + readFileSync(process.env.CHECK_TRYON_IMAGE).toString('base64')
    : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jV9sAAAAASUVORK5CYII='
  const completed = { taskId: 'history-success', status: 'SUCCEEDED', imageUrl, createdAt: '2026-10-27T12:00:00Z' }
  let listFails = true,
    empty = false,
    imageReads = 0,
    taskReads = 0
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (!url.pathname.startsWith('/api/')) return url.origin === base ? route.continue() : route.abort()
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (url.pathname === '/api/health') return json({ bailian: { enabled: true } })
    if (url.pathname === '/api/auth/me') return json({ user: { userId: 1 }, profile: {} })
    if (url.pathname === '/api/tryon') {
      if (listFails) return json({ message: '记录暂时不可用' }, 503)
      return json({
        tasks: empty ? [] : [completed, { taskId: 'pending', status: 'RUNNING', createdAt: completed.createdAt }],
      })
    }
    if (url.pathname === '/api/tryon/history-success') {
      taskReads++
      return json({ task: completed })
    }
    if (url.pathname === '/api/tryon/pending') return json({ task: { taskId: 'pending', status: 'RUNNING' } })
    if (url.pathname === imageUrl) {
      assert.equal(route.request().headers().authorization, 'Bearer history-fixture-token')
      imageReads++
      return json({ dataUrl: png })
    }
    return json({ items: [], garments: [], tasks: [], profile: null, accounts: [] })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(6000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const target = base + '/#/pages-sub/wardrobe/free-match/index'
  await page.goto(target)
  await page.locator('.history-toggle').click()
  await page.getByText('记录暂时不可用', { exact: true }).waitFor()
  listFails = false
  await page.getByText('重试', { exact: true }).click()
  await page.getByText('查看图片', { exact: true }).click()
  await page.locator('.history-preview').waitFor()
  assert.equal(imageReads, 1)
  assert.equal(taskReads, 1)
  if (process.env.CHECK_TRYON_SCREENSHOT) {
    await page.locator('.history-preview img').evaluate(async (img) => {
      await img.decode()
    })
    await page.screenshot({ path: process.env.CHECK_TRYON_SCREENSHOT, fullPage: true })
  }
  await page.reload()
  await page.locator('.history-toggle').click()
  await page.getByText('查看图片', { exact: true }).click()
  await page.locator('.history-preview').waitFor()
  assert.equal(imageReads, 2, '重新进入页面后从私有接口读回图片')
  await page.getByText('查看进度', { exact: true }).click()
  await page.getByText('还在生成，稍后点击查看进度', { exact: true }).waitFor()
  assert.equal(imageReads, 2, '进行中的任务不能请求结果图片')
  empty = true
  await page.getByText('刷新', { exact: true }).click()
  await page.getByText('还没有试衣记录', { exact: true }).waitFor()
  assert.equal(await page.locator('.history-preview').count(), 0)
  assert.deepEqual(errors, [])
  console.log('PASS: 试衣记录错误重试、鉴权图片、退出重进、进行中状态、空记录')
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}
