/**
 * 搭配生成引擎：把「衣橱 + 目录 + 场景槽位 + 季节」算成三套方案。
 *
 * 这一层是纯函数，不碰数据库也不读配置 —— 数据全部由 index.mjs 取好后传进来。
 * 好处是想验证排序规则时可以直接喂假数据跑，不用起服务连库。
 */
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

// 第 4 个参数 weather 暂未参与筛选，保留占位以免打乱调用方的位置实参
function eligibleGarments(garments, category, season, _weather) {
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
  const sourceText =
    mode === 'pure'
      ? `全部使用衣橱中的 ${usedGarments} 件旧衣`
      : `保留衣橱旧衣，并用 ${usedGarments} 件目录新品补齐缺槽`
  return `${style}${weatherText}，${sourceText}。关键词：${scene.keywords.join('、')}。`
}

function makePlan({ id, title, scene, season, weather, profile, mode, items, usedGarmentCount }) {
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

export function buildPurePlans({ garments, scene, season, weather, profile }) {
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

    plans.push(
      makePlan({
        id: `pure-${planIndex + 1}`,
        title: `${scene.label} · 旧衣方案 ${planIndex + 1}`,
        scene,
        season,
        weather,
        profile,
        mode: 'pure',
        items,
        usedGarmentCount: items.length,
      }),
    )
  }

  return { plans, activeIds }
}

export function buildMixedPlans({ garments, catalog, scene, season, weather, profile }) {
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
      const catalogPool = catalog.filter((item) => item.category === category && seasonMatches(season, item.season))
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
