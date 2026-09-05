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
