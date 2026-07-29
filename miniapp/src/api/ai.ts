/* 调后端 AI 接口（uni-app 适配版，用 uni.request 替代 fetch） */

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

function request<T>(options: { url: string; method?: string; data?: any }): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: options.url,
      method: (options.method || 'GET') as any,
      data: options.data,
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        if (res.statusCode >= 400) {
          const err = (res.data as any)?.message || `请求失败（${res.statusCode}）`
          reject(new Error(err))
        } else resolve(res.data as T)
      },
      fail: (err) => reject(err),
    })
  })
}

export async function fetchStyleReport(profile: ProfilePayload): Promise<StyleReport> {
  return request<StyleReport>({
    url: '/api/style-report',
    method: 'POST',
    data: { profile },
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
