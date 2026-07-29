/**
 * 衣橱仓库层（Repository）
 *
 * 分层职责：这一层写业务 SQL，不碰 HTTP，也不做参数校验。
 * 对标 Spring 的 DAO / MyBatis Mapper。
 *
 * 关键设计（面试重点）：所有方法第一个参数都是 userId，且一定进 WHERE。
 *   越权控制放在 SQL 里，而不是「查出来再在 JS 里比对 user_id」——
 *   后者一旦漏写一个 if 就漏数据，前者打不中就是 0 行，天然安全。
 */
import { getAll, getOne, execute, withTransaction } from '../db/mysql.mjs'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

/** 数据库列名 → 前端字段名。前端用 img/fav(boolean)，库里是 image_url/tinyint */
function rowToGarment(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    brand: row.brand,
    emoji: row.emoji,
    from: row.from,
    to: row.to,
    price: row.price,
    season: row.season,
    img: row.image_url,
    fav: Boolean(row.fav),
  }
}

// from / to 是 MySQL 保留字，必须反引号
const SELECT_COLS =
  'id, name, category, brand, emoji, `from`, `to`, price, season, image_url, fav'

/** 某用户的全部衣物 */
export async function listGarments(userId) {
  const rows = await getAll(
    `SELECT ${SELECT_COLS} FROM garments WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
  )
  return rows.map(rowToGarment)
}

/** 单件衣物；不属于该用户时返回 null（上层据此返 404，不返 403） */
export async function findGarment(userId, id) {
  const row = await getOne(
    `SELECT ${SELECT_COLS} FROM garments WHERE id = ? AND user_id = ?`,
    [id, userId],
  )
  return rowToGarment(row)
}

/**
 * 新增衣物。userId 由调用方从 JWT 传入，绝不从请求体读
 * （从 body 读 user_id 等于让客户端自己声明身份，是典型越权口子）。
 */
export async function addGarment(userId, partial = {}) {
  const g = {
    id: partial.id || `u${userId}_${Date.now().toString(36)}`,
    name: partial.name || '未命名单品',
    category: partial.category || '上衣',
    brand: partial.brand || '',
    emoji: partial.emoji || '👕',
    from: partial.from || '#ffd1e8',
    to: partial.to || '#c9b8ff',
    price: Number(partial.price) || 0,
    season: partial.season || '四季',
    img: partial.img || null,
    fav: partial.fav ? 1 : 0,
  }
  await execute(
    `INSERT INTO garments
       (id, user_id, name, category, brand, emoji, \`from\`, \`to\`, price, season, image_url, fav)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [g.id, userId, g.name, g.category, g.brand, g.emoji,
     g.from, g.to, g.price, g.season, g.img, g.fav],
  )
  return { ...g, fav: Boolean(g.fav) }
}

/** 删除。返回 false 表示「不存在 或 不是你的」，上层统一返 404 */
export async function deleteGarment(userId, id) {
  const result = await execute(
    'DELETE FROM garments WHERE id = ? AND user_id = ?',
    [id, userId],
  )
  return result.affectedRows > 0
}

/**
 * 切换收藏。用 `fav = 1 - fav` 在一条 UPDATE 里原子翻转，
 * 不做「先 SELECT 再 UPDATE」——两次请求并发时读到同一个旧值会互相覆盖。
 * @returns {boolean|null} 新的收藏状态；null 表示没这件（或不是你的）
 */
export async function toggleFav(userId, id) {
  const result = await execute(
    'UPDATE garments SET fav = 1 - fav WHERE id = ? AND user_id = ?',
    [id, userId],
  )
  if (result.affectedRows === 0) return null
  const row = await getOne(
    'SELECT fav FROM garments WHERE id = ? AND user_id = ?',
    [id, userId],
  )
  return Boolean(row?.fav)
}

/** 计数（新用户是否需要初始化衣橱靠它判断） */
export async function countGarments(userId) {
  const row = await getOne(
    'SELECT COUNT(*) AS n FROM garments WHERE user_id = ?',
    [userId],
  )
  return Number(row?.n || 0)
}

/**
 * 给新用户灌一份种子衣橱（每人一份独立副本，id 前缀区分）。
 * 用事务 + 批量 VALUES：18 条一次进库，中途失败整体回滚，不留半个衣橱。
 * 注意这里用 conn.query 而不是 conn.execute —— 预处理语句无法展开 `VALUES ?` 数组。
 */
export async function seedGarmentsForUser(userId) {
  const seed = JSON.parse(readFileSync(join(here, '..', 'seed.json'), 'utf-8'))
  const rows = seed.map((g) => [
    `u${userId}_${g.id}`, userId, g.name, g.category, g.brand || '', g.emoji || '👕',
    g.from || '#ffd1e8', g.to || '#c9b8ff', Number(g.price) || 0,
    g.season || '四季', g.img || null, g.fav ? 1 : 0,
  ])
  if (!rows.length) return 0
  await withTransaction(async (conn) => {
    await conn.query(
      `INSERT INTO garments
         (id, user_id, name, category, brand, emoji, \`from\`, \`to\`, price, season, image_url, fav)
       VALUES ?`,
      [rows],
    )
  })
  return rows.length
}
