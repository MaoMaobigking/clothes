import assert from 'node:assert/strict'
const base = 'https://express-q6b8-299096-11-1470997981.sh.run.tcloudbase.com'
async function req(path, method = 'GET', body, token) {
  const r = await fetch(base + path, {
    method,
    signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await r.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = null
  }
  return { status: r.status, data, text }
}
let token, garment
try {
  let r = await req('/api/ready')
  assert.equal(r.status, 200)
  assert.equal(r.data.database, 'ready')
  console.log('READY', r.data)
  r = await req('/api/auth/dev-token', 'POST', { tag: 'release-disabled-check' })
  assert.equal(r.status, 404)
  console.log('PASS production dev-token disabled')
  r = await req('/api/auth/admin-login', 'POST', { password: process.env.ADMIN_PASSWORD })
  assert.equal(r.status, 200)
  token = r.data.token
  const owner = r.data.userId
  for (const path of ['overview', 'users', 'garments', 'orders', 'ai-stats']) {
    r = await req('/api/admin/' + path, 'GET', null, token)
    assert.equal(r.status, 200, path)
  }
  assert.equal((await req('/api/admin/overview')).status, 401)
  r = await req(
    '/api/admin/garments',
    'POST',
    { userId: owner, name: '发布验收临时衣物', category: 'top', price: 1 },
    token,
  )
  assert.equal(r.status, 201)
  garment = r.data.item.id
  r = await req(
    '/api/admin/garments/' + garment,
    'PATCH',
    { name: '发布验收保存成功', category: 'top', price: 2 },
    token,
  )
  assert.equal(r.status, 200)
  r = await req('/api/admin/garments?search=' + encodeURIComponent('发布验收保存成功'), 'GET', null, token)
  assert.equal(r.status, 200)
  assert.ok(r.data.items.some((i) => i.id === garment && i.name === '发布验收保存成功'))
  console.log('PASS live admin authorization, lists, create/update/read-back')
  r = await req('/api/auth/login', 'POST', { code: 'release-check-invalid-code' })
  console.log('WeChat invalid-code probe', r.status, r.data?.error, r.data?.message)
  assert.equal(r.status, 401)
} finally {
  if (garment && token) {
    const r = await req('/api/admin/garments/' + garment, 'DELETE', null, token)
    assert.equal(r.status, 200)
    console.log('Temporary release garment removed')
  }
}
