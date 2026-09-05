import { execute, getAll, getOne, withTransaction } from '../db/mysql.mjs'
import { rowToGarment } from './garmentRepo.mjs'

function parseJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const OUTFIT_COLS = `
  id, user_id, title, scene, reason, batch_id, kind, is_saved, is_starred,
  season, occasion, algorithm, created_at
`

async function itemsForOutfit(userId, outfitId) {
  const rows = await getAll(
    `SELECT oi.id AS item_id, oi.sort_order, g.*
       FROM outfit_items oi
       JOIN garments g ON g.id = oi.garment_id
      WHERE oi.outfit_id = ? AND g.user_id = ?
      ORDER BY oi.sort_order ASC, oi.id ASC`,
    [outfitId, userId],
  )
  return rows.map((row) => ({
    id: row.item_id,
    sortOrder: Number(row.sort_order ?? 0),
    garment: rowToGarment(row),
  }))
}

function mapOutfit(row, items) {
  if (!row) return null
  return {
    id: Number(row.id),
    title: row.title || '',
    scene: row.scene || '',
    reason: row.reason || '',
    batchId: row.batch_id || '',
    kind: row.kind || 'generated',
    isSaved: Boolean(row.is_saved),
    isStarred: Boolean(row.is_starred),
    season: row.season || '',
    occasion: row.occasion || '',
    algorithm: parseJson(row.algorithm, {}),
    items,
    createdAt: row.created_at,
  }
}

async function findOutfitRow(userId, id) {
  return getOne(`SELECT ${OUTFIT_COLS} FROM outfits WHERE id = ? AND user_id = ?`, [id, userId])
}

export async function createOutfitBatch(userId, batchId, plans) {
  await withTransaction(async (conn) => {
    for (const plan of plans) {
      const [result] = await conn.execute(
        `INSERT INTO outfits
          (user_id, title, scene, reason, batch_id, kind, is_saved,
           season, occasion, algorithm)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          plan.title,
          plan.scene,
          plan.reason,
          batchId,
          'generated',
          0,
          plan.season,
          plan.occasion,
          JSON.stringify(plan.algorithm || {}),
        ],
      )
      const outfitId = result.insertId
      for (let index = 0; index < plan.items.length; index += 1) {
        await conn.execute(
          `INSERT INTO outfit_items (outfit_id, garment_id, sort_order)
           VALUES (?, ?, ?)`,
          [outfitId, plan.items[index], index + 1],
        )
      }
    }
  })
  return getOutfitBatch(userId, batchId)
}

/**
 * 手动搭配落库（自由搭配页的「保存」）。
 *
 * 和 createOutfitBatch 的区别：
 *   - kind = 'manual'，没有 batch_id —— 它不属于任何一次 AI 生成批次。
 *     所以按 batchId 取搭配的接口对它一律取不到，前端必须走 outfitId。
 *   - is_saved 直接就是 1。用户点保存的意思就是要留着，不需要再点一次「保存」。
 */
export async function createManualOutfit(userId, { title, scene, reason, garmentIds }) {
  let outfitId = 0
  await withTransaction(async (conn) => {
    const [result] = await conn.execute(
      `INSERT INTO outfits
        (user_id, title, scene, reason, batch_id, kind, is_saved, is_starred,
         season, occasion, algorithm)
       VALUES (?, ?, ?, ?, NULL, 'manual', 1, 0, ?, ?, ?)`,
      [userId, title, scene, reason, '', scene, JSON.stringify({ source: 'free-match' })],
    )
    outfitId = result.insertId
    for (let index = 0; index < garmentIds.length; index += 1) {
      await conn.execute(
        `INSERT INTO outfit_items (outfit_id, garment_id, sort_order)
         VALUES (?, ?, ?)`,
        [outfitId, garmentIds[index], index + 1],
      )
    }
  })
  return getOutfit(userId, outfitId)
}

export async function getOutfitBatch(userId, batchId) {
  const rows = await getAll(
    `SELECT ${OUTFIT_COLS}
       FROM outfits
      WHERE user_id = ? AND batch_id = ?
      ORDER BY id ASC`,
    [userId, batchId],
  )
  const outfits = []
  for (const row of rows) {
    outfits.push(mapOutfit(row, await itemsForOutfit(userId, row.id)))
  }
  return outfits.length ? { id: batchId, outfits } : null
}

export async function getOutfit(userId, id) {
  const row = await findOutfitRow(userId, id)
  if (!row) return null
  return mapOutfit(row, await itemsForOutfit(userId, id))
}

export async function listOutfits(userId, { kind = '', saved = false, starred = false } = {}) {
  const conditions = ['user_id = ?']
  const params = [userId]
  if (kind) {
    conditions.push('kind = ?')
    params.push(kind)
  }
  if (saved) {
    conditions.push('is_saved = 1')
  }
  if (starred) {
    conditions.push('is_starred = 1')
  }
  const rows = await getAll(
    `SELECT ${OUTFIT_COLS}
       FROM outfits
      WHERE ${conditions.join(' AND ')}
      ORDER BY is_starred DESC, created_at DESC, id DESC`,
    params,
  )
  const outfits = []
  for (const row of rows) {
    outfits.push(mapOutfit(row, await itemsForOutfit(userId, row.id)))
  }
  return outfits
}

export async function saveOutfit(userId, id) {
  const result = await execute('UPDATE outfits SET is_saved = 1 WHERE id = ? AND user_id = ?', [id, userId])
  if (result.affectedRows === 0) return null
  return getOutfit(userId, id)
}

/**
 * 星标（自由搭配页和搭配结果页的「收藏」）。
 *
 * 顺带把 is_saved 也置 1：星标的前提是这条搭配已经留下来了，
 * 出现「收藏了但不在我的搭配里」是说不通的状态。
 */
export async function setOutfitStar(userId, id, starred) {
  const result = await execute(
    starred
      ? 'UPDATE outfits SET is_starred = 1, is_saved = 1 WHERE id = ? AND user_id = ?'
      : 'UPDATE outfits SET is_starred = 0 WHERE id = ? AND user_id = ?',
    [id, userId],
  )
  if (result.affectedRows === 0) return null
  return getOutfit(userId, id)
}

export async function replaceOutfitItem(userId, outfitId, oldGarmentId, newGarmentId) {
  const outfit = await findOutfitRow(userId, outfitId)
  if (!outfit) return null
  const oldItem = await getOne(
    `SELECT oi.id, g.category
       FROM outfit_items oi
       JOIN garments g ON g.id = oi.garment_id
      WHERE oi.outfit_id = ? AND oi.garment_id = ? AND g.user_id = ?`,
    [outfitId, oldGarmentId, userId],
  )
  if (!oldItem) return { missingOld: true }
  const newItem = await getOne(
    `SELECT id, category
       FROM garments
      WHERE id = ? AND user_id = ?`,
    [newGarmentId, userId],
  )
  if (!newItem) return { missingNew: true }
  if (newItem.category !== oldItem.category) return { categoryMismatch: true }
  await execute('UPDATE outfit_items SET garment_id = ? WHERE outfit_id = ? AND garment_id = ?', [
    newGarmentId,
    outfitId,
    oldGarmentId,
  ])
  return getOutfit(userId, outfitId)
}

export async function deleteOutfit(userId, id) {
  const result = await execute('DELETE FROM outfits WHERE id = ? AND user_id = ?', [id, userId])
  return result.affectedRows > 0
}
