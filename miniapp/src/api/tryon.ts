/*
 * AI 试衣（阿里百炼 aitryon）。
 *
 * 出图要 15–30s，所以是「提交拿 taskId → 轮询」两步，不是一个请求等到底：
 * 小程序的 request 默认 60s 超时，而且用户盯着一个不动的按钮十几秒就会以为卡死。
 *
 * 图片地址直接把页面上用的那个传回去就行 —— 服务端认三种：
 * 公网 http(s)、/uploads/...（用户上传的）、/static/images/...（包内演示素材）。
 * 后两种由服务端读盘传到百炼的临时空间，前端不用管。
 */
import { API_BASE_URL, request, publicRequest } from '@/utils/request'

export type AiTaskStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'UNKNOWN'

export interface AiTask {
  id: number
  capability: string
  provider: string
  model: string
  taskId: string
  status: AiTaskStatus
  input: Record<string, any>
  imageUrl: string
  errorMessage: string
  createdAt: string
}

export interface TryonPayload {
  personImageUrl: string
  topGarmentUrl?: string
  bottomGarmentUrl?: string
  model?: string
}

const TERMINAL: AiTaskStatus[] = ['SUCCEEDED', 'FAILED', 'CANCELED', 'UNKNOWN']

export function isTerminal(status: AiTaskStatus) {
  return TERMINAL.includes(status)
}

/**
 * 把展示用的地址还原成服务端认得的形式。
 *
 * wardrobe.resolveImageUrl 会给 /uploads/... 拼上 API_BASE_URL 让 <image> 能显示，
 * 但那是开发机地址（127.0.0.1:8787）。原样发回去会被服务端判成内网地址挡下来 ——
 * 阿里的服务器确实下载不到它。所以发之前把前缀摘掉，还原成相对路径。
 */
export function toServerImageRef(src?: string): string {
  const value = (src || '').trim()
  if (!value) return ''
  if (API_BASE_URL && value.startsWith(API_BASE_URL)) return value.slice(API_BASE_URL.length)
  return value
}

/** 服务端有没有配百炼的 key。没配的话入口应该置灰，而不是点了才报错。 */
export async function apiTryonEnabled(): Promise<boolean> {
  try {
    const d = await publicRequest<{ bailian?: { enabled?: boolean } }>({ url: '/api/health' })
    return Boolean(d.bailian?.enabled)
  } catch {
    // 健康检查失败不该让按钮永久置灰：真提交时该报什么错还是会报
    return false
  }
}

export async function apiSubmitTryon(payload: TryonPayload): Promise<AiTask> {
  const d = await request<{ task: AiTask }>({
    url: '/api/tryon',
    method: 'POST',
    data: {
      personImageUrl: toServerImageRef(payload.personImageUrl),
      topGarmentUrl: toServerImageRef(payload.topGarmentUrl),
      bottomGarmentUrl: toServerImageRef(payload.bottomGarmentUrl),
      ...(payload.model ? { model: payload.model } : {}),
    },
  })
  return d.task
}

export async function apiGetTryon(taskId: string): Promise<AiTask> {
  const d = await request<{ task: AiTask }>({ url: `/api/tryon/${taskId}` })
  return d.task
}

export async function apiListTryon(limit = 20): Promise<AiTask[]> {
  const d = await request<{ tasks: AiTask[] }>({ url: `/api/tryon?limit=${limit}` })
  return d.tasks || []
}

/**
 * 轮询到终态。
 *
 * 超时了不算失败：任务在百炼那边还在跑，taskId 24 小时内都能查，
 * 所以这里抛的错要把 taskId 带出去，而不是让它彻底丢掉。
 */
export async function pollTryon(
  taskId: string,
  {
    timeoutMs = 90000,
    intervalMs = 2500,
    onTick,
  }: {
    timeoutMs?: number
    intervalMs?: number
    onTick?: (task: AiTask) => void
  } = {},
): Promise<AiTask> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const task = await apiGetTryon(taskId)
    onTick?.(task)
    if (isTerminal(task.status)) return task
    if (Date.now() >= deadline) {
      const err = new Error('出图超时了，稍后可以在试衣记录里再看看') as Error & { taskId?: string }
      err.taskId = taskId
      throw err
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

/** 提交 + 等结果，返回出图地址。失败时抛错，错误文案直接可展示。 */
export async function runTryon(payload: TryonPayload, onTick?: (task: AiTask) => void): Promise<string> {
  const created = await apiSubmitTryon(payload)
  const done = await pollTryon(created.taskId, { onTick })
  if (done.status !== 'SUCCEEDED') {
    throw new Error(done.errorMessage || `试衣失败（${done.status}）`)
  }
  if (!done.imageUrl) throw new Error('试衣成功但没拿到图片地址')
  return done.imageUrl
}
