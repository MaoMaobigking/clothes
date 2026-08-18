/*
 * 穿搭日记（规格 §11.1）。
 *
 * date 全程当**字符串**用，别在这一层 new Date() 转来转去。
 * 后端已经用 DATE_FORMAT(wear_date,'%Y-%m-%d') 把 DATE 列拍成字符串了 ——
 * 就是为了绕开「mysql2 转 JS Date → JSON 按 UTC 序列化 → 东八区整体错一天」这个坑。
 * 前端再 new Date('2026-08-18') 会按 UTC 零点解析，getDate() 在东八区仍然是 18，
 * 但换个负时区就变 17 号了。所以：字符串进、字符串出，只在拼日历格子时做数字运算。
 */
import { request } from './http'

export interface DiaryEntry {
  id: number
  /** 'YYYY-MM-DD'，主键语义（一人一天一条） */
  date: string
  outfitId: number | null
  /** 后端 LEFT JOIN outfits 带出来的，搭配被删了就是空串 */
  outfitTitle: string
  outfitScene: string
  note: string
  weather: string
  mood: string
  createdAt: string
  updatedAt: string
}

/**
 * PATCH 语义：只传要改的字段，没传的沿用当天旧值。
 * 想清空某一项就显式传空串（outfitId 传 null）。
 * 四项全空会被后端以 DIARY_EMPTY 拒掉 —— 不许存一条什么都没有的记录。
 */
export interface DiaryPayload {
  outfitId?: number | null
  note?: string
  weather?: string
  mood?: string
}

/** 后端字段齐全，这里只兜 null/undefined，免得模板里拿 undefined 当真值 */
function normalizeDiary(entry: DiaryEntry): DiaryEntry {
  return {
    ...entry,
    outfitId: entry.outfitId ?? null,
    outfitTitle: entry.outfitTitle || '',
    outfitScene: entry.outfitScene || '',
    note: entry.note || '',
    weather: entry.weather || '',
    mood: entry.mood || '',
  }
}

/**
 * 列表。
 * @param month 'YYYY-MM'；不传则回最近 30 条（跨月，用于「最近穿搭」这类入口）
 */
export async function apiListDiary(month?: string): Promise<DiaryEntry[]> {
  const d = await request<{ diaries: DiaryEntry[] }>({
    url: month ? `/api/diary?month=${month}` : '/api/diary',
  })
  return (d.diaries || []).map(normalizeDiary)
}

/** 单日。当天没记录返回 null（不是 404），调用方不用 try/catch 区分 */
export async function apiGetDiary(date: string): Promise<DiaryEntry | null> {
  const d = await request<{ diary: DiaryEntry | null }>({ url: `/api/diary/${date}` })
  return d.diary ? normalizeDiary(d.diary) : null
}

/** 写入 = upsert，同一天反复调不会撞唯一键 */
export async function apiSaveDiary(date: string, payload: DiaryPayload): Promise<DiaryEntry> {
  const d = await request<{ diary: DiaryEntry }>({
    url: `/api/diary/${date}`,
    method: 'PUT',
    data: payload,
  })
  return normalizeDiary(d.diary)
}

/** 删除。当天本来就没记录时回 false，不算错 */
export async function apiDeleteDiary(date: string): Promise<boolean> {
  const d = await request<{ ok: boolean }>({
    url: `/api/diary/${date}`,
    method: 'DELETE',
  })
  return Boolean(d.ok)
}
