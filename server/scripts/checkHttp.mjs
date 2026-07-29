/**
 * HTTP 层验收：真用户 + 真隔离 + 鉴权
 *
 * 用法：先 npm run dev 起服务，另开一个终端 npm run check:http
 *
 * 和 checkIsolation.mjs 的分工：
 *   checkIsolation 直调 service，验「数据库层面对不对」；
 *   本脚本走真 HTTP，验「状态码 / 中间件 / 请求体防御对不对」。
 *   两层都要 —— service 正确但路由漏传 userId 的 bug，只有这一层能抓到。
 */
const BASE = process.env.CHECK_BASE || 'http://localhost:8787/api'

let failed = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? '  ✅' : '  ❌'} ${label}${extra ? ' — ' + extra : ''}`)
  if (!ok) failed++
}

async function req(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  let data = null
  try { data = await res.json() } catch { /* 空响应体 */ }
  return { status: res.status, data }
}

try {
  await fetch(BASE + '/health')
} catch {
  console.error(`\n❌ 连不上 ${BASE}，先 npm run dev 起服务\n`)
  process.exit(1)
}

const stamp = Date.now().toString(36)
const { data: A } = await req('/auth/dev-token', { method: 'POST', body: { tag: `http_a_${stamp}` } })
const { data: B } = await req('/auth/dev-token', { method: 'POST', body: { tag: `http_b_${stamp}` } })

console.log('\n【1】真用户 + 鉴权')
check('两个 tag → 两个不同 userId', A.userId !== B.userId, `A=${A.userId} B=${B.userId}`)
check('无 token 访问衣橱 → 401', (await req('/garments')).status === 401)
check('伪造 token → 401', (await req('/garments', { token: 'forged.token.here' })).status === 401)

console.log('\n【2】真隔离')
const { data: la } = await req('/garments', { token: A.token })
const { data: lb } = await req('/garments', { token: B.token })
check('A/B 各自拿到衣橱', la.items.length > 0 && lb.items.length > 0,
  `A=${la.items.length} B=${lb.items.length}`)
const idsA = new Set(la.items.map((g) => g.id))
check('两人衣物 id 零重叠', lb.items.filter((g) => idsA.has(g.id)).length === 0)

const victim = lb.items[0].id
check('A 删 B 的衣物 → 404（不是 403，防 id 枚举）',
  (await req(`/garments/${victim}`, { method: 'DELETE', token: A.token })).status === 404)
check('A 收藏 B 的衣物 → 404',
  (await req(`/garments/${victim}/fav`, { method: 'POST', token: A.token })).status === 404)
const { data: lb2 } = await req('/garments', { token: B.token })
check('B 衣橱条数未被改动', lb2.items.length === lb.items.length)

console.log('\n【3】自己的操作正常 + 请求体里伪造 userId 无效')
const { status: sc, data: created } = await req('/garments', {
  method: 'POST', token: A.token,
  // 故意在 body 里塞 B 的 userId，看服务端会不会认
  body: { name: '验收测试外套', userId: B.userId, user_id: B.userId },
})
check('A 新增 → 201', sc === 201, `实际 ${sc}`)
const { data: lb3 } = await req('/garments', { token: B.token })
check('body 里伪造的 userId 没生效（没进 B 的衣橱）', lb3.items.length === lb.items.length)
const { data: la2 } = await req('/garments', { token: A.token })
check('进的是 A 的衣橱', la2.items.some((g) => g.id === created.item.id))
check('A 删自己的 → 200',
  (await req(`/garments/${created.item.id}`, { method: 'DELETE', token: A.token })).status === 200)

console.log(failed === 0 ? '\n🎉 HTTP 层全部通过\n' : `\n❌ ${failed} 项未通过\n`)
process.exitCode = failed === 0 ? 0 : 1
