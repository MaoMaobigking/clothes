/**
 * 购物车仓库层（规格 §4.5 §13）
 *
 * 全项目只有这一张购物车表 cart_items，三种 item_type 指向三个目录：
 *   garment   → garments      按 user_id 隔离
 *   accessory → accessories   全局目录
 *   catalog   → scene_catalog 全局目录
 *
 * 这一层只管读写，不判断商品是否存在、是否越权 —— 那是 cartService 的事。
 * 唯一键是 (user_id, item_type, item_id)，所以同一件商品永远只有一行，
 * 重复加购走 ON DUPLICATE KEY 累加数量。
 */
import { execute, getAll, getOne, withTransaction } from '../db/mysql.mjs'

const MAX_QUANTITY = 99

const SELECT_COLS = `
  id, user_id, item_type, item_id, quantity, source_outfit_id, created_at, updated_at
`

const UPSERT_SQL = `
  INSERT INTO cart_items
    (user_id, item_type, item_id, quantity, source_outfit_id)
  VALUES (?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    quantity = LEAST(${MAX_QUANTITY}, quantity + VALUES(quantity)),
    source_outfit_id = COALESCE(VALUES(source_outfit_id), source_outfit_id)
`

export async function listCartRows(userId) {
  return getAll(
    `SELECT ${SELECT_COLS}
       FROM cart_items
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC`,
    [userId],
  )
}

export async function findCartRow(userId, id) {
  return getOne(`SELECT ${SELECT_COLS} FROM cart_items WHERE id = ? AND user_id = ?`, [id, userId])
}

export async function addCartItem(userId, item) {
  await execute(UPSERT_SQL, [userId, item.itemType, item.itemId, item.quantity, item.sourceOutfitId || null])
}

export async function batchAddCartItems(userId, items) {
  if (!items.length) return
  await withTransaction(async (conn) => {
    for (const item of items) {
      await conn.execute(UPSERT_SQL, [userId, item.itemType, item.itemId, item.quantity, item.sourceOutfitId || null])
    }
  })
}

export async function removeCartItem(userId, id) {
  const result = await execute('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [id, userId])
  return result.affectedRows > 0
}

/**
 * 直接设数量（不是累加）。返回是否命中，明细由 service 重新组装。
 *
 * 注意不能用 affectedRows 判断命中：MySQL 在「新值和旧值相同」时
 * affectedRows 是 0，会被误判成「条目不存在」返回 404。这里改用
 * changedRows 之外的办法 —— 先查存在性再更新。
 */
export async function setCartQuantity(userId, id, quantity) {
  const value = Math.min(MAX_QUANTITY, Math.max(1, Number(quantity) || 1))
  const existing = await findCartRow(userId, id)
  if (!existing) return null
  await execute('UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?', [value, id, userId])
  return findCartRow(userId, id)
}

/** 功能三搭配优惠用：这批衣物里有多少件已在购物车 */
export async function countCartGarments(userId, garmentIds) {
  if (!garmentIds.length) return 0
  const placeholders = garmentIds.map(() => '?').join(', ')
  const row = await getOne(
    `SELECT COUNT(DISTINCT item_id) AS n
       FROM cart_items
      WHERE user_id = ?
        AND item_type = 'garment'
        AND item_id IN (${placeholders})`,
    [userId, ...garmentIds],
  )
  return Number(row?.n || 0)
}

/** 整套搭配拆成单品：取出该搭配下属于当前用户的衣物 id（规格 §4.5 §8.9） */
export async function listOutfitGarmentIds(userId, outfitId) {
  const outfit = await getOne('SELECT id FROM outfits WHERE id = ? AND user_id = ?', [outfitId, userId])
  if (!outfit) return null
  const rows = await getAll(
    `SELECT oi.garment_id
       FROM outfit_items oi
       JOIN garments g ON g.id = oi.garment_id
      WHERE oi.outfit_id = ? AND g.user_id = ?
      ORDER BY oi.sort_order ASC`,
    [outfitId, userId],
  )
  return rows.map((row) => row.garment_id)
}

export { MAX_QUANTITY }
