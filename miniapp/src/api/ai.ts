/* 调后端 AI 接口（统一经过 http.ts 建立开发用户身份） */
import { request } from './http'

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

export async function fetchStyleReport(profile: ProfilePayload, answers?: unknown): Promise<StyleReport> {
  return request<StyleReport>({
    url: '/api/style-report',
    method: 'POST',
    data: { profile, answers },
  })
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

export async function fetchSceneOutfits(input: {
  scene: string
  weather: { city?: string; temp?: number; condition?: string }
  profile: { styles: string[] }
}): Promise<SceneOutfit[]> {
  const data = await request<{ outfits?: SceneOutfit[] }>({
    url: '/api/scene-outfits',
    method: 'POST',
    data: input,
  })
  return data.outfits ?? []
}

/* ---------------- AI 穿搭顾问对话 ---------------- */

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function sendChat(messages: ChatMessage[]): Promise<string> {
  const data = await request<{ reply?: string }>({
    url: '/api/chat',
    method: 'POST',
    data: { messages },
  })
  return data.reply ?? ''
}
