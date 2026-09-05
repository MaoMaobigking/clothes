/**
 * AI 异步任务服务层（阿里百炼）
 *
 * 职责：校验业务入参 → 交给 bailianService 提交 → 落库 → 提供「查一次并回写」。
 * 这一层对能力是**通用的**：tryon / 后续的换脸、场景生成共用同一套提交与轮询逻辑，
 * 差异全部收敛在 bailianService 的 CAPABILITIES 注册表里。
 *
 * 为什么提交接口不等出图：
 * 百炼出图要 15–30s。HTTP 请求挂那么久，微信小程序端会先超时（默认 60s，但用户
 * 早就以为卡死了）。所以提交立刻返回 taskId，由前端轮询 GET /:taskId。
 */
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, extname, sep } from 'node:path'
import * as aiTaskRepo from '../repositories/aiTaskRepo.mjs'
import * as bailian from './bailianService.mjs'

const here = dirname(fileURLToPath(import.meta.url))

function serviceError(message, status = 400, code = 'AI_TASK_ERROR') {
  const err = new Error(message)
  err.status = status
  err.code = code
  return err
}

/*
 * 百炼是**阿里的服务器去下载**这些图，不是我们把图传过去。
 * 所以内网地址、开发机的 127.0.0.1:8787/uploads 一律不可达 —— 让它先失败在这里，
 * 比等 20 秒拿一个 InvalidURL 强得多。本地文件走的是另一条路（见下面的上传），
 * 这个函数只管「声称是公网地址」的那种输入。
 */
const PRIVATE_HOST = /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i

function assertPublicImageUrl(value, label) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) {
    throw serviceError(`${label}必须是 http/https 的公网图片地址`, 400, 'AI_TASK_URL_INVALID')
  }
  if (url.length > 1000) {
    throw serviceError(`${label}地址过长`, 400, 'AI_TASK_URL_TOO_LONG')
  }
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    throw serviceError(`${label}不是合法的 URL`, 400, 'AI_TASK_URL_INVALID')
  }
  if (PRIVATE_HOST.test(host) || host.endsWith('.local')) {
    throw serviceError(
      `${label}是内网地址（${host}），阿里百炼的服务器下载不到。请先把图片放到公网可访问的地址（如 OSS）`,
      400,
      'AI_TASK_URL_UNREACHABLE',
    )
  }
  return url
}

const LABELS = {
  personImageUrl: '人物图片',
  topGarmentUrl: '上装图片',
  bottomGarmentUrl: '下装图片',
}

/* ============ 本地图片 → 百炼临时空间 ============ */

/*
 * 前端手里的图片地址有三种，这里统一成百炼认得的形式：
 *
 *   https://…              公网图，原样透传
 *   /uploads/garments/x.png 用户自己传的，落在 server/uploads 下，是真实文件
 *   /images/closet/g1.png   演示素材，**在小程序包里**，服务端 uploads 下没有这个文件
 *
 * 后两种都读盘 → 传百炼临时空间 → 换成 oss:// 地址。
 * 不这么做的话，试衣就只能拿公网示例图演示，用户点自己衣橱里的衣服必然失败。
 *
 * 演示素材的根目录默认按仓库布局找 ../miniapp/src/static；前后端分开部署时用
 * MINIAPP_STATIC_DIR 覆盖，或者干脆把素材拷进 server/uploads。
 */
const UPLOAD_ROOT = resolve(here, '..', 'uploads')
const STATIC_ROOT = resolve(process.env.MINIAPP_STATIC_DIR || join(here, '..', '..', 'miniapp', 'src', 'static'))

/** 单张图上限。百炼自己也有限制，本地先拦一道，省得白传一趟 */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
}

/**
 * 把 /uploads/... 或 /images/... 映射到磁盘路径。
 *
 * 必须验证解析结果仍在根目录内：不然 /uploads/../.env 这种输入就能让接口
 * 把服务端任意文件传到百炼去。用 sep 结尾比较，避免 uploads-old 这类前缀误判。
 */
function resolveLocalFile(ref) {
  const clean = ref.split('?')[0].split('#')[0]
  const parts = clean.replace(/^\/+/, '').split('/')
  let root = ''
  let rest = ''
  if (parts[0] === 'uploads') {
    root = UPLOAD_ROOT
    rest = parts.slice(1).join('/')
  } else if (parts[0] === 'images') {
    root = STATIC_ROOT
    rest = clean.replace(/^\/+/, '')
  } else if (parts[0] === 'static' && parts[1] === 'images') {
    root = STATIC_ROOT
    rest = parts.slice(1).join('/')
  } else {
    return null
  }
  const full = resolve(root, rest)
  if (full !== root && !full.startsWith(root + sep)) return null
  return full
}

async function uploadLocalImage(model, ref, label) {
  const full = resolveLocalFile(ref)
  if (!full) {
    throw serviceError(
      `${label}的地址无法识别（${ref}）。支持公网 http(s) 地址、/uploads/... 或 /images/...`,
      400,
      'AI_TASK_URL_INVALID',
    )
  }
  const ext = extname(full).toLowerCase()
  const mime = MIME_BY_EXT[ext]
  if (!mime) {
    throw serviceError(
      `${label}格式不支持（${ext || '无扩展名'}），请用 png / jpg / webp / bmp`,
      400,
      'AI_TASK_IMAGE_TYPE',
    )
  }

  let buffer
  try {
    buffer = await readFile(full)
  } catch {
    // 演示素材没同步到服务端是最可能的原因，错误信息直接把路径给出来，省得对着 500 猜
    throw serviceError(
      `${label}在服务端找不到（${ref}）。演示素材需要放在 ${STATIC_ROOT}，或用 MINIAPP_STATIC_DIR 指到实际目录`,
      400,
      'AI_TASK_IMAGE_NOT_FOUND',
    )
  }
  if (!buffer.length) {
    throw serviceError(`${label}是空文件（${ref}）`, 400, 'AI_TASK_IMAGE_EMPTY')
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw serviceError(`${label}超过 ${MAX_IMAGE_BYTES / 1024 / 1024}MB`, 400, 'AI_TASK_IMAGE_TOO_LARGE')
  }
  // 加随机前缀：上传凭证带 x-oss-forbid-overwrite，同名 key 传第二次会被拒
  return bailian.uploadFile(model, `${randomUUID()}${ext}`, buffer, mime)
}

/**
 * 按能力声明的 imageFields 逐个解析，其余字段原样透传。
 * 返回的是**给百炼用的**副本；落库存的仍是前端传来的原始地址
 * （oss:// 是临时的，存进历史记录第二天就打不开了）。
 */
async function resolveImages(cap, model, payload) {
  const next = { ...payload }
  for (const field of cap.imageFields || []) {
    const label = LABELS[field] || field
    const raw = String(payload[field] || '').trim()
    if (!raw) {
      next[field] = ''
      continue
    }
    if (/^oss:\/\//i.test(raw)) next[field] = raw
    else if (/^https?:\/\//i.test(raw)) next[field] = assertPublicImageUrl(raw, label)
    else next[field] = await uploadLocalImage(model, raw, label)
  }
  return next
}

/** 提交任务。立刻返回 PENDING 记录，不等出图。 */
export async function submitTask(userId, capabilityName, payload = {}, { model } = {}) {
  if (!bailian.isEnabled()) {
    throw serviceError('服务端未配置 DASHSCOPE_API_KEY，AI 功能暂不可用', 503, 'BAILIAN_NO_KEY')
  }
  const cap = bailian.getCapability(capabilityName)
  // 模型名和必填项先验：错在这两处的话，不值得先把几张图传上去再失败
  const usedModel = bailian.resolveModel(capabilityName, model)
  const invalid = cap.validate ? cap.validate(payload) : ''
  if (invalid) throw serviceError(invalid, 400, 'AI_TASK_INPUT_INVALID')

  const resolved = await resolveImages(cap, usedModel, payload)
  const created = await bailian.createTask(capabilityName, resolved, { model: usedModel })
  return aiTaskRepo.createTask(userId, {
    capability: capabilityName,
    provider: 'bailian',
    model: created.model,
    taskId: created.taskId,
    status: created.status,
    // 存原始地址而不是 oss://：历史记录里要能重新渲染出「用的是哪件衣服」，
    // 而 oss:// 是临时的，过期后既打不开也认不出来
    input: payload,
  })
}

/**
 * 查任务：已是终态就直接回库里的，否则去百炼查一次并回写。
 *
 * 「先查库再决定要不要调上游」不是省事，是省钱和防刷 —— 前端每 2 秒轮询一次，
 * 出图成功后如果不短路，用户停在结果页不动也会一直打百炼的接口。
 */
export async function syncTask(userId, taskId) {
  const record = await aiTaskRepo.findByTaskId(userId, taskId)
  if (!record) throw serviceError('任务不存在', 404, 'AI_TASK_NOT_FOUND')
  if (bailian.isTerminal(record.status)) return record

  let remote
  try {
    remote = await bailian.fetchTask(record.taskId)
  } catch (err) {
    // 查询失败不改任务状态：网络抖一下不该把一个还在跑的任务标成失败
    if (err.code === 'BAILIAN_RATE_LIMITED') return record
    throw err
  }

  const imageUrl = remote.images[0] || ''
  const errorMessage = remote.status === 'SUCCEEDED' && !imageUrl ? '任务成功但没有返回图片地址' : remote.errorMessage
  return aiTaskRepo.updateStatus(userId, record.taskId, {
    status: remote.status,
    imageUrl,
    errorMessage,
    result: remote.status === 'SUCCEEDED' ? { images: remote.images, usage: remote.usage } : null,
  })
}

export async function listTasks(userId, { capability, limit } = {}) {
  return aiTaskRepo.listByUser(userId, { capability, limit })
}
