/*
 * 阿里百炼（DashScope）适配层。
 *
 * 这一层只干两件事：把「能力名 + 业务参数」翻译成百炼的异步任务请求，
 * 再把百炼的任务状态翻译回统一形状。不碰数据库、不认识 userId、不做业务校验。
 *
 * 为什么写成能力注册表，而不是直接写死 aitryon：
 * 试衣 / 换脸 / 场景生成走的是**同一套协议** —— 创建异步任务拿 task_id，
 * 轮询 GET /api/v1/tasks/{id}，SUCCEEDED 后从 output 里取图。
 * 区别只在 path、model、input 的键名。往 CAPABILITIES 里加一条就多一个能力，
 * 上层（service / 路由 / 前端）一行都不用改。
 *
 * 环境变量：
 *   DASHSCOPE_API_KEY    百炼 API Key（**北京地域**，新加坡地域的 key 调不通这几个模型）
 *   DASHSCOPE_BASE_URL   可选，默认 https://dashscope.aliyuncs.com
 *   BAILIAN_TRYON_MODEL  可选，aitryon（默认）或 aitryon-plus，两者调用完全兼容
 */

import { config } from '../../config/env.mjs'

const BASE_URL = config.bailian.baseUrl
const API_KEY = config.bailian.apiKey

/** 创建任务的超时。只是「提交」这一下，几秒就该回，不是等出图 */
const CREATE_TIMEOUT_MS = 20000
/** 单次查询任务的超时 */
const QUERY_TIMEOUT_MS = 15000
/** 上传单张图的超时。走的是 OSS 直传，比接口慢，给宽一点 */
const UPLOAD_TIMEOUT_MS = 60000

function bailianError(message, status = 502, code = 'BAILIAN_ERROR', extra = {}) {
  const err = new Error(message)
  err.status = status
  err.code = code
  Object.assign(err, extra)
  return err
}

/* ============ 能力注册表 ============ */

/**
 * 每个能力描述四件事：调哪个 path、用哪个 model、业务参数怎么翻译成 input/parameters。
 *
 * buildInput 里对可选字段用「有值才带上这个键」而不是 `key: value || null` ——
 * 百炼对显式的 null 会当成非法值报 InvalidParameter，缺键才是「不提供」。
 */
export const CAPABILITIES = {
  /** AI 试衣：人像 + 平铺服装图 → 上身图 */
  tryon: {
    label: 'AI 试衣',
    path: '/api/v1/services/aigc/image2image/image-synthesis/',
    models: ['aitryon', 'aitryon-plus'],
    defaultModel: config.bailian.tryonModel,
    /** 需要用户提供的图片字段，交给上层做「公网可达」校验 */
    imageFields: ['personImageUrl', 'topGarmentUrl', 'bottomGarmentUrl'],
    buildInput(payload) {
      const input = { person_image_url: payload.personImageUrl }
      if (payload.topGarmentUrl) input.top_garment_url = payload.topGarmentUrl
      if (payload.bottomGarmentUrl) input.bottom_garment_url = payload.bottomGarmentUrl
      return input
    },
    buildParameters(payload) {
      return {
        // -1 = 跟随输入分辨率。文档默认值，别改成具体数字，否则窄图会被拉伸
        resolution: -1,
        restore_face: payload.restoreFace !== false,
      }
    },
    validate(payload) {
      if (!payload.personImageUrl) return '缺少人物图片'
      if (!payload.topGarmentUrl && !payload.bottomGarmentUrl) return '至少要提供一件上装或下装'
      return ''
    },
  },
}

export function getCapability(name) {
  const cap = CAPABILITIES[name]
  if (!cap) throw bailianError(`未知的百炼能力：${name}`, 400, 'BAILIAN_CAPABILITY_UNKNOWN')
  return cap
}

export function isEnabled() {
  return Boolean(API_KEY)
}

export function getBailianRuntime() {
  return {
    enabled: isEnabled(),
    baseUrl: BASE_URL,
    capabilities: Object.entries(CAPABILITIES).map(([key, cap]) => ({
      key,
      label: cap.label,
      model: cap.defaultModel,
      models: cap.models,
    })),
  }
}

function assertEnabled() {
  if (!API_KEY) {
    throw bailianError('未配置 DASHSCOPE_API_KEY，AI 试衣不可用', 503, 'BAILIAN_NO_KEY')
  }
}

export function resolveModel(capabilityName, model) {
  const cap = getCapability(capabilityName)
  const want = String(model || '').trim()
  if (!want) return cap.defaultModel
  if (!cap.models.includes(want)) {
    throw bailianError(
      `${cap.label} 不支持模型 ${want}（可选：${cap.models.join(' / ')}）`,
      400,
      'BAILIAN_MODEL_UNKNOWN',
    )
  }
  return want
}

/* ============ HTTP ============ */

function authHeaders(extra = {}) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}`, ...extra }
}

/* ============ 临时文件直传 ============ */

/**
 * 把本地文件传到百炼的临时 OSS，拿一个 `oss://` 地址。
 *
 * 为什么需要这个：aitryon 的图是**阿里的服务器去下载**的，本机的
 * http://127.0.0.1:8787/uploads/... 和小程序包里的 static/ 它都够不着。
 * 没有这条路的话，就只能先自己买 OSS 才能试衣 —— 对 demo 是过重的前置条件。
 *
 * 拿到的 oss:// 地址要配合请求头 X-DashScope-OssResourceResolve: enable 才认，
 * 见 createTask。上传凭证 5 分钟过期，所以是「每次提交现取现传」，不做缓存。
 */
export async function uploadFile(model, filename, buffer, mimeType = 'application/octet-stream') {
  assertEnabled()
  const policyRes = await fetch(`${BASE_URL}/api/v1/uploads?action=getPolicy&model=${encodeURIComponent(model)}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
  })
  const parsed = await readBody(policyRes)
  if (!policyRes.ok) throw describeFailure(policyRes, parsed)
  const policy = parsed.json?.data
  if (!policy?.upload_host) {
    throw bailianError('百炼没有返回上传凭证', 502, 'BAILIAN_NO_UPLOAD_POLICY')
  }

  const key = `${policy.upload_dir}/${filename}`
  const form = new FormData()
  form.append('OSSAccessKeyId', policy.oss_access_key_id)
  form.append('Signature', policy.signature)
  form.append('policy', policy.policy)
  form.append('key', key)
  form.append('x-oss-object-acl', policy.x_oss_object_acl)
  form.append('x-oss-forbid-overwrite', policy.x_oss_forbid_overwrite)
  form.append('success_action_status', '200')
  form.append('x-oss-content-type', mimeType)
  form.append('file', new Blob([buffer], { type: mimeType }), filename)

  const uploadRes = await fetch(policy.upload_host, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  })
  if (!uploadRes.ok) {
    const text = await uploadRes.text()
    throw bailianError(
      `上传到百炼临时空间失败（${uploadRes.status}）：${text.slice(0, 200)}`,
      502,
      'BAILIAN_UPLOAD_FAILED',
    )
  }
  return `oss://${key}`
}

/**
 * 百炼出错时的响应体是 { code, message, request_id }，HTTP 状态码同时也是错的；
 * 但网关层（限流、鉴权失败）有时只回一段纯文本。两种都得能读出来。
 */
async function readBody(response) {
  const text = await response.text()
  try {
    return { json: JSON.parse(text), text }
  } catch {
    return { json: null, text }
  }
}

function describeFailure(response, body) {
  const code = body.json?.code || ''
  const message = body.json?.message || body.text?.slice(0, 300) || '无响应内容'
  if (response.status === 401 || response.status === 403) {
    return bailianError(
      `百炼鉴权失败（${code || response.status}）：${message}。检查 DASHSCOPE_API_KEY 是否为北京地域的 key`,
      502,
      'BAILIAN_AUTH_FAILED',
    )
  }
  if (response.status === 429) {
    return bailianError(`百炼限流，稍后再试：${message}`, 503, 'BAILIAN_RATE_LIMITED')
  }
  return bailianError(`百炼接口 ${response.status}${code ? ` ${code}` : ''}：${message}`, 502, 'BAILIAN_HTTP_ERROR')
}

/* ============ 任务状态 ============ */

const TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'CANCELED', 'UNKNOWN'])

/** UNKNOWN 也算终态：百炼对「task_id 不存在或已过期（超过 24h）」就回这个，再轮询也不会变 */
export function isTerminal(status) {
  return TERMINAL.has(String(status || '').toUpperCase())
}

function normalizeStatus(raw) {
  const value = String(raw || '').toUpperCase()
  return value || 'PENDING'
}

/**
 * 从 output 里把图片 URL 抠出来。
 *
 * 文档在不同页面上给的字段名不一致：试衣主接口写的是 output.image_url，
 * 另一些异步图像模型是 output.results[].url。没法从文档确定单一形状，
 * 所以三种都扫一遍，取到什么算什么 —— 这里多写几行，比线上「任务成功但没图」强。
 */
export function extractImages(output = {}) {
  const urls = []
  const push = (value) => {
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) urls.push(value)
  }
  push(output.image_url)
  push(output.result_url)
  for (const item of Array.isArray(output.results) ? output.results : []) {
    if (typeof item === 'string') push(item)
    else if (item && typeof item === 'object') push(item.url || item.image_url)
  }
  for (const item of Array.isArray(output.images) ? output.images : []) {
    if (typeof item === 'string') push(item)
    else if (item && typeof item === 'object') push(item.url || item.image_url)
  }
  return [...new Set(urls)]
}

/* ============ 对外接口 ============ */

/**
 * 提交一个异步任务，立刻返回 task_id（不等出图）。
 * 出图要 15–30s，HTTP 请求不该挂那么久 —— 由调用方轮询 fetchTask。
 */
export async function createTask(capabilityName, payload = {}, { model } = {}) {
  assertEnabled()
  const cap = getCapability(capabilityName)
  const invalid = cap.validate ? cap.validate(payload) : ''
  if (invalid) throw bailianError(invalid, 400, 'BAILIAN_INPUT_INVALID')

  const usedModel = resolveModel(capabilityName, model)
  const body = {
    model: usedModel,
    input: cap.buildInput(payload),
    parameters: cap.buildParameters ? cap.buildParameters(payload) : {},
  }

  // 只要有一张图是临时空间的 oss:// 地址，就得开这个头，否则百炼把它当成非法 URL
  const usesOss = Object.values(body.input).some((v) => typeof v === 'string' && v.startsWith('oss://'))

  const response = await fetch(`${BASE_URL}${cap.path}`, {
    method: 'POST',
    // 少了 X-DashScope-Async 这个头，接口会按同步模式跑，然后超时
    headers: authHeaders({
      'X-DashScope-Async': 'enable',
      ...(usesOss ? { 'X-DashScope-OssResourceResolve': 'enable' } : {}),
    }),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
  })
  const parsed = await readBody(response)
  if (!response.ok) throw describeFailure(response, parsed)

  const output = parsed.json?.output || {}
  if (!output.task_id) {
    throw bailianError(`百炼没有返回 task_id：${parsed.text.slice(0, 200)}`, 502, 'BAILIAN_NO_TASK_ID')
  }
  return {
    taskId: String(output.task_id),
    status: normalizeStatus(output.task_status),
    model: usedModel,
    requestId: parsed.json?.request_id || '',
    request: body,
  }
}

/** 查一次任务状态。终态与否交给调用方用 isTerminal 判断 */
export async function fetchTask(taskId) {
  assertEnabled()
  const id = String(taskId || '').trim()
  if (!id) throw bailianError('缺少 task_id', 400, 'BAILIAN_TASK_ID_REQUIRED')

  const response = await fetch(`${BASE_URL}/api/v1/tasks/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
  })
  const parsed = await readBody(response)
  if (!response.ok) throw describeFailure(response, parsed)

  const output = parsed.json?.output || {}
  const status = normalizeStatus(output.task_status)
  return {
    taskId: id,
    status,
    images: status === 'SUCCEEDED' ? extractImages(output) : [],
    // 失败时百炼把原因放在 output.code / output.message，不是外层的 code
    errorMessage: status === 'FAILED' ? String(output.message || output.code || '任务失败') : '',
    usage: parsed.json?.usage || null,
    raw: parsed.json,
  }
}

/**
 * 创建 + 轮询到终态。给冒烟脚本和「等得起」的调用方用；
 * HTTP 路由不要用它，会把请求挂满半分钟。
 */
export async function runTask(capabilityName, payload = {}, options = {}) {
  const { model, timeoutMs = 120000, intervalMs = 3000, onTick } = options
  const created = await createTask(capabilityName, payload, { model })
  const deadline = Date.now() + timeoutMs
  let tick = 0

  for (;;) {
    const current = await fetchTask(created.taskId)
    tick += 1
    if (onTick) onTick({ ...current, tick })
    if (isTerminal(current.status)) return { ...created, ...current }
    if (Date.now() >= deadline) {
      throw bailianError(
        `百炼任务 ${created.taskId} 等待超时（${Math.round(timeoutMs / 1000)}s），任务本身还在跑，24 小时内可继续查`,
        504,
        'BAILIAN_TIMEOUT',
        { taskId: created.taskId },
      )
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}
