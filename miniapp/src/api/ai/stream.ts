/**
 * 消费 `/api/chat/stream` 的事件流。
 *
 * 单独一个文件、且**不碰 fetch 和身份** —— 传进来的已经是一条可读流。
 * 这样「停止怎么算、出错怎么算、没收到 done 怎么算」这套语义可以拿假流直接测，
 * 不用起服务端、不用真的烧 AI 额度。index.ts 那边只负责鉴权和发请求。
 */
import { createSseParser } from '@/utils/sse'
import type { ChatStreamChunk, ToolStep } from './type'

export interface ChatStreamHandlers {
  /** 逐片回调，参数是**增量**不是全文 */
  onDelta: (delta: string) => void
  /** 服务端在第一条事件里就给会话号，拿到后存下来供下一轮续聊 */
  onSession?: (sessionId: number) => void
  /** 工具调用的过程事件。只有 /chat/tools 会推 */
  onStep?: (step: ToolStep) => void
}

export interface StreamChatResult {
  text: string
  sessionId?: number
  /** 是否被用户中途停止。true 时 text 是已经生成的那部分，不是错误 */
  aborted: boolean
}

export async function readChatStream(
  body: ReadableStream<Uint8Array>,
  handlers: ChatStreamHandlers,
  options: { sessionId?: number; signal?: AbortSignal } = {},
): Promise<StreamChatResult> {
  const { onDelta, onSession, onStep } = handlers
  const { signal } = options

  const reader = body.getReader()
  const parser = createSseParser()
  let text = ''
  let session = options.sessionId

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      for (const event of parser.push(value)) {
        let chunk: ChatStreamChunk
        try {
          chunk = JSON.parse(event.data)
        } catch {
          // 解析器保证喂进来的是完整事件，走到这里说明服务端发了非 JSON，跳过这一条
          continue
        }

        if (chunk.error) throw new Error(chunk.error)
        if (chunk.step) onStep?.(chunk.step)
        if (chunk.sessionId && chunk.sessionId !== session) {
          session = chunk.sessionId
          onSession?.(chunk.sessionId)
        }
        if (chunk.delta) {
          text += chunk.delta
          onDelta(chunk.delta)
        }
        if (chunk.done) {
          // 服务端给的 fullText 是权威值，拼出来的只是兜底
          return { text: chunk.fullText ?? text, sessionId: session, aborted: false }
        }
      }
    }
  } catch (err) {
    // abort 不是错误：把已经生成的部分交回去
    if (signal?.aborted) return { text, sessionId: session, aborted: true }
    throw err
  } finally {
    /*
     * 必须主动 cancel。只把 reader 丢掉的话连接还挂着，服务端的
     * `res.on('close')` 不触发 —— 那模型还在继续生成，账单还在跑，
     * 「停止」就只是前端自己假装停了。
     */
    reader.cancel().catch(() => {})
  }

  // 流结束了却没收到 done 事件（服务端被掐断），已生成的部分照样算数
  return { text, sessionId: session, aborted: signal?.aborted ?? false }
}
