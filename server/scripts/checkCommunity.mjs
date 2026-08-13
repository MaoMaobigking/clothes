/**
 * 功能六 HTTP 验收脚本
 *
 * 用法：先启动后端，再执行 cd server && npm run check:community
 */
const BASE = process.env.COMMUNITY_BASE || 'http://localhost:8787/api'

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
  try {
    data = await res.json()
  } catch {
    /* 非 JSON 响应 */
  }
  return { status: res.status, data }
}

try {
  await fetch(`${BASE}/health`)
} catch {
  console.error(`\n❌ 连不上 ${BASE}，请先启动后端\n`)
  process.exit(1)
}

const stamp = Date.now().toString(36)
const A = (await req('/auth/dev-token', {
  method: 'POST',
  body: { tag: `community_a_${stamp}` },
})).data
const B = (await req('/auth/dev-token', {
  method: 'POST',
  body: { tag: `community_b_${stamp}` },
})).data

console.log('\n【1】真实用户与公共内容')
check('两个身份不同', A.userId !== B.userId)
const magazine = await req('/community/contents?type=magazine', { token: A.token })
check('杂志内容可读', magazine.status === 200 && magazine.data.items.length >= 3)

console.log('\n【2】互动按用户隔离')
const articleId = magazine.data.items[0].id
const like = await req(`/community/contents/${articleId}/interactions`, {
  method: 'POST',
  token: A.token,
  body: { action: 'like' },
})
check('A 点赞成功', like.status === 200 && like.data.content.liked)
const bMagazine = await req('/community/contents?type=magazine', { token: B.token })
check('B 不继承 A 的点赞', bMagazine.data.items.find((item) => item.id === articleId)?.liked === false)

const comment = await req('/community/contents/share-demo-01/comments', {
  method: 'POST',
  token: A.token,
  body: { content: `验收评论-${stamp}` },
})
check('评论落库', comment.status === 201)
const detail = await req('/community/contents/share-demo-01', { token: A.token })
check('评论在详情可见', detail.data.content.comments.some((item) => item.id === comment.data.comment.id))

console.log('\n【3】举报过滤与书签')
await req('/community/contents/share-demo-02/interactions', {
  method: 'POST',
  token: A.token,
  body: { action: 'report' },
})
const aShares = await req('/community/contents?type=share', { token: A.token })
const bShares = await req('/community/contents?type=share', { token: B.token })
check('举报后从当前用户列表过滤', !aShares.data.items.some((item) => item.id === 'share-demo-02'))
check('举报不影响其他用户', bShares.data.items.some((item) => item.id === 'share-demo-02'))

await req(`/community/contents/${articleId}/bookmark`, {
  method: 'POST',
  token: A.token,
  body: { note: '验收笔记' },
})
const bookmarks = await req('/community/bookmarks', { token: A.token })
check('书签与笔记可回看', bookmarks.data.items.some((item) => item.id === articleId && item.note === '验收笔记'))

console.log('\n【4】教程积分与管理员统计')
await req('/community/tutorials/tut-basic-layering/complete', {
  method: 'POST',
  token: A.token,
})
const achievements = await req('/community/achievements', { token: A.token })
check('完成教程获得积分', achievements.data.points >= 10)
check('解锁新手徽章', achievements.data.badges.some((item) => item.key === 'learning_starter'))
check('普通用户访问看板 403', (await req('/community/admin/stats', { token: A.token })).status === 403)

const admin = await req('/auth/admin-login', {
  method: 'POST',
  body: { password: process.env.ADMIN_PASSWORD || 'lingxi-admin-demo' },
})
const stats = await req('/community/admin/stats', { token: admin.data.token })
check('管理员读取真实统计', stats.status === 200 && stats.data.stats.contentCount >= 16)

console.log(failed === 0 ? '\n🎉 功能六 HTTP 验收通过\n' : `\n❌ ${failed} 项未通过\n`)
process.exitCode = failed === 0 ? 0 : 1
