/* 调后端 AI 接口（统一经过 utils/request 建立身份） */
import { request } from '@/utils/request'
import type { ChatMessage, ProfilePayload, SceneOutfit, StyleReport } from './type'

enum API {
  /** 风格报告 */
  STYLE_REPORT_URL = '/api/style-report',
  /** 情景搭配推荐 */
  SCENE_OUTFITS_URL = '/api/scene-outfits',
  /** AI 穿搭顾问对话 */
  CHAT_URL = '/api/chat',
}

/** 类型再导出的理由见 api/diary/index.ts 的说明 */
export type {
  AiRadarDim,
  AiRecommendation,
  ChatMessage,
  OutfitPieceAi,
  ProfilePayload,
  SceneOutfit,
  StyleReport,
} from './type'

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

export async function sendChat(messages: ChatMessage[]): Promise<string> {
  const data = await request<{ reply?: string }>({
    url: API.CHAT_URL,
    method: 'POST',
    data: { messages },
  })
  return data.reply ?? ''
}
