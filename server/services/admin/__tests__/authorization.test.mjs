import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
process.env.JWT_SECRET = 'local-admin-authorization-test-only'
const { authRequired, signToken } = await import('../../../middleware/auth.mjs')
const { requireAdmin } = await import('../../../middleware/admin.mjs')

test('管理接口拒绝匿名、普通用户和已撤权管理员，仅放行数据库中的管理员', async () => {
  let role = 'user'
  const app = express()
  app.get(
    '/admin',
    authRequired,
    requireAdmin(async () => ({ role })),
    (_req, res) => res.json({ ok: true }),
  )
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  const url = `http://127.0.0.1:${server.address().port}/admin`
  const token = signToken({ userId: 1, role: 'admin' })
  try {
    assert.equal((await fetch(url)).status, 401)
    assert.equal((await fetch(url, { headers: { Authorization: 'Bearer mock-jwt-admin' } })).status, 401)
    assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${token}` } })).status, 403)
    role = 'admin'
    assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${token}` } })).status, 200)
    role = 'user'
    assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${token}` } })).status, 403)
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
})
