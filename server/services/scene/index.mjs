/**
 * 场景模拟业务层的编排入口。
 *
 * 功能四采用「规则 + 真实用户数据」：
 * - 纯旧衣方案只从本人 garments 表选衣服；
 * - 新旧混搭方案先判断缺槽，再补人工维护的 scene_catalog；
 * - 天气默认定位 + 可选 OpenWeather，失败自动降级，不阻塞生成。
 *
 * 这一层只做编排：取数据 → 交给 planner 算 → 落库。
 * 算法在 planner.mjs，天气在 weather.mjs，场景/天气常量表在 constants/scene.mjs。
 */
import { listGarments } from '../garmentService.mjs'
import { getLatestProfile } from '../profileService.mjs'
// 购物车已统一到 cartService（规格 §4.5 §13）。场景新品以 item_type='catalog'
// 入车，不再冒充 garment —— 那是历史脏数据被功能三静默丢弃的根因。
import { addCatalogItems, listCart } from '../cartService.mjs'
import {
  ensureSceneCatalog,
  findCatalogByIds,
  findSceneOutfit,
  listCatalog,
  listSceneOutfits,
  saveSceneOutfit,
} from '../../repositories/sceneRepo.mjs'
import { SCENE_DEFINITIONS, SCENE_KEYS } from '../../constants/scene.mjs'
import { seasonForMonth, resolveWeather } from './weather.mjs'
import { buildPurePlans, buildMixedPlans } from './planner.mjs'

// 拆分前这些都从 sceneService.mjs 导出，routes/scene.mjs 和 5 个 check 脚本在用。
// 这里原样再导出，导入面不变。
export { SCENE_DEFINITIONS, SCENE_KEYS, resolveWeather }
function findScene(sceneKey) {
  return SCENE_DEFINITIONS.find((scene) => scene.key === sceneKey) || SCENE_DEFINITIONS[0]
}

export async function generateScenePlans({ userId, sceneKey, season, weather }) {
  const scene = findScene(sceneKey)
  const selectedSeason = season || seasonForMonth()
  const resolvedWeather =
    weather && Object.keys(weather).length
      ? { ...weather, season: selectedSeason }
      : { city: '杭州', temp: 20, condition: '多云', icon: '⛅', source: 'fallback' }
  const [profile, garments, catalog] = await Promise.all([
    getLatestProfile(userId),
    listGarments(userId),
    listCatalog(scene.key),
  ])

  const pure = buildPurePlans({
    garments,
    scene,
    season: selectedSeason,
    weather: resolvedWeather,
    profile,
  })
  const mixed = buildMixedPlans({
    garments,
    catalog,
    scene,
    season: selectedSeason,
    weather: resolvedWeather,
    profile,
  })
  const activeIds = new Set([...pure.activeIds, ...mixed.activeIds])

  return {
    scene,
    season: selectedSeason,
    weather: resolvedWeather,
    profile: {
      styles: profile?.styles || [],
      visualBody: profile?.visualBody || '',
    },
    wardrobeCount: garments.length,
    activatedGarmentCount: activeIds.size,
    plans: {
      pure: pure.plans,
      mixed: mixed.plans,
    },
    missingSlots: mixed.plans
      .flatMap((plan) => plan.missingSlots)
      .filter((slot, index, all) => all.indexOf(slot) === index),
  }
}

export async function saveOutfit(userId, input) {
  if (!SCENE_KEYS.has(input.sceneKey)) {
    const error = new Error('场景参数不合法')
    error.status = 400
    error.code = 'INVALID_SCENE'
    throw error
  }
  if (!['pure', 'mixed'].includes(input.mode)) {
    const error = new Error('方案模式不合法')
    error.status = 400
    error.code = 'INVALID_MODE'
    throw error
  }
  if (!Array.isArray(input.composition) || input.composition.length === 0) {
    const error = new Error('方案没有可保存的单品')
    error.status = 400
    error.code = 'EMPTY_OUTFIT'
    throw error
  }

  const composition = input.composition.slice(0, 20).map((item, index) => ({
    id: String(item.id || `item-${index}`),
    name: String(item.name || '未命名单品'),
    category: String(item.category || ''),
    price: Number(item.price) || 0,
    imageUrl: String(item.imageUrl || ''),
    from: String(item.from || '#ffd1e8'),
    to: String(item.to || '#c9b8ff'),
    emoji: String(item.emoji || '👗'),
    isNew: Boolean(item.isNew),
    taokouling: item.taokouling ? String(item.taokouling) : '',
    sortOrder: index,
  }))

  return saveSceneOutfit(userId, {
    sceneKey: input.sceneKey,
    title: String(input.title || findScene(input.sceneKey).label),
    season: String(input.season || ''),
    mode: input.mode,
    filterKey: String(input.filterKey || 'day'),
    weather: input.weather || {},
    composition,
  })
}

export async function buyOutfit(userId, itemIds, sourceOutfitId) {
  const cleanIds = [...new Set((Array.isArray(itemIds) ? itemIds : []).map(String))]
  if (!cleanIds.length) {
    const error = new Error('没有可加入购物车的新品')
    error.status = 400
    error.code = 'EMPTY_CART'
    throw error
  }
  return addCatalogItems(userId, cleanIds, sourceOutfitId)
}

export { ensureSceneCatalog, findCatalogByIds, findSceneOutfit, listCart, listSceneOutfits }
