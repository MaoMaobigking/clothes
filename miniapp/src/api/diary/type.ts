/*
 * 穿搭日记的数据结构（规格 §11.1）。
 *
 * date 全程当**字符串**用，别在这一层 new Date() 转来转去。
 * 后端已经用 DATE_FORMAT(wear_date,'%Y-%m-%d') 把 DATE 列拍成字符串了 ——
 * 就是为了绕开「mysql2 转 JS Date → JSON 按 UTC 序列化 → 东八区整体错一天」这个坑。
 * 前端再 new Date('2026-08-18') 会按 UTC 零点解析，getDate() 在东八区仍然是 18，
 * 但换个负时区就变 17 号了。所以：字符串进、字符串出，只在拼日历格子时做数字运算。
 */

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
