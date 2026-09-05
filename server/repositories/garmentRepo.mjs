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
function parseJsonList(value, fallback = []) {
  if (value === null || value === undefined) return fallback
  if (Array.isArray(value)) return value.map(String)
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : fallback
  } catch {
    return fallback
  }
}

export function rowToGarment(row) {
  if (!row) return null
  const legacySeason = row.season || ''
  const seasons = parseJsonList(row.seasons, legacySeason ? [legacySeason] : [])
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    brand: row.brand,
    emoji: row.emoji,
    from: row.from,
    to: row.to,
    price: Number(row.price) || 0,
    season: legacySeason,
    img: row.image_url,
    fav: Boolean(row.fav),
    primaryColor: row.primary_color || '',
    secondaryColors: parseJsonList(row.secondary_colors),
    seasons,
    occasions: parseJsonList(row.occasions),
    frequentlyWorn: Boolean(row.frequently_worn),
    sortOrder: Number(row.sort_order ?? 0),
    recognitionStatus: row.recognition_status || 'confirmed',
    recognitionSource: row.recognition_source || 'manual',
    uploadedAt: row.uploaded_at || null,
  }
}

// from / to 是 MySQL 保留字，必须反引号
const SELECT_COLS = `
  id, name, category, brand, emoji, \`from\`, \`to\`, price, season,
  image_url, fav, primary_color, secondary_colors, seasons, occasions,
  frequently_worn, sort_order, recognition_status, recognition_source, uploaded_at
`

/** 某用户的全部衣物 */
export async function listGarments(userId) {
  const rows = await getAll(
    `SELECT ${SELECT_COLS}
       FROM garments
      WHERE user_id = ?
      ORDER BY sort_order ASC, uploaded_at DESC, created_at DESC`,
    [userId],
  )
  return rows.map(rowToGarment)
}

/** 单件衣物；不属于该用户时返回 null（上层据此返 404，不返 403） */
export async function findGarment(userId, id) {
  const row = await getOne(`SELECT ${SELECT_COLS} FROM garments WHERE id = ? AND user_id = ?`, [id, userId])
  return rowToGarment(row)
}

export async function listGarmentsByIds(userId, ids) {
  if (!ids.length) return []
  const placeholders = ids.map(() => '?').join(', ')
  const rows = await getAll(
    `SELECT ${SELECT_COLS}
       FROM garments
      WHERE user_id = ? AND id IN (${placeholders})`,
    [userId, ...ids],
  )
  return rows.map(rowToGarment)
}

/**
 * 新增衣物。userId 由调用方从 JWT 传入，绝不从请求体读
 * （从 body 读 user_id 等于让客户端自己声明身份，是典型越权口子）。
 */
export async function addGarment(userId, partial = {}) {
  const seasons = parseJsonList(partial.seasons, partial.season ? [partial.season] : [])
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
    primaryColor: partial.primaryColor || '',
    secondaryColors: parseJsonList(partial.secondaryColors),
    seasons,
    occasions: parseJsonList(partial.occasions),
    frequentlyWorn: partial.frequentlyWorn ? 1 : 0,
    sortOrder: Number(partial.sortOrder ?? partial.sort_order ?? 0),
    recognitionStatus: partial.recognitionStatus || 'confirmed',
    recognitionSource: partial.recognitionSource || 'manual',
    uploadedAt: partial.uploadedAt || null,
  }
  await execute(
    `INSERT INTO garments
       (id, user_id, name, category, brand, emoji, \`from\`, \`to\`, price,
        season, image_url, fav, primary_color, secondary_colors, seasons,
        occasions, frequently_worn, sort_order, recognition_status,
        recognition_source, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      g.id,
      userId,
      g.name,
      g.category,
      g.brand,
      g.emoji,
      g.from,
      g.to,
      g.price,
      g.season,
      g.img,
      g.fav,
      g.primaryColor,
      JSON.stringify(g.secondaryColors),
      JSON.stringify(g.seasons),
      JSON.stringify(g.occasions),
      g.frequentlyWorn,
      g.sortOrder,
      g.recognitionStatus,
      g.recognitionSource,
      g.uploadedAt,
    ],
  )
  return {
    ...g,
    fav: Boolean(g.fav),
    secondaryColors: g.secondaryColors,
    seasons: g.seasons,
    occasions: g.occasions,
  }
}

/** 删除。返回 false 表示「不存在 或 不是你的」，上层统一返 404 */
export async function deleteGarment(userId, id) {
  await execute('DELETE FROM outfit_items WHERE garment_id = ?', [id])
  // cart_items.item_id 是多态列（garment/accessory/catalog 共用），没有外键级联，
  // 必须显式清，否则衣物删了购物车里还留一行查不到明细的孤儿。
  await execute("DELETE FROM cart_items WHERE item_type = 'garment' AND item_id = ? AND user_id = ?", [id, userId])
  const result = await execute('DELETE FROM garments WHERE id = ? AND user_id = ?', [id, userId])
  return result.affectedRows > 0
}

/**
 * 切换收藏。用 `fav = 1 - fav` 在一条 UPDATE 里原子翻转，
 * 不做「先 SELECT 再 UPDATE」——两次请求并发时读到同一个旧值会互相覆盖。
 * @returns {boolean|null} 新的收藏状态；null 表示没这件（或不是你的）
 */
export async function toggleFav(userId, id) {
  const result = await execute('UPDATE garments SET fav = 1 - fav WHERE id = ? AND user_id = ?', [id, userId])
  if (result.affectedRows === 0) return null
  const row = await getOne('SELECT fav FROM garments WHERE id = ? AND user_id = ?', [id, userId])
  return Boolean(row?.fav)
}

/** 计数（新用户是否需要初始化衣橱靠它判断） */
export async function updateGarment(userId, id, partial = {}) {
  const existing = await findGarment(userId, id)
  if (!existing) return null
  const seasons = parseJsonList(partial.seasons, partial.season ? [partial.season] : existing.seasons)
  const next = {
    name: typeof partial.name === 'string' ? partial.name : existing.name,
    category: typeof partial.category === 'string' ? partial.category : existing.category,
    emoji: typeof partial.emoji === 'string' ? partial.emoji : existing.emoji,
    season: typeof partial.season === 'string' ? partial.season : existing.season,
    primaryColor: typeof partial.primaryColor === 'string' ? partial.primaryColor : existing.primaryColor,
    secondaryColors: parseJsonList(partial.secondaryColors, existing.secondaryColors),
    seasons,
    occasions: parseJsonList(partial.occasions, existing.occasions),
    frequentlyWorn:
      partial.frequentlyWorn === undefined ? Boolean(existing.frequentlyWorn) : Boolean(partial.frequentlyWorn),
    sortOrder: partial.sortOrder === undefined ? existing.sortOrder : Number(partial.sortOrder) || 0,
    recognitionStatus:
      typeof partial.recognitionStatus === 'string' ? partial.recognitionStatus : existing.recognitionStatus,
    recognitionSource:
      typeof partial.recognitionSource === 'string' ? partial.recognitionSource : existing.recognitionSource,
  }
  await execute(
    `UPDATE garments
        SET name = ?, category = ?, emoji = ?, season = ?, primary_color = ?,
            secondary_colors = ?, seasons = ?, occasions = ?, frequently_worn = ?,
            sort_order = ?, recognition_status = ?, recognition_source = ?
      WHERE id = ? AND user_id = ?`,
    [
      next.name,
      next.category,
      next.emoji,
      next.season,
      next.primaryColor,
      JSON.stringify(next.secondaryColors),
      JSON.stringify(next.seasons),
      JSON.stringify(next.occasions),
      next.frequentlyWorn ? 1 : 0,
      next.sortOrder,
      next.recognitionStatus,
      next.recognitionSource,
      id,
      userId,
    ],
  )
  return findGarment(userId, id)
}

/**
 * 只改图片地址。
 *
 * 不能借 updateGarment 办这件事：它整行覆盖那十几个字段，且压根不含 image_url。
 * 云开发模式下衣物先按 /uploads/ 落库，拿到云存储 fileID 再回来改写成 cloud://。
 */
export async function updateGarmentImage(userId, id, img) {
  await execute('UPDATE garments SET image_url = ? WHERE id = ? AND user_id = ?', [img, id, userId])
  return findGarment(userId, id)
}

export async function reorderGarments(userId, ids) {
  await withTransaction(async (conn) => {
    for (let index = 0; index < ids.length; index += 1) {
      const [result] = await conn.execute('UPDATE garments SET sort_order = ? WHERE id = ? AND user_id = ?', [
        index + 1,
        ids[index],
        userId,
      ])
      if (result.affectedRows === 0) {
        const err = new Error('GARMENT_NOT_FOUND')
        err.status = 404
        err.code = 'GARMENT_NOT_FOUND'
        throw err
      }
    }
  })
  return listGarments(userId)
}

export async function toggleFrequentlyWorn(userId, id) {
  const result = await execute(
    'UPDATE garments SET frequently_worn = 1 - frequently_worn WHERE id = ? AND user_id = ?',
    [id, userId],
  )
  if (result.affectedRows === 0) return null
  return findGarment(userId, id)
}

export async function countGarments(userId) {
  const row = await getOne('SELECT COUNT(*) AS n FROM garments WHERE user_id = ?', [userId])
  return Number(row?.n || 0)
}

/**
 * 给新用户灌一份种子衣橱（每人一份独立副本，id 前缀区分）。
 * 用事务 + 批量 VALUES：18 条一次进库，中途失败整体回滚，不留半个衣橱。
 * 注意这里用 conn.query 而不是 conn.execute —— 预处理语句无法展开 `VALUES ?` 数组。
 */
export async function seedGarmentsForUser(userId) {
  const seed = JSON.parse(readFileSync(join(here, '..', 'seed.json'), 'utf-8'))
  const rows = seed.map((g, index) => [
    `u${userId}_${g.id}`,
    userId,
    g.name,
    g.category,
    g.brand || '',
    g.emoji || '👕',
    g.from || '#ffd1e8',
    g.to || '#c9b8ff',
    Number(g.price) || 0,
    g.season || '四季',
    g.img || null,
    g.fav ? 1 : 0,
    g.primaryColor || '',
    JSON.stringify(g.secondaryColors || []),
    JSON.stringify(g.seasons || (g.season ? [g.season] : [])),
    JSON.stringify(g.occasions || []),
    g.frequentlyWorn ? 1 : 0,
    index + 1,
    'confirmed',
    'manual',
    null,
  ])
  if (!rows.length) return 0
  await withTransaction(async (conn) => {
    await conn.query(
      `INSERT INTO garments
         (id, user_id, name, category, brand, emoji, \`from\`, \`to\`, price,
          season, image_url, fav, primary_color, secondary_colors, seasons,
          occasions, frequently_worn, sort_order, recognition_status,
          recognition_source, uploaded_at)
       VALUES ?`,
      [rows],
    )
  })
  return rows.length
}
