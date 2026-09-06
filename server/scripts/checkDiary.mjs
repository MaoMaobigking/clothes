/*
 * 穿搭日记冒烟（规格 §11.1）。
 *
 * 走 HTTP 而不是直接调 service —— 要验的两个坑都只在跨了序列化边界后才现形：
 *  1. PUT 同一天两次会不会撞唯一键（走的是 ON DUPLICATE KEY UPDATE）
 *  2. 返回的 date 是不是 'YYYY-MM-DD' 字符串。mysql2 把 DATE 列转成 JS Date，
 *     JSON.stringify 按 UTC 输出，东八区的 2026-08-18 会变成
 *     '2026-08-17T16:00:00.000Z' —— 日记整体错一天。直接调 repo 是看不出来的。
 *
 * 前置：服务端已在 8787 跑着（npm start）。
 */
import { DEMO_ACCOUNTS, demoPasswordOf } from '../services/auth/index.mjs'

const BASE = process.env.CHECK_BASE_URL || 'http://127.0.0.1:8787'
const DAY = '2026-08-18'
const DAY2 = '2026-08-19'

let failed = 0

function assert(ok, label, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failed += 1
}

async function api(token, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  return { status: res.status, data }
}

async function login(kind) {
  const entry = DEMO_ACCOUNTS.find((item) => item.kind === kind)
  const res = await api(null, '/api/auth/login-password', {
    method: 'POST',
    body: { account: entry.account, password: demoPasswordOf(entry) },
  })
  if (!res.data?.token) throw new Error(`登录失败 ${kind}: ${JSON.stringify(res.data)}`)
  return res.data.token
}

async function main() {
  const token = await login('female')
  const other = await login('male')

  // 未登录一律 401，日记是私人数据
  assert((await api(null, '/api/diary')).status === 401, '未带 token 访问返回 401')

  // 清一遍，重跑不受上一次残留影响
  await api(token, `/api/diary/${DAY}`, { method: 'DELETE' })
  await api(token, `/api/diary/${DAY2}`, { method: 'DELETE' })

  // 先造一条手动搭配，日记要能挂上去（同时也是批次 1 的落库路径）
  const garments = await api(token, '/api/garments')
  const garmentIds = (garments.data?.items || []).slice(0, 3).map((item) => item.id)
  assert(garmentIds.length >= 1, '演示账号衣橱有衣物', `${garmentIds.length} 件`)

  const created = await api(token, '/api/wardrobe/outfits', {
    method: 'POST',
    body: { garmentIds, title: '日记冒烟用搭配' },
  })
  const outfitId = created.data?.item?.id
  // 建资源走 201，不是 200
  assert(created.status === 201 && !!outfitId, '手动搭配落库成功', `status=${created.status} outfitId=${outfitId}`)
  assert(created.data?.item?.kind === 'manual', "落库的 kind='manual'")
  assert(created.data?.item?.isSaved === true, '落库即 isSaved=true')

  // 星标（批次 1 的另一半）
  const starred = await api(token, `/api/wardrobe/outfits/${outfitId}/star`, {
    method: 'POST',
    body: { starred: true },
  })
  assert(starred.data?.item?.isStarred === true, '打星成功')
  const starList = await api(token, '/api/wardrobe/outfits?saved=1&starred=1')
  assert(
    (starList.data?.items || []).some((item) => item.id === outfitId),
    'starred=1 能筛出这条',
  )

  // ---- 日记本体 ----
  const put1 = await api(token, `/api/diary/${DAY}`, {
    method: 'PUT',
    body: { outfitId, note: '今天穿了新买的风衣', weather: '多云 26℃', mood: '开心' },
  })
  assert(put1.status === 200, 'PUT 首次写入成功', `status=${put1.status}`)
  assert(put1.data?.diary?.date === DAY, '返回的 date 是 YYYY-MM-DD 字符串', String(put1.data?.diary?.date))
  assert(put1.data?.diary?.note === '今天穿了新买的风衣', '心得原样存回')
  assert(put1.data?.diary?.outfitId === outfitId, '挂上了搭配')
  assert(put1.data?.diary?.outfitTitle === '日记冒烟用搭配', '带出搭配标题')

  // 同一天再 PUT：upsert，不能报唯一键冲突
  const put2 = await api(token, `/api/diary/${DAY}`, {
    method: 'PUT',
    body: { note: '改成：今天穿了旧风衣' },
  })
  assert(put2.status === 200, '同一天二次 PUT 不冲突', `status=${put2.status}`)
  assert(put2.data?.diary?.id === put1.data?.diary?.id, '覆盖的是同一条，没有新增')
  assert(put2.data?.diary?.note === '改成：今天穿了旧风衣', '心得被覆盖')
  // 没传的字段沿用旧值（PATCH 语义），前端只改一句话时不该把搭配丢了
  assert(put2.data?.diary?.outfitId === outfitId, '未传的 outfitId 保留原值')
  assert(put2.data?.diary?.weather === '多云 26℃', '未传的 weather 保留原值')

  const got = await api(token, `/api/diary/${DAY}`)
  assert(got.data?.diary?.note === '改成：今天穿了旧风衣', 'GET 单日读到最新值')
  assert(got.data?.diary?.date === DAY, 'GET 单日的 date 也是字符串')

  await api(token, `/api/diary/${DAY2}`, { method: 'PUT', body: { note: '第二天' } })
  const month = await api(token, '/api/diary?month=2026-08')
  const days = (month.data?.diaries || []).map((item) => item.date)
  assert(days.includes(DAY) && days.includes(DAY2), '按月查到两条', days.join(','))
  assert(days[0] === DAY2, '按日期倒序', days.join(','))
  const emptyMonth = await api(token, '/api/diary?month=2025-01')
  assert((emptyMonth.data?.diaries || []).length === 0, '空月份返回空数组')

  const recent = await api(token, '/api/diary')
  assert((recent.data?.diaries || []).length >= 2, '不带 month 回最近记录')

  // ---- 校验分支 ----
  assert(
    (await api(token, '/api/diary/2026-02-31', { method: 'PUT', body: { note: 'x' } })).status === 400,
    '不存在的日期被拒（2026-02-31）',
  )
  assert(
    (await api(token, '/api/diary/20260818', { method: 'PUT', body: { note: 'x' } })).status === 400,
    '非 YYYY-MM-DD 被拒',
  )
  assert((await api(token, '/api/diary?month=2026-13')).status === 400, '月份 13 被拒')
  assert(
    (
      await api(token, `/api/diary/${DAY}`, {
        method: 'PUT',
        body: { outfitId: null, note: '', weather: '', mood: '' },
      })
    ).status === 400,
    '四项全空被拒（不许存空记录）',
  )

  // 别人的搭配挂不上来 —— 外键只要求搭配存在，不要求属于你，靠 service 里那次 getOutfit 挡
  const otherPut = await api(other, '/api/diary/2026-08-20', {
    method: 'PUT',
    body: { outfitId, note: '偷别人的搭配' },
  })
  assert(otherPut.status === 404, '引用他人搭配被拒', `status=${otherPut.status}`)

  // 日记是按人隔离的
  const otherList = await api(other, '/api/diary?month=2026-08')
  assert((otherList.data?.diaries || []).length === 0, '另一个账号看不到这些日记')

  // ---- 删除 ----
  const del = await api(token, `/api/diary/${DAY}`, { method: 'DELETE' })
  assert(del.data?.ok === true, 'DELETE 返回 ok')
  assert((await api(token, `/api/diary/${DAY}`)).data?.diary === null, '删完 GET 回 null')
  assert(
    (await api(token, `/api/diary/${DAY}`, { method: 'DELETE' })).data?.ok === false,
    '重复 DELETE 返回 ok:false 而不是报错',
  )

  // 收尾：把冒烟造的数据清掉，演示账号里不留垃圾
  await api(token, `/api/diary/${DAY2}`, { method: 'DELETE' })

  console.log(failed ? `\n❌ 有 ${failed} 项未通过` : '\n✅ 穿搭日记冒烟全部通过')
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error('❌ 冒烟脚本异常：', err)
  process.exit(1)
})
