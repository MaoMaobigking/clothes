/**
 * 场景模拟业务层
 *
 * 功能四采用“规则 + 真实用户数据”：
 * - 纯旧衣方案只从本人 garments 表选衣服；
 * - 新旧混搭方案先判断缺槽，再补人工维护的 scene_catalog；
 * - 天气默认定位 + 可选 OpenWeather，失败自动降级，不阻塞生成。
 */
import { listGarments } from './garmentService.mjs'
import { getLatestProfile } from './profileService.mjs'
// 购物车已统一到 cartService（规格 §4.5 §13）。场景新品以 item_type='catalog'
// 入车，不再冒充 garment —— 那是历史脏数据被功能三静默丢弃的根因。
import { addCatalogItems, listCart } from './cartService.mjs'
import {
  ensureSceneCatalog,
  findCatalogByIds,
  findSceneOutfit,
  listCatalog,
  listSceneOutfits,
  saveSceneOutfit,
} from '../repositories/sceneRepo.mjs'

export const SCENE_DEFINITIONS = [
  {
    key: 'daily',
    label: '日常休闲',
    keywords: ['舒适', '百搭', '休闲'],
    slots: ['top', 'pants', 'shoes', 'accessory'],
  },
  {
    key: 'business',
    label: '商务正装',
    keywords: ['通勤', '利落', '正式'],
    slots: ['top', 'pants', 'shoes', 'bag'],
  },
  {
    key: 'date',
    label: '约会聚会',
    keywords: ['浪漫', '精致', '社交'],
    slots: ['dress', 'shoes', 'accessory', 'bag'],
  },
  {
    key: 'travel',
    label: '旅行度假',
    keywords: ['轻便', '防晒', '度假'],
    slots: ['top', 'pants', 'shoes', 'hat', 'bag'],
  },
  {
    key: 'academy',
    label: '学院风',
    keywords: ['复古', '学院', '减龄'],
    slots: ['top', 'skirt', 'shoes', 'accessory'],
  },
  {
    key: 'cosplay',
    label: 'cosplay',
    keywords: ['造型', '戏剧', '个性'],
    slots: ['dress', 'top', 'shoes', 'accessory'],
  },
]

export const SCENE_KEYS = new Set(SCENE_DEFINITIONS.map((scene) => scene.key))

const WEATHER_CITIES = [
  { name: '杭州', latitude: 30.2741, longitude: 120.1551 },
  { name: '重庆', latitude: 29.563, longitude: 106.5516 },
  { name: '上海', latitude: 31.2304, longitude: 121.4737 },
  { name: '北京', latitude: 39.9042, longitude: 116.4074 },
  { name: '广州', latitude: 23.1291, longitude: 113.2644 },
]

const WEATHER_CONDITIONS = [
  { condition: '晴', icon: '☀️' },
  { condition: '多云', icon: '⛅' },
  { condition: '小雨', icon: '🌦️' },
  { condition: '阴', icon: '☁️' },
]

function findScene(sceneKey) {
  return SCENE_DEFINITIONS.find((scene) => scene.key === sceneKey) || SCENE_DEFINITIONS[0]
}

function seasonForMonth(month = new Date().getMonth() + 1) {
  if (month >= 3 && month <= 5) return '春季'
  if (month >= 6 && month <= 8) return '夏季'
  if (month >= 9 && month <= 11) return '秋季'
  return '冬季'
}

function roundCoord(value, digits = 4) {
  return Number(Number(value).toFixed(digits))
}

function nearestCity(latitude, longitude) {
  let best = WEATHER_CITIES[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const city of WEATHER_CITIES) {
    const dx = city.latitude - latitude
    const dy = city.longitude - longitude
    const distance = dx * dx + dy * dy
    if (distance < bestDistance) {
      bestDistance = distance
      best = city
    }
  }
  return best
}

function buildFallbackWeather(latitude, longitude, season = seasonForMonth()) {
  const city = nearestCity(latitude, longitude)
  const month = new Date().getMonth() + 1
  const index = Math.abs(Math.round(latitude + longitude + month * 7)) % WEATHER_CONDITIONS.length
  const weather = WEATHER_CONDITIONS[index]
  const tempBase = {
    '春季': 18,
    '夏季': 30,
    '秋季': 20,
    '冬季': 6,
  }
  const temp = (tempBase[season] ?? 18) + (index % 3)
  return {
    city: city.name,
    temp,
    condition: weather.condition,
    icon: weather.icon,
    season,
    source: 'fallback',
    latitude: roundCoord(latitude),
    longitude: roundCoord(longitude),
  }
}

async function fetchWeatherWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`天气接口 ${response.status}`)
    }
    return response.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 定位天气。有 OpenWeather key 时尝试真实接口；没有或失败时使用可解释的
 * 本地降级数据，保证首次进入场景页不会因外部服务失败而阻断。
 */
export async function resolveWeather(input = {}) {
  const latitude = Number(input.latitude)
  const longitude = Number(input.longitude)
  const season = input.season || seasonForMonth()

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      city: input.city || '杭州',
      temp: Number(input.temp) || 20,
      condition: input.condition || '多云',
      icon: input.icon || '⛅',
      season,
      source: 'manual',
    }
  }

  const fallback = buildFallbackWeather(latitude, longitude, season)
  const apiKey = process.env.OPENWEATHER_API_KEY
  if (!apiKey) return fallback

  try {
    const url =
      'https://api.openweathermap.org/data/2.5/weather' +
      `?lat=${latitude}&lon=${longitude}&units=metric&lang=zh_cn&appid=${apiKey}`
    const data = await fetchWeatherWithTimeout(url)
    return {
      city: data.name || fallback.city,
      temp: Math.round(Number(data.main?.temp)),
      condition: data.weather?.[0]?.description || fallback.condition,
      icon: data.weather?.[0]?.main || fallback.icon,
      season,
      source: 'located',
      latitude: roundCoord(latitude),
      longitude: roundCoord(longitude),
    }
  } catch (error) {
    console.warn('[sceneService] 真实天气接口不可用，使用定位降级:', error.message)
    return fallback
  }
}

function seasonMatches(season, itemSeason) {
  if (!season || season === '四季') return true
  if (!itemSeason || itemSeason === '四季') return true
  if (season === '春季' || season === '夏季') return itemSeason.includes('春') || itemSeason.includes('夏')
  if (season === '秋季' || season === '冬季') return itemSeason.includes('秋') || itemSeason.includes('冬')
  return true
}

function normalizeItem(g, source) {
  const item = {
    id: g.id,
    name: g.name,
    category: g.category,
    price: Number(g.price) || 0,
    imageUrl: g.img || g.imageUrl || '',
    from: g.from || '#ffd1e8',
    to: g.to || '#c9b8ff',
    emoji: g.emoji || '👗',
    season: g.season || '四季',
    tags: Array.isArray(g.tags) ? g.tags : [],
    isNew: source === 'catalog',
    source,
  }
  if (source === 'catalog') {
    item.taobaoUrl = g.taobaoUrl
    item.taokouling = g.taokouling
    item.keywords = Array.isArray(g.keywords) ? g.keywords : []
  }
  return item
}

function eligibleGarments(garments, category, season, weather) {
  return garments.filter((garment) => {
    if (garment.category !== category) return false
    if (!seasonMatches(season, garment.season)) return false
    return true
  })
}

function pickWithRotation(pool, index, usedIds) {
  const available = pool.filter((item) => !usedIds.has(item.id))
  if (!available.length) return null
  return available[index % available.length]
}

function buildReason(scene, season, weather, profile, mode, usedGarments) {
  const style = profile?.styles?.length
    ? `结合你的「${profile.styles.slice(0, 2).join('、')}」偏好`
    : '基于当前身形画像'
  const weatherText = weather?.city ? `和 ${weather.city} ${weather.condition} ${weather.temp}℃` : ''
  const sourceText = mode === 'pure'
    ? `全部使用衣橱中的 ${usedGarments} 件旧衣`
    : `保留衣橱旧衣，并用 ${usedGarments} 件目录新品补齐缺槽`
  return `${style}${weatherText}，${sourceText}。关键词：${scene.keywords.join('、')}。`
}

function makePlan({
  id,
  title,
  scene,
  season,
  weather,
  profile,
  mode,
  items,
  usedGarmentCount,
}) {
  const reason = buildReason(scene, season, weather, profile, mode, usedGarmentCount)
  return {
    id,
    title,
    scene: scene.label,
    sceneKey: scene.key,
    season,
    mode,
    reason,
    items,
    weather,
    newItemCount: items.filter((item) => item.isNew).length,
    oldItemCount: items.filter((item) => !item.isNew).length,
  }
}

function buildPurePlans({ garments, scene, season, weather, profile }) {
  const plans = []
  const activeIds = new Set()

  for (let planIndex = 0; planIndex < 3; planIndex++) {
    const usedIds = new Set()
    const items = []
    scene.slots.forEach((category, slotIndex) => {
      const pool = eligibleGarments(garments, category, season, weather)
      const item = pickWithRotation(pool, planIndex * 2 + slotIndex, usedIds)
      if (item) {
        usedIds.add(item.id)
        activeIds.add(item.id)
        items.push(normalizeItem(item, 'garment'))
      }
    })

    plans.push(makePlan({
      id: `pure-${planIndex + 1}`,
      title: `${scene.label} · 旧衣方案 ${planIndex + 1}`,
      scene,
      season,
      weather,
      profile,
      mode: 'pure',
      items,
      usedGarmentCount: items.length,
    }))
  }

  return { plans, activeIds }
}

function buildMixedPlans({ garments, catalog, scene, season, weather, profile }) {
  const plans = []
  const activeIds = new Set()

  for (let planIndex = 0; planIndex < 3; planIndex++) {
    const usedIds = new Set()
    const items = []
    const missingSlots = []

    scene.slots.forEach((category, slotIndex) => {
      const oldPool = eligibleGarments(garments, category, season, weather)
      const oldItem = pickWithRotation(oldPool, planIndex + slotIndex, usedIds)

      // 每套方案至少留一个确定性缺槽，保证新旧混搭确实出现新品。
      const forceNewSlot = slotIndex === planIndex % scene.slots.length
      const catalogPool = catalog.filter(
        (item) => item.category === category && seasonMatches(season, item.season),
      )
      const catalogItem = pickWithRotation(catalogPool, planIndex + slotIndex, usedIds)

      if (!forceNewSlot && oldItem) {
        usedIds.add(oldItem.id)
        activeIds.add(oldItem.id)
        items.push(normalizeItem(oldItem, 'garment'))
        return
      }

      if (catalogItem) {
        usedIds.add(catalogItem.id)
        items.push(normalizeItem(catalogItem, 'catalog'))
        missingSlots.push(category)
        return
      }

      if (oldItem) {
        usedIds.add(oldItem.id)
        activeIds.add(oldItem.id)
        items.push(normalizeItem(oldItem, 'garment'))
      }
    })

    plans.push({
      ...makePlan({
        id: `mixed-${planIndex + 1}`,
        title: `${scene.label} · 新旧混搭 ${planIndex + 1}`,
        scene,
        season,
        weather,
        profile,
        mode: 'mixed',
        items,
        usedGarmentCount: items.filter((item) => !item.isNew).length,
      }),
      missingSlots,
    })
  }

  return { plans, activeIds }
}

export async function generateScenePlans({ userId, sceneKey, season, weather }) {
  const scene = findScene(sceneKey)
  const selectedSeason = season || seasonForMonth()
  const resolvedWeather = weather && Object.keys(weather).length
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

export {
  ensureSceneCatalog,
  findCatalogByIds,
  findSceneOutfit,
  listCart,
  listSceneOutfits,
}

