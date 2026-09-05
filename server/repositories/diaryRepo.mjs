/**
 * 穿搭日记仓库层（规格 §11.1）
 *
 * 一天一条：唯一键 uq_diary_user_date (user_id, wear_date)。
 * 保存走 INSERT ... ON DUPLICATE KEY UPDATE，不是「先查再决定 insert 还是 update」——
 * 后者在同一天连点两次保存时会两条都判定为「不存在」，各插一条，然后撞唯一键报错。
 *
 * 日期一律以 'YYYY-MM-DD' 字符串进出，不用 Date 对象：
 * mysql2 会把 DATE 列按服务器时区转成 JS Date，序列化成 JSON 时又按 UTC 输出，
 * 东八区的 2026-08-18 会变成 '2026-08-17T16:00:00.000Z' —— 日记直接错一天。
 * 所以查询里用 DATE_FORMAT 出字符串，写入也只接受字符串。
 */
import { execute, getAll, getOne } from '../db/mysql.mjs'

const DIARY_COLS = `
  d.id,
  DATE_FORMAT(d.wear_date, '%Y-%m-%d') AS wear_date,
  d.outfit_id, d.note, d.weather, d.mood, d.created_at, d.updated_at
`

/** 带上搭配标题，列表页不用为每条日记再查一次 outfits */
const DIARY_SELECT = `
  SELECT ${DIARY_COLS}, o.title AS outfit_title, o.scene AS outfit_scene
    FROM outfit_diary d
    LEFT JOIN outfits o ON o.id = d.outfit_id AND o.user_id = d.user_id
`

function mapRow(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    date: row.wear_date,
    outfitId: row.outfit_id ? Number(row.outfit_id) : null,
    outfitTitle: row.outfit_title || '',
    outfitScene: row.outfit_scene || '',
    note: row.note || '',
    weather: row.weather || '',
    mood: row.mood || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * 某个月的全部记录，日期倒序。
 * 用 wear_date >= 月初 AND < 下月初，而不是 DATE_FORMAT(wear_date,'%Y-%m') = ?
 * —— 后者对列做了函数运算，idx_diary_user_date 用不上，得全表扫。
 */
export async function listByMonth(userId, monthStart, nextMonthStart) {
  const rows = await getAll(
    `${DIARY_SELECT}
      WHERE d.user_id = ? AND d.wear_date >= ? AND d.wear_date < ?
      ORDER BY d.wear_date DESC`,
    [userId, monthStart, nextMonthStart],
  )
  return rows.map(mapRow)
}

/** 最近 N 条，用于「回看」列表的默认视图 */
export async function listRecent(userId, limit = 30) {
  // 直接拼进 SQL 而不是用 ? —— LIMIT 的占位符在预处理语句里各版本行为不一致。
  // 先 clamp 成 1..100 的整数，拼进去就不存在注入面（照抄 aiRepo 的 safeLimit 写法）。
  const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 100))
  const rows = await getAll(
    `${DIARY_SELECT}
      WHERE d.user_id = ?
      ORDER BY d.wear_date DESC
      LIMIT ${safeLimit}`,
    [userId],
  )
  return rows.map(mapRow)
}

export async function findByDate(userId, date) {
  const row = await getOne(`${DIARY_SELECT} WHERE d.user_id = ? AND d.wear_date = ?`, [userId, date])
  return mapRow(row)
}

/**
 * 写入某一天的记录（有则覆盖）。
 * 四个字段整体覆盖而不是只更新传进来的那几个 —— 服务层已经把「保留原值」
 * 的合并逻辑做完了，仓库层再做一次条件拼接，两处规则很快就会对不上。
 */
export async function upsert(userId, date, { outfitId, note, weather, mood }) {
  await execute(
    `INSERT INTO outfit_diary (user_id, wear_date, outfit_id, note, weather, mood)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       outfit_id = VALUES(outfit_id),
       note      = VALUES(note),
       weather   = VALUES(weather),
       mood      = VALUES(mood)`,
    [userId, date, outfitId ?? null, note ?? null, weather ?? null, mood ?? null],
  )
  return findByDate(userId, date)
}

export async function removeByDate(userId, date) {
  const result = await execute('DELETE FROM outfit_diary WHERE user_id = ? AND wear_date = ?', [userId, date])
  return result.affectedRows > 0
}
