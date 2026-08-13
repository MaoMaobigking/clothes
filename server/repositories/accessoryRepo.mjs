/**
 * 配饰仓库层
 *
 * accessories 是全局共享目录；accessory_ratings 按 user_id 隔离。
 * 推荐服务从这里取原始数据，不在这里写业务评分规则。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execute, getAll, getOne } from '../db/mysql.mjs'

const here = dirname(fileURLToPath(import.meta.url))

const SELECT_COLS = `
  id, category, name, brand, price, original_price, discount_price,
  image_url, tryon_slot, tryon_enabled, primary_color, secondary_color,
  seasons, occasions, styles, keywords, taobao_url, taokouling,
  favorite_count, base_popularity, created_at
`

function parseJsonArray(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function rowToAccessory(row) {
  if (!row) return null
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    brand: row.brand || '',
    price: Number(row.price),
    originalPrice: row.original_price === null ? null : Number(row.original_price),
    discountPrice: row.discount_price === null ? null : Number(row.discount_price),
    imageUrl: row.image_url || '',
    tryonSlot: row.tryon_slot || '',
    tryonEnabled: Boolean(row.tryon_enabled),
    primaryColor: row.primary_color || '#ffd1e8',
    secondaryColor: row.secondary_color || '#c9b8ff',
    seasons: parseJsonArray(row.seasons),
    occasions: parseJsonArray(row.occasions),
    styles: parseJsonArray(row.styles),
    keywords: parseJsonArray(row.keywords),
    taobaoUrl: row.taobao_url || '',
    taokouling: row.taokouling || '',
    favoriteCount: Number(row.favorite_count || 0),
    basePopularity: Number(row.base_popularity || 3.5),
  }
}

export async function listAccessories() {
  const rows = await getAll(`SELECT ${SELECT_COLS} FROM accessories ORDER BY category, id`)
  return rows.map(rowToAccessory)
}

export async function listAccessoriesByIds(ids) {
  if (!ids.length) return []
  const placeholders = ids.map(() => '?').join(', ')
  const rows = await getAll(
    `SELECT ${SELECT_COLS} FROM accessories WHERE id IN (${placeholders})`,
    ids,
  )
  return rows.map(rowToAccessory)
}

export async function findAccessoryById(id) {
  const row = await getOne(
    `SELECT ${SELECT_COLS} FROM accessories WHERE id = ?`,
    [id],
  )
  return rowToAccessory(row)
}

export async function countAccessories() {
  const row = await getOne('SELECT COUNT(*) AS n FROM accessories')
  return Number(row?.n || 0)
}

export async function seedAccessories() {
  const seed = JSON.parse(readFileSync(join(here, '..', 'seed-accessories.json'), 'utf-8'))
  let inserted = 0
  for (const item of seed) {
    const result = await execute(
      `INSERT IGNORE INTO accessories
        (id, category, name, brand, price, original_price, discount_price,
         image_url, tryon_slot, tryon_enabled, primary_color, secondary_color,
         seasons, occasions, styles, keywords, taobao_url, taokouling,
         favorite_count, base_popularity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.category,
        item.name,
        item.brand || '',
        Number(item.price),
        item.originalPrice === undefined ? null : Number(item.originalPrice),
        item.discountPrice === undefined ? null : Number(item.discountPrice),
        item.imageUrl || null,
        item.tryonSlot || null,
        item.tryonEnabled ? 1 : 0,
        item.primaryColor || null,
        item.secondaryColor || null,
        JSON.stringify(item.seasons || []),
        JSON.stringify(item.occasions || []),
        JSON.stringify(item.styles || []),
        JSON.stringify(item.keywords || []),
        item.taobaoUrl || null,
        item.taokouling || null,
        Number(item.favoriteCount || 0),
        Number(item.basePopularity || 3.5),
      ],
    )
    if (result.affectedRows > 0) inserted += 1
  }
  return inserted
}

export async function getUserRatings(userId) {
  const rows = await getAll(
    'SELECT accessory_id, score FROM accessory_ratings WHERE user_id = ?',
    [userId],
  )
  return new Map(rows.map((row) => [row.accessory_id, Number(row.score)]))
}

export async function upsertRating(userId, accessoryId, score) {
  await execute(
    `INSERT INTO accessory_ratings (user_id, accessory_id, score)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE score = VALUES(score)`,
    [userId, accessoryId, score],
  )
  return getUserRatings(userId)
}

export async function getAggregatedAccessories() {
  const rows = await getAll(
    `SELECT a.id,
            a.category,
            a.name,
            a.brand,
            a.price,
            a.image_url,
            a.tryon_slot,
            a.tryon_enabled,
            a.primary_color,
            a.secondary_color,
            a.favorite_count,
            a.base_popularity,
            COALESCE(AVG(r.score), a.base_popularity) AS aggregate_rating,
            COUNT(r.id) AS rating_count
       FROM accessories a
       LEFT JOIN accessory_ratings r ON r.accessory_id = a.id
      GROUP BY a.id, a.category, a.name, a.brand, a.price, a.image_url,
               a.tryon_slot, a.tryon_enabled, a.primary_color,
               a.secondary_color, a.favorite_count, a.base_popularity`,
  )
  return rows.map((row) => ({
    ...rowToAccessory(row),
    aggregateRating: Number(row.aggregate_rating),
    ratingCount: Number(row.rating_count || 0),
  }))
}
