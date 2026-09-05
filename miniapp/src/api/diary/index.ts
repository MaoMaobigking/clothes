/*
 * 穿搭日记（规格 §11.1）。
 *
 * 日期语义与「为什么全程用字符串」见 ./type.ts 的头部说明。
 */
import { request } from '@/utils/request'
import type { DiaryEntry, DiaryPayload } from './type'

enum API {
  /** 列表；可带 ?month=YYYY-MM 查某月 */
  DIARY_URL = '/api/diary',
  /** 单日读 / 写 / 删，后面直接接 YYYY-MM-DD */
  DIARY_BY_DATE_URL = '/api/diary/',
}

/*
 * 类型从 ./type 再导出一次。
 * 参考项目里消费方是直接 import from '@/api/xxx/type' 的，本仓库不同：
 * 23 个页面用的是 `import { apiListDiary, type DiaryEntry } from '@/api/diary'`
 * 这种值+类型混合写法，再导出可以让它们一个字都不用改。
 */
export type { DiaryEntry, DiaryPayload } from './type'

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
    url: month ? `${API.DIARY_URL}?month=${month}` : API.DIARY_URL,
  })
  return (d.diaries || []).map(normalizeDiary)
}

/** 单日。当天没记录返回 null（不是 404），调用方不用 try/catch 区分 */
export async function apiGetDiary(date: string): Promise<DiaryEntry | null> {
  const d = await request<{ diary: DiaryEntry | null }>({ url: API.DIARY_BY_DATE_URL + date })
  return d.diary ? normalizeDiary(d.diary) : null
}

/** 写入 = upsert，同一天反复调不会撞唯一键 */
export async function apiSaveDiary(date: string, payload: DiaryPayload): Promise<DiaryEntry> {
  const d = await request<{ diary: DiaryEntry }>({
    url: API.DIARY_BY_DATE_URL + date,
    method: 'PUT',
    data: payload,
  })
  return normalizeDiary(d.diary)
}

/** 删除。当天本来就没记录时回 false，不算错 */
export async function apiDeleteDiary(date: string): Promise<boolean> {
  const d = await request<{ ok: boolean }>({
    url: API.DIARY_BY_DATE_URL + date,
    method: 'DELETE',
  })
  return Boolean(d.ok)
}
