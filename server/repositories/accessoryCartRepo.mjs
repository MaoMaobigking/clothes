import { execute, getAll, getOne, withTransaction } from '../db/mysql.mjs'

export async function listCartRows(userId) {
  return getAll(
    `SELECT id, user_id, item_type, item_id, quantity, source_outfit_id, created_at
       FROM cart_items
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC`,
    [userId],
  )
}

export async function addCartItem(userId, item) {
  await execute(
    `INSERT INTO cart_items
      (user_id, item_type, item_id, quantity, source_outfit_id)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       quantity = LEAST(99, quantity + VALUES(quantity)),
       source_outfit_id = COALESCE(VALUES(source_outfit_id), source_outfit_id)`,
    [
      userId,
      item.itemType,
      item.itemId,
      item.quantity,
      item.sourceOutfitId || null,
    ],
  )
}

export async function batchAddCartItems(userId, items) {
  await withTransaction(async (conn) => {
    for (const item of items) {
      await conn.execute(
        `INSERT INTO cart_items
          (user_id, item_type, item_id, quantity, source_outfit_id)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           quantity = LEAST(99, quantity + VALUES(quantity)),
           source_outfit_id = COALESCE(VALUES(source_outfit_id), source_outfit_id)`,
        [
          userId,
          item.itemType,
          item.itemId,
          item.quantity,
          item.sourceOutfitId || null,
        ],
      )
    }
  })
}

export async function removeCartItem(userId, id) {
  const result = await execute(
    'DELETE FROM cart_items WHERE id = ? AND user_id = ?',
    [id, userId],
  )
  return result.affectedRows > 0
}

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
