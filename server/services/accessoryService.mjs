/**
 * 配饰推荐业务层
 *
 * 比赛版按需求第 9.4 节使用规则推荐：当前服装、季节、场合、用户画像、
 * 当前用户历史评分和少量聚合评分共同决定排序，并把每个来源转成可读理由。
 */
import * as accessoryRepo from '../repositories/accessoryRepo.mjs'
import * as cartService from './accessoryCartService.mjs'
import * as profileRepo from '../repositories/profileRepo.mjs'
import * as userRepo from '../repositories/userRepo.mjs'
import {
  ACCESSORY_CATEGORIES,
  CATEGORY_LABELS,
  GARMENT_CATEGORY_LABELS,
  BUDGET_RANGES,
  DEMO_RATINGS,
} from '../constants/accessory.mjs'

// 分类表原来定义在本文件并对外导出，迁走后在这里原样再导出，保持导入面不变
// （routes/accessories.mjs 用 import * as accessoryService 取它）
export { ACCESSORY_CATEGORIES }

function asStringList(value) {
  if (!Array.isArray(value)) return []
  return value.map(String).filter(Boolean)
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean).map(String)))
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function overlapScore(left, right) {
  if (!left.length || !right.length) return 0
  const rightSet = new Set(right.map((item) => String(item).toLowerCase()))
  return left.filter((item) => rightSet.has(String(item).toLowerCase())).length
}

function hexToHsl(hex) {
  const value = String(hex || '').replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null
  const r = parseInt(value.slice(0, 2), 16) / 255
  const g = parseInt(value.slice(2, 4), 16) / 255
  const b = parseInt(value.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))
  return { h, s, l }
}

function colorHarmony(garmentColors, accessoryColor) {
  const accessoryHsl = hexToHsl(accessoryColor)
  if (!accessoryHsl) return { score: 10, reason: '配色保持中性，不会喧宾夺主' }

  const accessoryIsNeutral = accessoryHsl.s < 0.12 || accessoryHsl.l < 0.18 || accessoryHsl.l > 0.92
  if (accessoryIsNeutral) {
    return { score: 18, reason: '低饱和中性色，与大多数服装颜色都容易协调' }
  }

  let best = { score: 8, reason: '用配饰颜色制造小面积对比，增加造型亮点' }
  for (const color of garmentColors) {
    const hsl = hexToHsl(color)
    if (!hsl) continue
    const difference = Math.abs(hsl.h - accessoryHsl.h)
    const circular = Math.min(difference, 360 - difference)
    if (circular <= 24 && Math.abs(hsl.l - accessoryHsl.l) <= 0.35) {
      best = { score: 30, reason: '与当前服装色相接近，整体更统一' }
      break
    }
    if (circular >= 145 && circular <= 205) {
      best = { score: 24, reason: '与当前服装形成冷暖对比，提亮整套搭配' }
      break
    }
  }
  return best
}

function budgetAdjustment(profile, price) {
  const budget = profile?.preferences?.budget
  const range = BUDGET_RANGES[budget]
  if (!range) return 0
  if (price >= range[0] && price <= range[1]) return 6
  if (price < range[0]) return 2
  return -4
}

function bodyAdjustment(accessory, profile) {
  if (accessory.category !== 'belt') return { score: 0, reason: '' }
  const visualBody = profile?.visualBody
  if (visualBody === 'hourglass' || visualBody === 'pear') {
    return { score: 8, reason: '腰带可突出腰线，适合你的身形比例' }
  }
  return { score: 0, reason: '' }
}

function normalizeOutfit(input) {
  const rawGarment = input.garment || input.currentGarment || {}
  const rawOutfit = input.outfit || input.currentOutfit || []
  const outfit = Array.isArray(rawOutfit) ? rawOutfit : []
  const anchor = rawGarment?.id ? rawGarment : outfit[0] || {}

  const allColors = unique([...asStringList(anchor.colors), ...outfit.flatMap((item) => asStringList(item.colors))])
  const seasons = unique([
    ...asStringList(anchor.season ? [anchor.season] : []),
    ...outfit.map((item) => item.season).filter(Boolean),
  ])
  const occasions = unique([
    ...asStringList(anchor.occasions),
    ...outfit.flatMap((item) => asStringList(item.occasions)),
  ])
  const styles = unique([...asStringList(anchor.styles), ...outfit.flatMap((item) => asStringList(item.styles))])
  const garmentIds = unique([...(anchor.id ? [anchor.id] : []), ...outfit.map((item) => item.id)])

  return {
    anchor: {
      id: anchor.id || '',
      name: anchor.name || '当前服装',
      category: anchor.category || '',
      categoryLabel: GARMENT_CATEGORY_LABELS[anchor.category] || anchor.category || '服装',
    },
    colors: allColors,
    seasons,
    occasions,
    styles,
    garmentIds,
  }
}

function sortRecommendations(items) {
  return items
    .filter((item) => item.matchScore >= 24)
    .sort(
      (a, b) =>
        b.matchScore - a.matchScore ||
        (b.userRating || 0) - (a.userRating || 0) ||
        b.aggregateRating - a.aggregateRating ||
        b.favoriteCount - a.favoriteCount,
    )
    .slice(0, 5)
}

function enrichAccessory(accessory, userRating, aggregate) {
  return {
    ...accessory,
    categoryLabel: CATEGORY_LABELS[accessory.category] || accessory.category,
    userRating,
    aggregateRating: aggregate?.aggregateRating ?? accessory.basePopularity,
    ratingCount: aggregate?.ratingCount ?? 0,
  }
}

/**
 * 配饰目录初始化。
 *
 * 目录本身每次都同步（seedAccessories 是 upsert，18 行，代价可忽略），
 * 这样改了 seed-accessories.json —— 比如按素材清单填上 imageUrl ——
 * 已有的开发库也能拿到新值，不必先删表。以前这里「有数据就直接返回」，
 * seed 改了库里不动，很容易查半天。
 *
 * 演示评分只在冷启动灌一次：那是模拟的用户行为，重复写会把真实评分盖掉。
 */
export async function ensureAccessories() {
  const existing = await accessoryRepo.countAccessories()
  const inserted = await accessoryRepo.seedAccessories()
  if (existing > 0) return { inserted, demoInteractions: false }

  let demoInteractions = false
  for (const [openid, nickname, ratings] of DEMO_RATINGS) {
    try {
      const { user } = await userRepo.findOrCreateByOpenid(openid, { nickname })
      for (const [accessoryId, score] of ratings) {
        await accessoryRepo.upsertRating(user.id, accessoryId, score)
      }
      demoInteractions = true
    } catch (error) {
      console.warn('[accessory] 冷启动评分初始化失败:', error.message)
    }
  }
  return { inserted, demoInteractions }
}

export async function getCatalog() {
  await ensureAccessories()
  const [accessories, aggregated] = await Promise.all([
    accessoryRepo.listAccessories(),
    accessoryRepo.getAggregatedAccessories(),
  ])
  const aggregateMap = new Map(aggregated.map((item) => [item.id, item]))
  return accessories.map((accessory) => enrichAccessory(accessory, null, aggregateMap.get(accessory.id)))
}

export async function recommend(userId, input = {}) {
  await ensureAccessories()
  const context = normalizeOutfit(input)
  const [accessories, aggregated, profile] = await Promise.all([
    accessoryRepo.listAccessories(),
    accessoryRepo.getAggregatedAccessories(),
    profileRepo.findLatestProfile(userId),
  ])
  const userRatings = await accessoryRepo.getUserRatings(userId)
  const aggregateMap = new Map(aggregated.map((item) => [item.id, item]))
  const discountEligible = await cartService.hasOutfitInCart(userId, context.garmentIds)

  const recommendationsByCategory = ACCESSORY_CATEGORIES.map((category) => {
    const items = accessories
      .filter((accessory) => accessory.category === category.key)
      .map((accessory) => {
        const aggregate = aggregateMap.get(accessory.id)
        const userRating = userRatings.get(accessory.id) || null
        const harmony = colorHarmony(context.colors, accessory.primaryColor)
        const seasonHit = context.seasons.some(
          (season) => accessory.seasons.includes(season) || accessory.seasons.includes('四季'),
        )
        const occasionHits = context.occasions.filter((occasion) => accessory.occasions.includes(occasion))
        const styleHits =
          overlapScore(context.styles, accessory.styles) + overlapScore(profile?.styles || [], accessory.styles)
        const body = bodyAdjustment(accessory, profile)
        const budget = budgetAdjustment(profile, accessory.price)
        const personalScore = userRating === null ? 0 : (userRating - 3) * 4
        const socialScore =
          (aggregate.aggregateRating - 3.5) * 8 +
          Math.min(aggregate.ratingCount, 30) * 0.2 +
          Math.min(accessory.favoriteCount, 80) * 0.04

        const matchScore = clamp(
          Math.round(
            24 +
              harmony.score +
              (seasonHit ? 16 : -4) +
              Math.min(occasionHits.length * 7, 14) +
              Math.min(styleHits * 4, 10) +
              body.score +
              budget +
              personalScore +
              socialScore,
          ),
          0,
          100,
        )

        const reasons = []
        if (harmony.score >= 18) reasons.push(harmony.reason)
        if (seasonHit) {
          reasons.push(`匹配${context.seasons.join('/') || '当前'}季节，适合当场穿戴`)
        }
        if (occasionHits.length) reasons.push(`匹配「${occasionHits.join('、')}」场合`)
        if (styleHits) reasons.push('呼应你当前画像中的穿搭风格')
        if (body.reason) reasons.push(body.reason)
        if (budget > 0) reasons.push('价格落在你偏好的预算区间')
        if (userRating) reasons.push(`你曾给出 ${userRating} 星评价`)
        if (aggregate.ratingCount > 0) {
          reasons.push(`${aggregate.ratingCount} 位用户的聚合评分为 ${aggregate.aggregateRating.toFixed(1)}`)
        }
        if (!reasons.length) reasons.push('暂无强匹配，可查看其他风格')

        return {
          ...enrichAccessory(accessory, userRating, aggregate),
          matchScore,
          matchReasons: reasons.slice(0, 3),
          matchReason: reasons.slice(0, 3).join('；'),
        }
      })

    return { ...category, items: sortRecommendations(items) }
  })

  return {
    source: 'rule',
    currentOutfit: context,
    categories: recommendationsByCategory,
    discountEligible,
    hotCombos: await getHotCombos(),
  }
}

export async function rateAccessory(userId, accessoryId, score) {
  await ensureAccessories()
  const value = Number(score)
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    const err = new Error('评分需为 1 到 5 的整数')
    err.status = 400
    err.code = 'INVALID_RATING'
    throw err
  }
  const accessory = await accessoryRepo.findAccessoryById(accessoryId)
  if (!accessory) {
    const err = new Error('配饰不存在')
    err.status = 404
    err.code = 'ACCESSORY_NOT_FOUND'
    throw err
  }
  await accessoryRepo.upsertRating(userId, accessoryId, value)
  const aggregate = await accessoryRepo.getAggregatedAccessories()
  return {
    accessoryId,
    score: value,
    aggregateRating: aggregate.find((item) => item.id === accessoryId)?.aggregateRating ?? 0,
  }
}

export async function getHotCombos() {
  await ensureAccessories()
  const rows = await accessoryRepo.getAggregatedAccessories()
  const byCategory = new Map()
  for (const category of ACCESSORY_CATEGORIES) {
    byCategory.set(
      category.key,
      rows
        .filter((item) => item.category === category.key)
        .sort(
          (a, b) =>
            b.aggregateRating - a.aggregateRating || b.ratingCount - a.ratingCount || b.favoriteCount - a.favoriteCount,
        ),
    )
  }

  const titles = ['轻盈约会组合', '利落通勤组合', '街头个性组合']
  const combos = []
  for (let rank = 0; rank < 3; rank += 1) {
    const items = ACCESSORY_CATEGORIES.map((category) => byCategory.get(category.key)?.[rank]).filter(Boolean)
    if (!items.length) continue
    const score = items.reduce((sum, item) => sum + item.aggregateRating, 0) / items.length
    const favoriteCount = items.reduce((sum, item) => sum + item.favoriteCount + item.ratingCount, 0)
    combos.push({
      id: `hot-combo-${rank + 1}`,
      title: titles[rank],
      subtitle: `${items.length} 类配饰按真实评分与热度组合`,
      score: Math.round(score * 10) / 10,
      favoriteCount,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        categoryLabel: CATEGORY_LABELS[item.category] || item.category,
        imageUrl: item.imageUrl,
        emoji: item.emoji || '',
        from: item.primaryColor,
        to: item.secondaryColor,
        aggregateRating: item.aggregateRating,
        ratingCount: item.ratingCount,
      })),
    })
  }
  return combos
}
