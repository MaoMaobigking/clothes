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
  const items = JSON.parse(readFileSync(join(here, '..', 'seeds', 'scene-catalog.json'), 'utf-8'))
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

    /*
     * 再删掉 seed 里已经没有的行 —— 上面那句 upsert 只覆盖同 id 的行，
     * 光有它「目录和代码同源」是做不到的：seed 里删掉或改名一件商品，
     * 表里的老行会原地留下来。
     *
     * 场景表从六个抽象场景换成十个具体地点那次就踩了：商品 id 从
     * sc-daily-1 变成 sc-cafe-1，新行插进去、老行还在，商城直接变成
     * 60 件，其中 30 件的 image_url 指向已经改名的文件（一片裂图）。
     *
     * cart_items.item_id 是软引用（没有外键），删了不会报错；购物车里
     * 指向已删商品的历史行由 cartService 标成 available=false，本来就有降级。
     *
     * ⚠️ 这句必须用 conn.query，不能换成 conn.execute。mysql2 的 query 会把
     * 数组参数展开成 IN ('a','b',...)，而 execute 走 prepared statement，
     * 会把整个数组当成一个字符串值 —— 那样 NOT IN 对谁都成立，一句下去
     * 整张表就空了。同理别用 db.mjs 里的 execute/getAll（它们都是 pool.execute）。
     */
    const [deleted] = await conn.query(`DELETE FROM scene_catalog WHERE id NOT IN (?)`, [items.map((item) => item.id)])
    if (deleted.affectedRows) {
      console.log(`[scene_catalog] 清掉 ${deleted.affectedRows} 行 seed 里已不存在的商品`)
    }
  })

  return items.length
}

const CATALOG_COLUMNS = `id, scene_key, category, name, price, image_url, taobao_url,
            taokouling, season, keywords, \`from\`, \`to\`, emoji`

export async function listCatalog(sceneKey) {
  const params = sceneKey ? [sceneKey] : []
  const where = sceneKey ? 'WHERE scene_key = ?' : ''
  const rows = await getAll(
    `SELECT ${CATALOG_COLUMNS}
       FROM scene_catalog
       ${where}
      ORDER BY scene_key, category, id`,
    params,
  )
  return rows.map(mapCatalog)
}

/**
 * 商城列表用的目录查询（规格 §4.4 §10.6）。
 *
 * 和 listCatalog() 的区别只有排序维度：商城按品类逛，场景按场景选品。
 * 商城不另起商品表，就是这张目录换个入口，价格与淘口令只有一份来源。
 */
export async function listCatalogProducts({ category, sceneKey } = {}) {
  const where = []
  const params = []
  if (category) {
    where.push('category = ?')
    params.push(category)
  }
  if (sceneKey) {
    where.push('scene_key = ?')
    params.push(sceneKey)
  }
  const rows = await getAll(
    `SELECT ${CATALOG_COLUMNS}
       FROM scene_catalog
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY category, price, id`,
    params,
  )
  return rows.map(mapCatalog)
}

/** 商城分类面板：品类 + 件数，避免前端为了算数量把整表拉一遍 */
export async function listCatalogCategories() {
  const rows = await getAll(
    `SELECT category, COUNT(*) AS total
       FROM scene_catalog
      GROUP BY category
      ORDER BY category`,
  )
  return rows.map((row) => ({ key: row.category, total: Number(row.total) }))
}

export async function findCatalogById(id) {
  const [item] = await findCatalogByIds([String(id || '')].filter(Boolean))
  return item || null
}

export async function findCatalogByIds(ids) {
  if (!ids.length) return []
  const placeholders = ids.map(() => '?').join(', ')
  const rows = await getAll(
    `SELECT ${CATALOG_COLUMNS}
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
 * 写：services/commerce/cart.mjs 的 addCatalogItems()，item_type='catalog'。
 * 读：services/commerce/cart.mjs 的 listCart()。
 *
 * 原实现以 item_type='garment' 写 scene_catalog 的 id，而功能三按 garment
 * 去 garments 查明细查不到，那些行会被 .filter(Boolean) 静默丢掉 ——
 * 用户加购成功但购物车里看不到。db/mysql.mjs 的 migrateCart() 负责把
 * 存量脏数据改判成 'catalog'。别把这个写法加回来。
 */
