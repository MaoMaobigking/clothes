/**
 * 穿搭日记服务（规格 §11.1「按日期记录 + 回看」）
 *
 * 这一层负责三件事：日期校验、outfit 归属校验、字段合并。
 * 仓库层只管读写，不做判断。
 */
import * as diaryRepo from '../repositories/diaryRepo.mjs'
import { getOutfit } from '../repositories/outfitRepo.mjs'

const NOTE_MAX = 255

function serviceError(message, status = 400, code = 'DIARY_ERROR') {
  const err = new Error(message)
  err.status = status
  err.code = code
  return err
}

/**
 * 日期只认 'YYYY-MM-DD'，而且必须是真实存在的一天。
 *
 * 光用正则不够：'2026-02-31' 能过正则，塞进 MySQL 的 DATE 列会被静默转成
 * '0000-00-00' 或直接报错，取决于 sql_mode —— 两种都不是好结果。
 * 这里用 Date 反解一次，回写出来的字符串和输入一致才算数。
 */
function normalizeDate(raw) {
  const value = String(raw ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw serviceError('日期格式应为 YYYY-MM-DD', 400, 'DIARY_DATE_INVALID')
  }
  // 用 UTC 构造，避免本地时区把日期推前/推后一天
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw serviceError('日期不存在', 400, 'DIARY_DATE_INVALID')
  }
  return value
}

/** 'YYYY-MM' → ['YYYY-MM-01', 下个月的 'YYYY-MM-01']，给仓库层做半开区间查询 */
function monthRange(raw) {
  const value = String(raw ?? '').trim()
  if (!/^\d{4}-\d{2}$/.test(value)) {
    throw serviceError('月份格式应为 YYYY-MM', 400, 'DIARY_MONTH_INVALID')
  }
  const [year, month] = value.split('-').map(Number)
  if (month < 1 || month > 12) {
    throw serviceError('月份不存在', 400, 'DIARY_MONTH_INVALID')
  }
  const start = `${value}-01`
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const next = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  return [start, next]
}

function normalizeNote(raw) {
  const value = String(raw ?? '').trim()
  if (value.length > NOTE_MAX) {
    throw serviceError(`心得最多 ${NOTE_MAX} 个字`, 400, 'DIARY_NOTE_TOO_LONG')
  }
  return value
}

/** 不传 month 就回最近 30 条；传了就只回那个月 */
export async function listDiary(userId, { month } = {}) {
  if (month) {
    const [start, next] = monthRange(month)
    return diaryRepo.listByMonth(userId, start, next)
  }
  return diaryRepo.listRecent(userId, 30)
}

export async function getDiaryByDate(userId, date) {
  return diaryRepo.findByDate(userId, normalizeDate(date))
}

/**
 * 记录 / 覆盖某一天。
 *
 * outfitId 必须先过 getOutfit(userId, ...) —— 它自带 `WHERE user_id = ?`，
 * 所以这一步同时挡住了「引用别人的搭配」。只靠外键是挡不住的：
 * outfit_id 的外键只要求这条搭配存在，不要求它属于你。
 *
 * 未传的字段沿用当天已有的值（PATCH 语义），而不是被清空 ——
 * 前端只想改一句心得时不该被迫把搭配重新选一遍。
 */
export async function saveDiary(userId, date, payload = {}) {
  const day = normalizeDate(date)
  const existing = await diaryRepo.findByDate(userId, day)

  let outfitId = existing?.outfitId ?? null
  if (payload.outfitId !== undefined) {
    if (payload.outfitId === null || payload.outfitId === '') {
      outfitId = null
    } else {
      const id = Number(payload.outfitId)
      if (!Number.isInteger(id) || id <= 0) {
        throw serviceError('搭配 ID 不合法', 400, 'DIARY_OUTFIT_INVALID')
      }
      const outfit = await getOutfit(userId, id)
      if (!outfit) throw serviceError('搭配不存在', 404, 'DIARY_OUTFIT_NOT_FOUND')
      outfitId = id
    }
  }

  const note = payload.note !== undefined ? normalizeNote(payload.note) : (existing?.note ?? '')
  const weather =
    payload.weather !== undefined
      ? String(payload.weather ?? '')
          .trim()
          .slice(0, 32)
      : (existing?.weather ?? '')
  const mood =
    payload.mood !== undefined
      ? String(payload.mood ?? '')
          .trim()
          .slice(0, 32)
      : (existing?.mood ?? '')

  // 三样都空、也没选搭配 —— 存下去就是一条空记录，日历上点亮一个什么都没有的日子
  if (!outfitId && !note && !weather && !mood) {
    throw serviceError('至少填写搭配、心得或天气其中一项', 400, 'DIARY_EMPTY')
  }

  return diaryRepo.upsert(userId, day, { outfitId, note, weather, mood })
}

export async function deleteDiary(userId, date) {
  return diaryRepo.removeByDate(userId, normalizeDate(date))
}
