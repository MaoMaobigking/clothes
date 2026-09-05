/*
 * 阿里百炼 AI 试衣冒烟（aitryon）。
 *
 * 走 HTTP 而不是直接调 service，要验的是整条链路：鉴权 → 入参校验 → 提交 →
 * 轮询回写 → 越权隔离。
 *
 * **这个脚本会真的调百炼、真的花钱**（按成功出图计费，失败不计费）。
 * 只想验鉴权和入参校验、不想出图，加 CHECK_TRYON_SKIP_REMOTE=1。
 *
 * 图片有两条路：公网 http(s) 地址阿里直接下载；本机文件（/uploads/... 或
 * 小程序素材 /images/...）由服务端传到百炼临时空间换成 oss:// 再用。
 * 两条都验，因为小程序里真正会走的是后一条。
 *
 * 前置：服务端已在 8787 跑着（npm start），且 .env 里有北京地域的 DASHSCOPE_API_KEY。
 */
import { DEMO_ACCOUNTS, demoPasswordOf } from '../services/authService.mjs'

const BASE = process.env.CHECK_BASE_URL || 'http://127.0.0.1:8787'
const SKIP_REMOTE = process.env.CHECK_TRYON_SKIP_REMOTE === '1'

const SAMPLE = {
  person: 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250626/ubznva/model_person.png',
  top: 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250626/epousa/short_sleeve.jpeg',
  bottom: 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250626/rchumi/pants.jpeg',
}

/** 小程序包内的演示素材，服务端按 MINIAPP_STATIC_DIR 找得到 */
const LOCAL = {
  person: '/images/model/front.jpg',
  top: '/images/closet/g1.jpg',
}

/** 出图 15–30s，留够余量；超了不算失败，任务本身还在跑 */
const POLL_TIMEOUT_MS = 180000
const POLL_INTERVAL_MS = 3000

let failed = 0

function assert(ok, label, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failed += 1
}

function skip(label, why) {
  console.log(`⏭️  ${label}  ${why}`)
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

/** 轮询到终态。返回 null 表示连任务都没读到（已经断言过失败了） */
async function poll(token, taskId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  for (;;) {
    const res = await api(token, `/api/tryon/${taskId}`)
    const task = res.data?.task || null
    if (!task) {
      assert(false, '轮询拿到任务', JSON.stringify(res.data)?.slice(0, 200))
      return null
    }
    process.stdout.write(`\r   ${task.status} … ${Math.round((POLL_TIMEOUT_MS - (deadline - Date.now())) / 1000)}s   `)
    if (['SUCCEEDED', 'FAILED', 'CANCELED', 'UNKNOWN'].includes(task.status) || Date.now() >= deadline) {
      console.log('')
      return task
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
}

async function main() {
  const token = await login('female')
  const other = await login('male')

  /* ---- 健康检查要能看出百炼配没配 ---- */
  const health = await api(null, '/api/health')
  const enabled = Boolean(health.data?.bailian?.enabled)
  assert(health.status === 200, '/api/health 可访问')
  assert(Array.isArray(health.data?.bailian?.capabilities), 'health 里带出能力清单')
  assert(
    health.data?.bailian?.capabilities?.some((c) => c.key === 'tryon'),
    'health 里含 tryon 能力',
    health.data?.bailian?.capabilities?.map((c) => `${c.key}:${c.model}`).join(','),
  )
  console.log(`   百炼：${enabled ? '已配置 key' : '未配置 key'}`)

  /* ---- 鉴权 ---- */
  assert((await api(null, '/api/tryon')).status === 401, '未带 token 访问返回 401')
  assert((await api(null, '/api/tryon', { method: 'POST', body: {} })).status === 401, '未带 token 提交返回 401')

  if (!enabled) {
    skip('入参校验 / 真实出图', '未配置 DASHSCOPE_API_KEY，剩余项跳过')
    console.log('\n提示：在 server/.env 里填 DASHSCOPE_API_KEY（北京地域）后重跑。')
    return
  }

  /* ---- 入参校验（这些都不触发计费，走不到百炼那一步） ---- */
  const noPerson = await api(token, '/api/tryon', {
    method: 'POST',
    body: { topGarmentUrl: SAMPLE.top },
  })
  assert(noPerson.status === 400, '缺人物图 → 400', noPerson.data?.message || '')

  const noGarment = await api(token, '/api/tryon', {
    method: 'POST',
    body: { personImageUrl: SAMPLE.person },
  })
  assert(noGarment.status === 400, '上下装都不给 → 400', noGarment.data?.message || '')

  // 最容易踩的一个：拿开发机的地址当图片地址
  const localUrl = await api(token, '/api/tryon', {
    method: 'POST',
    body: { personImageUrl: 'http://127.0.0.1:8787/uploads/a.png', topGarmentUrl: SAMPLE.top },
  })
  assert(localUrl.status === 400, '内网地址 → 400（阿里下载不到）', localUrl.data?.message || '')
  // errorHandler 把 err.code 装进响应的 `error` 字段，不是 `code`
  assert(localUrl.data?.error === 'AI_TASK_URL_UNREACHABLE', '内网地址的错误码是 AI_TASK_URL_UNREACHABLE')

  const badScheme = await api(token, '/api/tryon', {
    method: 'POST',
    body: { personImageUrl: 'ftp://example.com/a.png', topGarmentUrl: SAMPLE.top },
  })
  assert(badScheme.status === 400, '非 http 协议 → 400', badScheme.data?.message || '')

  // 本地路径是支持的（会先传到百炼临时空间），但文件得真存在
  const missingLocal = await api(token, '/api/tryon', {
    method: 'POST',
    body: { personImageUrl: '/images/model/no-such-file.jpg', topGarmentUrl: SAMPLE.top },
  })
  assert(
    missingLocal.data?.error === 'AI_TASK_IMAGE_NOT_FOUND',
    '本地图不存在 → AI_TASK_IMAGE_NOT_FOUND',
    missingLocal.data?.message?.slice(0, 80) || '',
  )

  // 别让 ../ 把服务端的任意文件（比如 .env）传到百炼去
  const traversal = await api(token, '/api/tryon', {
    method: 'POST',
    body: { personImageUrl: '/uploads/../.env', topGarmentUrl: SAMPLE.top },
  })
  assert(
    traversal.status === 400 && traversal.data?.error === 'AI_TASK_URL_INVALID',
    '目录穿越 → 400',
    traversal.data?.message?.slice(0, 60) || '',
  )

  const badModel = await api(token, '/api/tryon', {
    method: 'POST',
    body: { personImageUrl: SAMPLE.person, topGarmentUrl: SAMPLE.top, model: 'aitryon-nope' },
  })
  assert(badModel.status === 400, '未知模型名 → 400', badModel.data?.message || '')

  assert((await api(token, '/api/tryon/not-a-real-task-id')).status === 404, '查不存在的任务 → 404')

  if (SKIP_REMOTE) {
    skip('真实出图', 'CHECK_TRYON_SKIP_REMOTE=1')
    return
  }

  /* ---- 真实提交（开始计费） ---- */
  console.log('\n提交真实试衣任务（会调百炼，出图约 15–30s）…')
  const created = await api(token, '/api/tryon', {
    method: 'POST',
    body: {
      personImageUrl: SAMPLE.person,
      topGarmentUrl: SAMPLE.top,
      bottomGarmentUrl: SAMPLE.bottom,
    },
  })
  assert(created.status === 200, '提交成功', created.data?.message || '')
  const task = created.data?.task
  if (!task?.taskId) {
    assert(false, '拿到 taskId', JSON.stringify(created.data)?.slice(0, 300))
    return
  }
  assert(Boolean(task.taskId), '拿到 taskId', task.taskId)
  assert(task.status === 'PENDING' || task.status === 'RUNNING', '提交后是未完成态', task.status)
  assert(task.capability === 'tryon' && task.provider === 'bailian', 'capability/provider 落库正确')

  /* ---- 越权：别人的任务查不到 ---- */
  const stolen = await api(other, `/api/tryon/${task.taskId}`)
  assert(stolen.status === 404, '别的用户查这个 taskId → 404')

  /* ---- 轮询 ---- */
  const last = await poll(token, task.taskId)
  if (!last) return

  assert(last.status === 'SUCCEEDED', `任务终态是 SUCCEEDED`, `${last.status} ${last.errorMessage || ''}`)
  assert(/^https?:\/\//.test(last.imageUrl || ''), '出图 URL 已落库', last.imageUrl?.slice(0, 90) || '(空)')

  if (last.imageUrl) {
    // 出图链接是 OSS 临时地址（24h），真下一下确认不是 403/过期
    const head = await fetch(last.imageUrl, { method: 'GET', headers: { Range: 'bytes=0-1023' } })
    assert(head.ok, '出图 URL 可下载', `HTTP ${head.status}`)
  }

  /* ---- 终态后不该再打上游 ---- */
  const again = await api(token, `/api/tryon/${task.taskId}`)
  assert(again.data?.task?.status === last.status, '终态任务重复查询结果一致')

  /* ---- 历史列表 ---- */
  const list = await api(token, '/api/tryon?limit=5')
  assert(list.status === 200 && Array.isArray(list.data?.tasks), '历史列表可读')
  assert(
    (list.data?.tasks || []).some((t) => t.taskId === task.taskId),
    '刚才的任务出现在历史里',
  )
  const otherList = await api(other, '/api/tryon?limit=5')
  assert(!(otherList.data?.tasks || []).some((t) => t.taskId === task.taskId), '别的用户的历史里没有这条')

  /* ---- 本地素材：这条链路才是小程序里真正会走的 ---- */
  // 验的是「本地文件 → 百炼临时空间 → oss:// 能被 aitryon 接受」，不是出图好不好看
  // （演示素材是模特上身图，不是平铺图，效果一般，但只要不 FAILED 就说明通道通了）
  console.log('\n提交本地素材试衣任务（验证 oss:// 直传通道）…')
  const localTask = await api(token, '/api/tryon', {
    method: 'POST',
    body: { personImageUrl: LOCAL.person, topGarmentUrl: LOCAL.top },
  })
  assert(localTask.status === 200, '本地路径提交成功', localTask.data?.message?.slice(0, 120) || '')
  if (localTask.data?.task?.taskId) {
    assert(
      localTask.data.task.input?.personImageUrl === LOCAL.person,
      '落库存的是原始路径而不是临时 oss:// 地址',
      localTask.data.task.input?.personImageUrl || '',
    )
    const localLast = await poll(token, localTask.data.task.taskId)
    if (localLast) {
      assert(
        localLast.status === 'SUCCEEDED',
        '本地素材任务终态是 SUCCEEDED',
        `${localLast.status} ${localLast.errorMessage || ''}`,
      )
    }
  }
}

main()
  .then(() => {
    console.log(failed === 0 ? '\n🎉 全部通过' : `\n💥 ${failed} 项未通过`)
    process.exit(failed === 0 ? 0 : 1)
  })
  .catch((err) => {
    console.error('\n💥 冒烟脚本异常:', err.message)
    process.exit(1)
  })
