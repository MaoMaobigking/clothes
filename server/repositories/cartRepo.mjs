import { execute, getAll, getOne, withTransaction } from '../db/mysql.mjs'
import { rowToGarment } from './garmentRepo.mjs'

function mapCartRow(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    sourceOutfitId: row.source_outfit_id === null ? null : Number(row.source_outfit_id),
    quantity: Number(row.quantity),
    garment: rowToGarment(row),
    createdAt: row.created_at,
  }
}

export async function listCart(userId) {
  const rows = await getAll(
    `SELECT c.id, c.source_outfit_id, c.quantity, c.created_at, g.*
       FROM feature2_cart_items c
       JOIN garments g ON g.id = c.garment_id
      WHERE c.user_id = ? AND g.user_id = ?
      ORDER BY c.created_at DESC, c.id DESC`,
    [userId, userId],
  )
  return rows.map(mapCartRow)
}

export async function addOutfitToCart(userId, outfitId) {
  const outfit = await getOne(
    `SELECT id FROM outfits WHERE id = ? AND user_id = ?`,
    [outfitId, userId],
  )
  if (!outfit) return null
  const rows = await getAll(
    `SELECT oi.garment_id
       FROM outfit_items oi
       JOIN garments g ON g.id = oi.garment_id
      WHERE oi.outfit_id = ? AND g.user_id = ?
      ORDER BY oi.sort_order ASC`,
    [outfitId, userId],
  )
  await withTransaction(async (conn) => {
    for (const row of rows) {
      const [existingRows] = await conn.execute(
        `SELECT id FROM feature2_cart_items
          WHERE user_id = ? AND garment_id = ? AND source_outfit_id = ?`,
        [userId, row.garment_id, outfitId],
      )
      if (existingRows.length) {
        await conn.execute(
          `UPDATE feature2_cart_items
              SET quantity = quantity + 1
            WHERE id = ? AND user_id = ?`,
          [existingRows[0].id, userId],
        )
      } else {
        await conn.execute(
          `INSERT INTO feature2_cart_items (user_id, source_outfit_id, garment_id, quantity)
           VALUES (?, ?, ?, 1)`,
          [userId, outfitId, row.garment_id],
        )
      }
    }
  })
  return listCart(userId)
}

export async function deleteCartItem(userId, id) {
  const result = await execute(
    'DELETE FROM feature2_cart_items WHERE id = ? AND user_id = ?',
    [id, userId],
  )
  return result.affectedRows > 0
}

export async function setCartQuantity(userId, id, quantity) {
  const value = Math.max(1, Number(quantity) || 1)
  const result = await execute(
    'UPDATE feature2_cart_items SET quantity = ? WHERE id = ? AND user_id = ?',
    [value, id, userId],
  )
  if (result.affectedRows === 0) return null
  const row = await getOne(
    `SELECT c.id, c.source_outfit_id, c.quantity, c.created_at, g.*
       FROM feature2_cart_items c
       JOIN garments g ON g.id = c.garment_id
      WHERE c.id = ? AND c.user_id = ?`,
    [id, userId],
  )
  return mapCartRow(row)
}
