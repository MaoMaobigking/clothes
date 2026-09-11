/*
 * 后端 AI 接口的数据结构：风格报告、情景搭配、顾问对话。
 */

export interface AiRadarDim {
  name: string
  value: number
  incomplete?: boolean
}

export interface AiRecommendation {
  title: string
  scene: string
  pieces: string[]
  reason: string
}

export interface StyleReport {
  summary: string
  radar: AiRadarDim[]
  palette: string[]
  recommendations: AiRecommendation[]
  tips: string[]
  source?: 'ai' | 'rule'
  aiError?: string
}

/** 发给后端的用户画像（可读文案，方便大模型理解） */
export interface ProfilePayload {
  styles: string[]
  skin: string
  face: string
  bmi: number
  body: Record<string, number>
  preferences: Record<string, string>
}

/* ---------------- 情景搭配推荐 ---------------- */

export interface OutfitPieceAi {
  name: string
  emoji: string
}

export interface SceneOutfit {
  title: string
  scene: string
  reason: string
  pieces: OutfitPieceAi[]
}

/* ---------------- AI 穿搭顾问对话 ---------------- */

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * 工具调用的过程事件（批次 3.1，来自 server/services/ai/tools/index.mjs）。
 *
 * 一次工具调用产生两条：`tool_start` 在执行前，`tool_end` 在执行后。
 * 分两条是为了让界面在工具真正跑的那几百毫秒里有东西可显示。
 */
export interface ToolStep {
  type: 'tool_start' | 'tool_end'
  /** 第几轮（从 1 开始）。后端最多 5 轮 */
  round: number
  /** 工具名，如 list_wardrobe */
  name: string
  /** tool_start 才有：模型填的入参 */
  args?: Record<string, unknown>
  /** tool_end 才有：结果摘要（后端已截到 120 字，不是全文） */
  summary?: string
}

/**
 * `/api/chat/stream` 与 `/api/chat/tools` 每条 SSE 事件的 data。
 *
 * 几种形态共用一个结构，靠字段区分：
 * - 开场：`{ sessionId, delta: '', done: false }` —— 先给会话号，中途断了也已经拿到
 * - 正文：`{ delta: '片段', done: false }`
 * - 过程：`{ step: {...}, done: false }` —— 只有 /chat/tools 会推
 * - 收尾：`{ sessionId, delta: '', done: true, fullText }`
 * - 出错：`{ error: '原因' }`（头已经发出去了，只能在 data 里报错）
 */
export interface ChatStreamChunk {
  sessionId?: number
  delta?: string
  step?: ToolStep
  done?: boolean
  fullText?: string
  error?: string
}
