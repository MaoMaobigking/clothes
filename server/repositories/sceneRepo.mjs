/**
 * 场景模拟仓库层
 *
 * 场景目录是全局人工维护数据；场景方案、购物车都按 user_id 隔离。
 * 所有用户级查询都必须在 SQL 里带 user_id，和衣橱、画像使用同一规则。
 */
import { execute, getAll, getOne, withTransaction } from '../db/mysql.mjs'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function mapCatalog(row) {
  if (!row) return null
  return {
    id: row.id,
    sceneKey: row.scene_key,
    category: row.category,
    name: row.name,
    price: Number(row.price),
    imageUrl: row.image_url,
    taobaoUrl: row.taobao_url,
    taokouling: row.taokouling,
    season: row.season,
    keywords: parseJson(row.keywords, []),
    from: row.from,
    to: row.to,
    emoji: row.emoji,
  }
}

function mapSceneOutfit(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    sceneKey: row.scene_key,
    title: row.title,
    season: row.season,
    mode: row.mode,
    filterKey: row.filter_key,
    weather: parseJson(row.weather, {}),
    composition: parseJson(row.composition, []),
    createdAt: row.created_at,
  }
}

/** 初始化人工维护的场景商城目录。 */
export async function ensureSceneCatalog() {
  const items = JSON.parse(readFileSync(join(here, '..', 'scene-catalog.json'), 'utf-8'))
  if (!items.length) return 0

  await withTransaction(async (conn) => {
    const rows = items.map((item) => [
      item.id,
      item.sceneKey,
      item.category,
      item.name,
      item.price,
      item.imageUrl,
      item.taobaoUrl,
      item.taokouling,
      item.season,
      JSON.stringify(item.keywords || []),
      item.from || '#ffd1e8',
      item.to || '#c9b8ff',
      item.emoji || '👗',
    ])

    // 人工目录是演示数据，重复启动时覆盖字段，保证目录和代码同源。
    await conn.query(
      `INSERT INTO scene_catalog
        (id, scene_key, category, name, price, image_url, taobao_url, taokouling,
         season, keywords, \`from\`, \`to\`, emoji)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         scene_key = VALUES(scene_key),
         category = VALUES(category),
         name = VALUES(name),
         price = VALUES(price),
         image_url = VALUES(image_url),
         taobao_url = VALUES(taobao_url),
         taokouling = VALUES(taokouling),
         season = VALUES(season),
         keywords = VALUES(keywords),
         \`from\` = VALUES(\`from\`),
         \`to\` = VALUES(\`to\`),
         emoji = VALUES(emoji)`,
      [rows],
    )
  })

  return items.length
}

export async function listCatalog(sceneKey) {
  const params = sceneKey ? [sceneKey] : []
  const where = sceneKey ? 'WHERE scene_key = ?' : ''
  const rows = await getAll(
    `SELECT id, scene_key, category, name, price, image_url, taobao_url,
            taokouling, season, keywords, \`from\`, \`to\`, emoji
       FROM scene_catalog
       ${where}
      ORDER BY scene_key, category, id`,
    params,
  )
  return rows.map(mapCatalog)
}

export async function findCatalogByIds(ids) {
  if (!ids.length) return []
  const placeholders = ids.map(() => '?').join(', ')
  const rows = await getAll(
    `SELECT id, scene_key, category, name, price, image_url, taobao_url,
            taokouling, season, keywords, \`from\`, \`to\`, emoji
       FROM scene_catalog
      WHERE id IN (${placeholders})
      ORDER BY id`,
    ids,
  )
  return rows.map(mapCatalog)
}

export async function saveSceneOutfit(userId, snapshot) {
  const result = await execute(
    `INSERT INTO scene_outfits
      (user_id, scene_key, title, season, mode, filter_key, weather, composition)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      snapshot.sceneKey,
      snapshot.title,
      snapshot.season,
      snapshot.mode,
      snapshot.filterKey,
      JSON.stringify(snapshot.weather || {}),
      JSON.stringify(snapshot.composition || []),
    ],
  )
  return findSceneOutfit(userId, result.insertId)
}

export async function listSceneOutfits(userId) {
  const rows = await getAll(
    `SELECT id, user_id, scene_key, title, season, mode, filter_key, weather,
            composition, created_at
       FROM scene_outfits
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 50`,
    [userId],
  )
  return rows.map(mapSceneOutfit)
}

export async function findSceneOutfit(userId, id) {
  const row = await getOne(
    `SELECT id, user_id, scene_key, title, season, mode, filter_key, weather,
            composition, created_at
       FROM scene_outfits
      WHERE id = ? AND user_id = ?`,
    [id, userId],
  )
  return mapSceneOutfit(row)
}

/**
 * 场景购物车读写 —— 已移除，统一到 cart_items 单一数据域（规格 §4.5 §13）。
 *
 * 写：services/cartService.mjs 的 addCatalogItems()，item_type='catalog'。
 * 读：services/cartService.mjs 的 listCart()。
 *
 * 原实现以 item_type='garment' 写 scene_catalog 的 id，而功能三按 garment
 * 去 garments 查明细查不到，那些行会被 .filter(Boolean) 静默丢掉 ——
 * 用户加购成功但购物车里看不到。db/mysql.mjs 的 migrateCart() 负责把
 * 存量脏数据改判成 'catalog'。别把这个写法加回来。
 */
