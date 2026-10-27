import { randomUUID } from 'node:crypto'
import { saveResultImage } from '../../repositories/resultImageRepo.mjs'

// Base64 通过云函数转发仍需小于平台响应上限。
const LIMIT = 4 * 1024 * 1024

/** Only downloads provider-owned OSS results, never a user-controlled arbitrary URL. */
export async function archiveResult(url, userId, taskId) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.aliyuncs.com')) {
    throw new Error('试衣结果地址不是受信任的阿里云 HTTPS 地址')
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(60000), redirect: 'error' })
  if (!response.ok) throw new Error(`结果图下载失败（${response.status}）`)
  const type = response.headers.get('content-type')?.split(';')[0]
  const extension = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }[type]
  if (!extension || Number(response.headers.get('content-length')) > LIMIT) {
    await response.body?.cancel()
    throw new Error('结果图格式或大小不受支持')
  }
  const parts = []
  let size = 0
  const reader = response.body.getReader()
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > LIMIT) throw new Error('结果图超过 4MB，请使用较低分辨率重试')
      parts.push(value)
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  if (!size) throw new Error('结果图为空')
  const record = await saveResultImage({
    id: randomUUID() + extension,
    userId,
    taskId,
    mime: type,
    content: Buffer.concat(parts),
  })
  if (!record) throw new Error('结果图保存失败')
  return `/api/tryon/images/${record.id}`
}
