/** Real MySQL + HTTP acceptance; creates and removes its own isolated database. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import mysql from 'mysql2/promise'
import express from 'express'
const database = `lingxi_acceptance_${Date.now()}`
assert.match(database, /^lingxi_acceptance_\d+$/, 'Unsafe cleanup target')
const connection = await mysql.createConnection({
  host: '127.0.0.1',
  port: 3308,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD,
  multipleStatements: true,
})
Object.assign(process.env, {
  MYSQL_HOST: '127.0.0.1',
  MYSQL_PORT: '3308',
  MYSQL_DATABASE: database,
  JWT_SECRET: randomUUID() + randomUUID(),
})
let pool, server
try {
  const sql = readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8').replace(/\blingxi\b/g, database)
  await connection.query(sql)
  const db = await import('../server/db/mysql.mjs')
  pool = db.pool
  const { signToken } = await import('../server/middleware/auth.mjs')
  const { default: admin } = await import('../server/routes/admin.mjs')
  const { createAiTaskRouter } = await import('../server/routes/aiTasks.mjs')
  const { saveResultImage } = await import('../server/repositories/resultImageRepo.mjs')
  await db.execute(
    "INSERT INTO users (id,openid,nickname,role) VALUES (1,'accept-admin','验收管理员','admin'),(2,'accept-a','验收用户A','user'),(3,'accept-b','验收用户B','user')",
  )
  const app = express()
  app.use(express.json())
  app.use('/api/admin', admin)
  app.use('/api/tryon', createAiTaskRouter('tryon'))
  app.use((err, req, res, _next) => res.status(err.status || 500).json({ message: err.message }))
  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  const base = `http://127.0.0.1:${server.address().port}`
  const tokens = {
    admin: signToken({ userId: 1, role: 'admin' }),
    a: signToken({ userId: 2 }),
    b: signToken({ userId: 3 }),
  }
  const request = async (path, who, method = 'GET', body) =>
    fetch(base + path, {
      method,
      headers: { ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}), 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  assert.equal((await request('/api/admin/overview')).status, 401)
  assert.equal((await request('/api/admin/overview', 'a')).status, 403)
  let response = await request('/api/admin/garments', 'admin', 'POST', {
    userId: 2,
    name: '验收衣物',
    category: 'top',
    price: 100,
  })
  assert.equal(response.status, 201, await response.clone().text())
  const { item } = await response.json()
  assert.equal(
    (
      await request(`/api/admin/garments/${item.id}`, 'admin', 'PATCH', {
        name: '修改已保存',
        category: 'top',
        price: 250,
      })
    ).status,
    200,
  )
  assert.equal((await db.getOne('SELECT name FROM garments WHERE id=?', [item.id])).name, '修改已保存')
  for (const path of ['overview', 'users', 'garments', 'orders', 'ai-stats'])
    assert.equal((await request('/api/admin/' + path, 'admin')).status, 200, path)
  console.log('PASS admin HTTP create/update/list backed by real MySQL')
  const id = randomUUID() + '.png',
    taskId = randomUUID(),
    content = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    )
  await saveResultImage({ id, userId: 2, taskId, mime: 'image/png', content })
  assert.equal(
    (await saveResultImage({ id: randomUUID() + '.png', userId: 2, taskId, mime: 'image/png', content })).id,
    id,
  )
  response = await request('/api/tryon/images/' + id, 'a')
  assert.equal(response.status, 200)
  assert.equal((await response.json()).dataUrl, 'data:image/png;base64,' + content.toString('base64'))
  assert.equal((await request('/api/tryon/images/' + id, 'b')).status, 404)
  assert.equal((await request('/api/tryon/images/' + id)).status, 401)
  console.log('PASS image bytes persisted, duplicate task idempotent, owner-only HTTP access')
  const child = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import {findResultImage} from './server/repositories/resultImageRepo.mjs';import {pool,getOne} from './server/db/mysql.mjs';import assert from 'node:assert/strict';try{const r=await findResultImage(2,process.env.ACCEPT_IMAGE);assert.equal(r.content.toString('base64'),process.env.ACCEPT_BYTES);const g=await getOne('SELECT name FROM garments WHERE id=?',[process.env.ACCEPT_GARMENT]);assert.equal(g.name,'修改已保存');console.log('PASS fresh backend process reads saved garment and image')}finally{await pool.end()}`,
    ],
    {
      env: {
        ...process.env,
        ACCEPT_IMAGE: id,
        ACCEPT_BYTES: content.toString('base64'),
        ACCEPT_GARMENT: String(item.id),
      },
      encoding: 'utf8',
    },
  )
  assert.equal(child.status, 0, child.stderr)
  console.log(child.stdout.trim())
  await db.execute("UPDATE users SET role='user' WHERE id=1")
  assert.equal((await request('/api/admin/overview', 'admin')).status, 403)
  await db.execute("UPDATE users SET role='admin' WHERE id=1")
  assert.equal((await request(`/api/admin/garments/${item.id}`, 'admin', 'DELETE')).status, 200)
  assert.equal(await db.getOne('SELECT id FROM garments WHERE id=?', [item.id]), null)
  console.log('PASS role revocation and garment deletion')
} finally {
  if (server) await new Promise((resolve) => server.close(resolve))
  if (pool) await pool.end()
  await connection.query(`DROP DATABASE IF EXISTS \`${database}\``)
  await connection.end()
  console.log('Isolated acceptance database cleaned up')
}
