import * as garmentRepo from '../repositories/garmentRepo.mjs'
import * as outfitRepo from '../repositories/outfitRepo.mjs'

const RECIPES = [
  {
    scene: 'work',
    title: '今日通勤',
    occasion: 'work',
    groups: [['top'], ['pants', 'skirt', 'dress'], ['shoes'], ['bag']],
  },
  {
    scene: 'date',
    title: '约会轻装',
    occasion: 'date',
    groups: [['top'], ['skirt', 'dress'], ['shoes'], ['bag', 'jewelry', 'accessory']],
  },
  {
    scene: 'daily',
    title: '周末日常',
    occasion: 'daily',
    groups: [['top'], ['pants', 'skirt', 'dress'], ['shoes'], ['hat', 'bag', 'accessory']],
  },
]

function serviceError(message, code, status = 400) {
  const err = new Error(message)
  err.code = code
  err.status = status
  return err
}

function currentSeasonKey() {
  const month = new Date().getMonth() + 1
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

function recentBonus(item) {
  if (!item.uploadedAt) return 0
  const uploaded = new Date(item.uploadedAt).getTime()
  if (!Number.isFinite(uploaded)) return 0
  const ageDays = Math.max(0, (Date.now() - uploaded) / 86400000)
  return Math.max(0, Math.round(30 - ageDays))
}

function rankGarment(item) {
  const frequent = item.frequentlyWorn ? 1000 : 0
  const order = 1000 - Math.min(Number(item.sortOrder) || 0, 999)
  return frequent + order * 10 + recentBonus(item)
}

function scoreGarment(item, recipe, used) {
  if (used.has(item.id)) return -Infinity
  let score = rankGarment(item)
  if ((item.seasons || []).includes(recipe.season)) score += 220
  if ((item.occasions || []).includes(recipe.occasion)) score += 180
  if (!item.seasons?.length && !item.occasions?.length) score += 40
  return score
}

function pickGarment(pool, categories, used, recipe, offset) {
  const candidates = pool
    .filter((item) => categories.includes(item.category))
    .map((item) => ({ item, score: scoreGarment(item, recipe, used) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
  if (!candidates.length) return null
  return candidates[Math.abs(offset) % candidates.length].item
}

function buildPlan(pool, recipe, planIndex, season, inputLabel) {
  const used = new Set()
  const items = []
  for (const group of recipe.groups) {
    const picked = pickGarment(pool, group, used, recipe, planIndex + used.size)
    if (!picked) continue
    used.add(picked.id)
    items.push(picked.id)
  }

  const optional = pool
    .filter((item) => !used.has(item.id))
    .map((item) => ({ item, score: scoreGarment(item, recipe, used) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
  for (const entry of optional) {
    if (items.length >= 6) break
    if (items.length >= 3 && entry.score < 200) continue
    used.add(entry.item.id)
    items.push(entry.item.id)
  }

  const usedNames = items
    .map((id) => pool.find((item) => item.id === id)?.name)
    .filter(Boolean)
    .join('、')
  return {
    title: recipe.title,
    scene: recipe.scene,
    occasion: recipe.occasion,
    season,
    items,
    reason: `从 ${pool.length} 件实际旧衣中按衣柜排序、常穿标记、季节和${recipe.occasion}场景生成，本套使用：${usedNames}。`,
    algorithm: {
      source: 'rule',
      garmentCount: pool.length,
      selectedCount: items.length,
      input: inputLabel,
      season,
      occasion: recipe.occasion,
      strategy: 'sort_order + frequently_worn + season/occasion',
      note: `排序越靠前、常穿标记越多，越优先进入搭配。`,
    },
  }
}

export async function generateOutfits(userId, selectedIds) {
  const all = await garmentRepo.listGarments(userId)
  if (all.length < 2) {
    throw serviceError('衣橱至少需要 2 件旧衣才能生成搭配', 'NOT_ENOUGH_GARMENTS')
  }

  let pool = []
  let inputLabel = 'top_30'
  if (Array.isArray(selectedIds) && selectedIds.length > 0) {
    const ids = [...new Set(selectedIds.map(String))]
    const byId = new Map(all.map((item) => [item.id, item]))
    for (const id of ids) {
      if (!byId.has(id)) {
        throw serviceError('选中的衣物不属于当前用户或已被删除', 'GARMENT_NOT_FOUND', 404)
      }
    }
    pool = ids.map((id) => byId.get(id)).filter(Boolean)
    inputLabel = 'manual_selection'
  } else {
    pool = all
      .map((item) => ({ item, score: rankGarment(item) }))
      .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
      .slice(0, 30)
      .map((entry) => entry.item)
  }

  const season = currentSeasonKey()
  const batchId = `batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const plans = RECIPES.map((recipe, index) =>
    buildPlan(pool, { ...recipe, season }, index, season, inputLabel),
  )
  return outfitRepo.createOutfitBatch(userId, batchId, plans)
}

export function getBatch(userId, batchId) {
  return outfitRepo.getOutfitBatch(userId, batchId)
}

export function getOutfit(userId, id) {
  return outfitRepo.getOutfit(userId, id)
}

export function listOutfits(userId, options = {}) {
  return outfitRepo.listOutfits(userId, options)
}

export async function saveOutfit(userId, id) {
  const result = await outfitRepo.saveOutfit(userId, id)
  if (!result) {
    throw serviceError('搭配不存在或不属于当前用户', 'OUTFIT_NOT_FOUND', 404)
  }
  return result
}

export async function replaceOutfitItem(userId, outfitId, oldGarmentId, newGarmentId) {
  if (oldGarmentId === newGarmentId) return outfitRepo.getOutfit(userId, outfitId)
  const result = await outfitRepo.replaceOutfitItem(
    userId,
    outfitId,
    oldGarmentId,
    newGarmentId,
  )
  if (result === null) {
    throw serviceError('搭配不存在或不属于当前用户', 'OUTFIT_NOT_FOUND', 404)
  }
  if (result.missingOld) {
    throw serviceError('被替换的单品不存在于当前搭配', 'OUTFIT_ITEM_NOT_FOUND', 404)
  }
  if (result.missingNew) {
    throw serviceError('替换单品不存在', 'GARMENT_NOT_FOUND', 404)
  }
  if (result.categoryMismatch) {
    throw serviceError('只能从同类型衣物中替换', 'CATEGORY_MISMATCH')
  }
  return result
}

export function deleteOutfit(userId, id) {
  return outfitRepo.deleteOutfit(userId, id)
}
