/* 调后端 AI 接口（后端再去调大模型，密钥不暴露在浏览器） */

export interface AiRadarDim {
  name: string
  value: number
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

export async function fetchStyleReport(profile: ProfilePayload): Promise<StyleReport> {
  const res = await fetch('/api/style-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(err.message || `请求失败（${res.status}）`)
  }
  return (await res.json()) as StyleReport
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
  const res = await fetch('/api/scene-outfits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(err.message || `请求失败（${res.status}）`)
  }
  const data = (await res.json()) as { outfits?: SceneOutfit[] }
  return data.outfits ?? []
}

/* ---------------- AI 穿搭顾问对话 ---------------- */

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function sendChat(messages: ChatMessage[]): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(err.message || `请求失败（${res.status}）`)
  }
  const data = (await res.json()) as { reply?: string }
  return data.reply ?? ''
}
