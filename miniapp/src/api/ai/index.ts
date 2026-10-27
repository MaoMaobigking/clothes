/* 调后端 AI 接口（统一经过 utils/request 建立身份） */
import { API_BASE_URL, ensureToken, handleUnauthorized, request } from '@/utils/request'
import { readChatStream, type ChatStreamHandlers, type StreamChatResult } from './stream'
import type { ChatMessage, ProfilePayload, SceneOutfit, StyleReport } from './type'

enum API {
  /** 风格报告 */
  STYLE_REPORT_URL = '/api/style-report',
  /** 情景搭配推荐 */
  SCENE_OUTFITS_URL = '/api/scene-outfits',
  /** AI 穿搭顾问对话 */
  CHAT_URL = '/api/chat',
  /** AI 穿搭顾问对话（SSE 流式） */
  CHAT_STREAM_URL = '/api/chat/stream',
  /** 带工具调用的对话（SSE，推的是过程事件 —— 见 streamChatWithTools 的说明） */
  CHAT_TOOLS_URL = '/api/chat/tools',
}

/** 类型再导出的理由见 api/diary/index.ts 的说明 */
export type {
  AiRadarDim,
  AiRecommendation,
  ChatMessage,
  ChatStreamChunk,
  OutfitPieceAi,
  ProfilePayload,
  SceneOutfit,
  StyleReport,
  ToolStep,
} from './type'
export type { ChatStreamHandlers, StreamChatResult } from './stream'

export async function fetchStyleReport(profile: ProfilePayload, answers?: unknown): Promise<StyleReport> {
  return request<StyleReport>({
    url: API.STYLE_REPORT_URL,
    method: 'POST',
    data: { profile, answers },
  })
}

export async function fetchSceneOutfits(input: {
  scene: string
  weather: { city?: string; temp?: number; condition?: string }
  profile: { styles: string[] }
}): Promise<SceneOutfit[]> {
  const data = await request<{ outfits?: SceneOutfit[] }>({
    url: API.SCENE_OUTFITS_URL,
    method: 'POST',
    data: input,
  })
  return data.outfits ?? []
}

export async function sendChat(
  messages: ChatMessage[],
  sessionId?: number,
): Promise<{ reply: string; sessionId?: number }> {
  const data = await request<{ reply?: string; sessionId?: number }>({
    url: API.CHAT_URL,
    method: 'POST',
    data: { messages, sessionId },
  })
  return { reply: data.reply ?? '', sessionId: data.sessionId }
}

/* ---------------- 流式对话 ---------------- */

/**
 * 当前端能不能走流式。
 *
 * **只在 H5 开。** 小程序的 `uni.request` 是「请求-响应」模型，拿不到中间分片；
 * 微信另有分块接收的方案（enableChunked + onChunkReceived），但没在真机上验证过，
 * 没验证的东西不写进代码也不写进简历。小程序端继续走 `/api/chat` 一次性返回。
 */
export const SUPPORTS_CHAT_STREAM: boolean = (() => {
  // #ifdef H5
  return typeof fetch === 'function' && typeof TextDecoder === 'function'
  // #endif
  // #ifndef H5
  return false
  // #endif
})()

export interface StreamChatOptions extends ChatStreamHandlers {
  messages: ChatMessage[]
  /** 续聊用。不传就由服务端新建一个会话 */
  sessionId?: number
  /** 用户点「停止生成」时 abort 它 */
  signal?: AbortSignal
}

/**
 * SSE 流式对话。这里只管鉴权和发请求，读流的语义在 ./stream.ts。
 *
 * 用 `fetch` 而不是浏览器内置的 `EventSource`，两个原因缺一不可：
 * 1. EventSource 只能发 GET，而这个接口要 POST 一整段对话历史（URL 塞不下）；
 * 2. EventSource 不能自定义请求头，带不了 `Authorization`。
 * 网络中断时使用请求编号和事件游标续接，不重新提交生成。
 */
export async function streamChat(options: StreamChatOptions): Promise<StreamChatResult> {
  return postSseChat(API.CHAT_STREAM_URL, options)
}

/**
 * 带工具调用的流式对话（批次 3）。
 *
 * 同时推送模型文本增量和工具执行过程；支持 OpenAI 兼容与 Anthropic 协议。
 */
export async function streamChatWithTools(options: StreamChatOptions): Promise<StreamChatResult> {
  return postSseChat(API.CHAT_TOOLS_URL, options)
}

/** 两个 SSE 接口的公共部分：鉴权、发请求、错误归一化，然后交给 readChatStream */
async function postSseChat(url: string, options: StreamChatOptions): Promise<StreamChatResult> {
  const { messages, sessionId, onDelta, onSession, onStep, signal } = options
  const token = await ensureToken()
  const requestId = crypto.randomUUID()
  let sequence = 0
  let text = ''
  let currentSession = sessionId
  const cancel = () => {
    void fetch(`${API_BASE_URL}/api/chat/requests/${requestId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      keepalive: true,
    }).catch(() => {})
  }
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (signal?.aborted) return { text, sessionId: currentSession, aborted: true }
      try {
        const res = await fetch(`${API_BASE_URL}${url}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ messages, sessionId, requestId, resumeFrom: sequence, resume: attempt > 0 }),
          signal,
        })
        if (res.status === 401) throw Object.assign(handleUnauthorized(), { retryable: false })
        if (!res.ok) {
          const payload = await res.json().catch(() => null)
          throw Object.assign(new Error(payload?.message || payload?.error || `请求失败（${res.status}）`), {
            retryable: res.status >= 500,
          })
        }
        if (!res.body) throw Object.assign(new Error('当前环境不支持流式读取响应'), { retryable: false })
        const result = await readChatStream(
          res.body,
          {
            onDelta: (delta) => {
              text += delta
              onDelta(delta)
            },
            onSession: (id) => {
              currentSession = id
              onSession?.(id)
            },
            onStep,
          },
          {
            sessionId: currentSession,
            signal,
            afterSequence: sequence,
            onSequence: (id) => {
              sequence = id
            },
          },
        )
        if (result.aborted) return { text, sessionId: currentSession, aborted: true }
        if (result.completed) return result
        throw new Error('连接中断')
      } catch (err) {
        if (signal?.aborted) return { text, sessionId: currentSession, aborted: true }
        if ((err as { retryable?: boolean }).retryable === false || attempt === 3) throw err
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
      }
    }
    throw new Error('续接失败，请查看会话记录')
  } finally {
    signal?.removeEventListener('abort', cancel)
  }
}
