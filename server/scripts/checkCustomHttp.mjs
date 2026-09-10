/**
 * 功能五 HTTP 验收：真实上传、咨询、IM、VIP 与用户隔离。
 *
 * 启动一个临时后端实例，跑完自动关闭。和 checkCustom.mjs 分工：
 * 那个直调 service，这个验证 multer、路由、状态码和静态文件。
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const serverDir = join(here, '..')
// 2026-09-10：素材在「接入 108 张真实素材」那次提交里统一转成了 jpg，
// 这里原本硬编码 front.png，之后就一直 ENOENT。断言别绑死实现细节，
// 同 docs/后端踩坑/AI与RAG.md §2.5 的教训。
const imagePath = join(here, '..', '..', 'miniapp', 'src', 'static', 'images', 'model', 'front.jpg')
const base = 'http://127.0.0.1:8791/api'

let failed = 0
function check(label, ok, extra = '') {
  console.log(`${ok ? '  ✅' : '  ❌'} ${label}${extra ? ' — ' + extra : ''}`)
  if (!ok) failed += 1
}

async function request(path, { method = 'GET', token, body, headers = {} } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    /* 图片等非 JSON 响应 */
  }
  return { status: res.status, data }
}

async function waitForServer() {
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(base + '/health')
      if (res.ok) return
    } catch {
      /* 等待进程启动 */
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error('临时服务未能在 15 秒内启动')
}

let serverLog = ''
const child = spawn(process.execPath, ['index.mjs'], {
  cwd: serverDir,
  env: {
    ...process.env,
    PORT: '8791',
    NODE_ENV: 'test',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
child.stdout.on('data', (chunk) => {
  serverLog += chunk.toString()
})
child.stderr.on('data', (chunk) => {
  serverLog += chunk.toString()
})

try {
  await waitForServer()
  const stamp = Date.now().toString(36)
  const { data: A } = await request('/auth/dev-token', {
    method: 'POST',
    body: { tag: `custom_http_a_${stamp}` },
  })
  const { data: B } = await request('/auth/dev-token', {
    method: 'POST',
    body: { tag: `custom_http_b_${stamp}` },
  })

  console.log('\n【1】图片上传与静态访问')
  const form = new FormData()
  form.append('file', new Blob([readFileSync(imagePath)], { type: 'image/jpeg' }), 'front.jpg')
  const uploaded = await request('/custom/upload', {
    method: 'POST',
    token: A.token,
    body: form,
  })
  check('上传返回 201 和 URL', uploaded.status === 201 && Boolean(uploaded.data?.url))
  const staticUrl = `http://127.0.0.1:8791${uploaded.data?.url || ''}`
  const staticRes = await fetch(staticUrl)
  check('上传后的图片可以通过 /uploads 访问', staticRes.ok, String(staticRes.status))

  console.log('\n【2】咨询、申请与 IM 接口')
  const inquiry = await request('/custom/inquiries', {
    method: 'POST',
    token: A.token,
    body: {
      serviceType: 'body',
      requirements: '孕妇通勤连衣裙',
      referenceImages: [uploaded.data.url],
    },
  })
  check('咨询提交返回 201', inquiry.status === 201, String(inquiry.status))
  const requestId = inquiry.data?.request?.id

  const list = await request('/custom/requests', { token: A.token })
  check(
    '申请列表包含新申请',
    list.data?.requests?.some((item) => item.id === requestId),
  )

  const detail = await request(`/custom/requests/${requestId}`, { token: A.token })
  check('申请详情返回 200', detail.status === 200 && detail.data?.request?.status === 'submitted')
  const crossDetail = await request(`/custom/requests/${requestId}`, { token: B.token })
  check('其他用户读取返回 404', crossDetail.status === 404, String(crossDetail.status))

  const chat = await request(`/custom/requests/${requestId}/messages`, {
    method: 'POST',
    token: A.token,
    body: { content: '想了解透气和好打理的面料' },
  })
  check(
    '发送消息后返回用户消息和设计师回复',
    chat.status === 200 &&
      chat.data?.messages?.some((item) => item.sender === 'user') &&
      chat.data?.messages?.some((item) => item.sender === 'designer'),
  )

  console.log('\n【3】VIP 限制')
  const blocked = await request('/custom/inquiries', {
    method: 'POST',
    token: B.token,
    body: {
      serviceType: 'taste',
      requirements: '手工刺绣礼服',
      vipOnly: true,
    },
  })
  check('普通会员 VIP 预约返回 403', blocked.status === 403, String(blocked.status))
  const upgraded = await request('/custom/membership/upgrade', {
    method: 'POST',
    token: B.token,
  })
  check('演示升级返回 vip', upgraded.data?.membershipLevel === 'vip')
  const allowed = await request('/custom/inquiries', {
    method: 'POST',
    token: B.token,
    body: {
      serviceType: 'taste',
      requirements: '手工刺绣礼服',
      vipOnly: true,
    },
  })
  check('VIP 提交返回 201', allowed.status === 201, String(allowed.status))

  console.log(failed === 0 ? '\n🎉 功能五 HTTP 层验收全部通过\n' : `\n❌ ${failed} 项未通过\n`)
} catch (err) {
  console.error('\n❌ HTTP 验收异常:', err.message)
  console.error(serverLog.slice(-5000))
  failed += 1
} finally {
  child.kill()
}

process.exitCode = failed === 0 ? 0 : 1
