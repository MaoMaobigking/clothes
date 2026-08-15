import type {
  Accessory,
  AccessoryCart,
  AccessoryContextItem,
  AccessoryRecommendations,
} from '@/api/accessories'

const RATINGS_KEY = 'ai-fashion-accessory-ratings'
const CART_KEY = 'ai-fashion-accessory-cart'

type LocalAccessory = Omit<Accessory, 'categoryLabel' | 'userRating' | 'aggregateRating' | 'ratingCount' | 'matchScore' | 'matchReason' | 'matchReasons'> & {
  emoji: string
}

const CATEGORY_LABELS: Record<string, string> = {
  jewelry: '首饰',
  hat: '帽子',
  scarf: '围巾',
  belt: '腰带',
  shoes: '鞋子',
}

export const ACCESSORY_CATEGORY_EMOJI: Record<string, string> = {
  jewelry: '💎',
  hat: '🎩',
  scarf: '🧣',
  belt: '🪢',
  shoes: '👟',
}

const LOCAL_ACCESSORIES: LocalAccessory[] = [
  {
    id: 'ac-jewelry-1', category: 'jewelry', name: '珍珠耳钉', brand: 'GLOW', price: 138,
    originalPrice: 168, discountPrice: 118, imageUrl: '', tryonSlot: 'jewelry', tryonEnabled: true,
    primaryColor: '#fdf3f6', secondaryColor: '#f2cdd8', seasons: ['春夏'], occasions: ['约会', '聚会'],
    styles: ['french', 'korean'], keywords: ['柔和'], taobaoUrl: 'https://s.taobao.com/search?q=珍珠耳钉',
    taokouling: '￥珍珠耳钉AI穿搭演示￥', favoriteCount: 38, basePopularity: 4.7, emoji: '🤍',
  },
  {
    id: 'ac-jewelry-2', category: 'jewelry', name: '几何银项链', brand: 'SILVER', price: 168,
    originalPrice: 198, discountPrice: 148, imageUrl: '', tryonSlot: 'jewelry', tryonEnabled: true,
    primaryColor: '#eef1f6', secondaryColor: '#b9c2d4', seasons: ['四季'], occasions: ['通勤', '日常'],
    styles: ['commute', 'vintage'], keywords: ['利落'], taobaoUrl: 'https://s.taobao.com/search?q=几何银项链',
    taokouling: '￥几何银项链AI穿搭演示￥', favoriteCount: 31, basePopularity: 4.5, emoji: '📿',
  },
  {
    id: 'ac-jewelry-3', category: 'jewelry', name: '金属环耳夹', brand: 'CHIC', price: 84,
    originalPrice: 99, discountPrice: 72, imageUrl: '', tryonSlot: 'jewelry', tryonEnabled: false,
    primaryColor: '#f6f0ea', secondaryColor: '#d8c3a5', seasons: ['四季'], occasions: ['街头', '日常'],
    styles: ['street'], keywords: ['个性'], taobaoUrl: 'https://s.taobao.com/search?q=金属环耳夹',
    taokouling: '￥金属环耳夹AI穿搭演示￥', favoriteCount: 24, basePopularity: 4.4, emoji: '💫',
  },
  {
    id: 'ac-hat-1', category: 'hat', name: '针织毛线帽', brand: 'WARM', price: 79,
    originalPrice: 99, discountPrice: 69, imageUrl: '', tryonSlot: 'hat', tryonEnabled: true,
    primaryColor: '#ffd6c9', secondaryColor: '#ff9e86', seasons: ['秋冬'], occasions: ['日常', '旅行'],
    styles: ['street', 'sport'], keywords: ['保暖'], taobaoUrl: 'https://s.taobao.com/search?q=针织毛线帽',
    taokouling: '￥针织毛线帽AI穿搭演示￥', favoriteCount: 33, basePopularity: 4.6, emoji: '🧢',
  },
  {
    id: 'ac-hat-2', category: 'hat', name: '法式贝雷帽', brand: 'VINTAGE', price: 99,
    originalPrice: 119, discountPrice: 85, imageUrl: '', tryonSlot: 'hat', tryonEnabled: true,
    primaryColor: '#d8c3a5', secondaryColor: '#a9885c', seasons: ['春秋', '秋冬'], occasions: ['约会', '聚会'],
    styles: ['french', 'vintage'], keywords: ['复古'], taobaoUrl: 'https://s.taobao.com/search?q=法式贝雷帽',
    taokouling: '￥法式贝雷帽AI穿搭演示￥', favoriteCount: 27, basePopularity: 4.5, emoji: '👒',
  },
  {
    id: 'ac-hat-3', category: 'hat', name: '基础棒球帽', brand: 'BASIC', price: 69,
    originalPrice: 89, discountPrice: 59, imageUrl: '', tryonSlot: 'hat', tryonEnabled: true,
    primaryColor: '#d6e4f0', secondaryColor: '#9ab6d8', seasons: ['春夏'], occasions: ['街头', '旅行'],
    styles: ['street', 'sport'], keywords: ['休闲'], taobaoUrl: 'https://s.taobao.com/search?q=基础棒球帽',
    taokouling: '￥基础棒球帽AI穿搭演示￥', favoriteCount: 25, basePopularity: 4.3, emoji: '🧢',
  },
  {
    id: 'ac-scarf-1', category: 'scarf', name: '格纹羊毛围巾', brand: 'VINTAGE', price: 129,
    originalPrice: 159, discountPrice: 109, imageUrl: '', tryonSlot: 'scarf', tryonEnabled: true,
    primaryColor: '#f0d3d0', secondaryColor: '#c98f8a', seasons: ['秋冬'], occasions: ['通勤', '日常'],
    styles: ['vintage'], keywords: ['复古'], taobaoUrl: 'https://s.taobao.com/search?q=格纹羊毛围巾',
    taokouling: '￥格纹羊毛围巾AI穿搭演示￥', favoriteCount: 36, basePopularity: 4.7, emoji: '🧣',
  },
  {
    id: 'ac-scarf-2', category: 'scarf', name: '轻纱丝巾', brand: 'ROMANCE', price: 89,
    originalPrice: 109, discountPrice: 75, imageUrl: '', tryonSlot: 'scarf', tryonEnabled: true,
    primaryColor: '#ffe0ef', secondaryColor: '#ffb3d9', seasons: ['春夏'], occasions: ['约会', '聚会'],
    styles: ['french', 'korean'], keywords: ['浪漫'], taobaoUrl: 'https://s.taobao.com/search?q=轻纱丝巾',
    taokouling: '￥轻纱丝巾AI穿搭演示￥', favoriteCount: 30, basePopularity: 4.5, emoji: '🎀',
  },
  {
    id: 'ac-scarf-3', category: 'scarf', name: '羊绒披肩', brand: 'WARM', price: 199,
    originalPrice: 239, discountPrice: 169, imageUrl: '', tryonSlot: 'scarf', tryonEnabled: false,
    primaryColor: '#f3ead6', secondaryColor: '#cbb488', seasons: ['秋冬'], occasions: ['通勤', '旅行'],
    styles: ['commute', 'vintage'], keywords: ['高级'], taobaoUrl: 'https://s.taobao.com/search?q=羊绒披肩',
    taokouling: '￥羊绒披肩AI穿搭演示￥', favoriteCount: 22, basePopularity: 4.4, emoji: '🧥',
  },
  {
    id: 'ac-belt-1', category: 'belt', name: '细款通勤腰带', brand: 'COMMUTE', price: 119,
    originalPrice: 139, discountPrice: 99, imageUrl: '', tryonSlot: 'belt', tryonEnabled: true,
    primaryColor: '#d8c3a5', secondaryColor: '#a9885c', seasons: ['四季'], occasions: ['通勤', '日常'],
    styles: ['commute'], keywords: ['收腰'], taobaoUrl: 'https://s.taobao.com/search?q=细款通勤腰带',
    taokouling: '￥细款通勤腰带AI穿搭演示￥', favoriteCount: 26, basePopularity: 4.4, emoji: '🪢',
  },
  {
    id: 'ac-belt-2', category: 'belt', name: '金属扣腰带', brand: 'CHIC', price: 149,
    originalPrice: 179, discountPrice: 129, imageUrl: '', tryonSlot: 'belt', tryonEnabled: false,
    primaryColor: '#e7e2f0', secondaryColor: '#b3a0d8', seasons: ['四季'], occasions: ['街头', '聚会'],
    styles: ['street', 'vintage'], keywords: ['金属'], taobaoUrl: 'https://s.taobao.com/search?q=金属扣腰带',
    taokouling: '￥金属扣腰带AI穿搭演示￥', favoriteCount: 23, basePopularity: 4.3, emoji: '🔗',
  },
  {
    id: 'ac-belt-3', category: 'belt', name: '编织腰带', brand: 'NATURAL', price: 99,
    originalPrice: 119, discountPrice: 84, imageUrl: '', tryonSlot: 'belt', tryonEnabled: true,
    primaryColor: '#c9a27e', secondaryColor: '#8f6744', seasons: ['春夏'], occasions: ['旅行', '日常'],
    styles: ['street', 'vintage'], keywords: ['自然'], taobaoUrl: 'https://s.taobao.com/search?q=编织腰带',
    taokouling: '￥编织腰带AI穿搭演示￥', favoriteCount: 20, basePopularity: 4.2, emoji: '🧶',
  },
  {
    id: 'ac-shoes-1', category: 'shoes', name: '厚底小白鞋', brand: 'STREET', price: 359,
    originalPrice: 429, discountPrice: 309, imageUrl: '', tryonSlot: 'shoes', tryonEnabled: true,
    primaryColor: '#f2f2f5', secondaryColor: '#d8d8e0', seasons: ['四季'], occasions: ['街头', '日常', '旅行'],
    styles: ['street', 'sport'], keywords: ['百搭'], taobaoUrl: 'https://s.taobao.com/search?q=厚底小白鞋',
    taokouling: '￥厚底小白鞋AI穿搭演示￥', favoriteCount: 42, basePopularity: 4.8, emoji: '👟',
  },
  {
    id: 'ac-shoes-2', category: 'shoes', name: '玛丽珍单鞋', brand: 'SWEET', price: 289,
    originalPrice: 339, discountPrice: 249, imageUrl: '', tryonSlot: 'shoes', tryonEnabled: true,
    primaryColor: '#ffdfe9', secondaryColor: '#ff9ec2', seasons: ['春夏'], occasions: ['约会', '聚会', '日常'],
    styles: ['french', 'korean'], keywords: ['甜美'], taobaoUrl: 'https://s.taobao.com/search?q=玛丽珍单鞋',
    taokouling: '￥玛丽珍单鞋AI穿搭演示￥', favoriteCount: 35, basePopularity: 4.6, emoji: '🥿',
  },
  {
    id: 'ac-shoes-3', category: 'shoes', name: '切尔西短靴', brand: 'COMMUTE', price: 429,
    originalPrice: 499, discountPrice: 379, imageUrl: '', tryonSlot: 'shoes', tryonEnabled: false,
    primaryColor: '#4a4a52', secondaryColor: '#2b2b31', seasons: ['秋冬'], occasions: ['通勤', '聚会'],
    styles: ['commute', 'vintage'], keywords: ['利落'], taobaoUrl: 'https://s.taobao.com/search?q=切尔西短靴',
    taokouling: '￥切尔西短靴AI穿搭演示￥', favoriteCount: 28, basePopularity: 4.5, emoji: '🥾',
  },
]

// 把配饰主色的 hex 转成中文色名，避免推荐理由里直接暴露 #eef1f6 这类色值
function colorName(hex: string): string {
  const matched = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!matched) return '同色'
  const int = parseInt(matched[1], 16)
  const r = (int >> 16) / 255
  const g = ((int >> 8) & 255) / 255
  const b = (int & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  const delta = max - min
  if (delta < 0.05) {
    if (lightness > 0.85) return '白'
    if (lightness > 0.6) return '浅灰'
    return lightness > 0.25 ? '深灰' : '黑'
  }
  let hue = 0
  if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60
  else if (max === g) hue = ((b - r) / delta + 2) * 60
  else hue = ((r - g) / delta + 4) * 60
  let name = '粉'
  if (hue < 12 || hue >= 345) name = lightness > 0.8 ? '粉' : '红'
  else if (hue < 40) name = '橙'
  else if (hue < 70) name = '黄'
  else if (hue < 165) name = '绿'
  else if (hue < 200) name = '青'
  else if (hue < 260) name = '蓝'
  else if (hue < 300) name = '紫'
  const prefix = lightness > 0.78 ? '浅' : lightness < 0.4 ? '深' : ''
  return `${prefix}${name}`
}

const HOT_COMBO_THEMES = [
  { id: 'local-hot-1', title: '轻盈约会组合', occasions: ['约会', '聚会'], styles: ['french', 'korean'] },
  { id: 'local-hot-2', title: '利落通勤组合', occasions: ['通勤'], styles: ['commute', 'vintage'] },
  { id: 'local-hot-3', title: '街头个性组合', occasions: ['街头', '旅行'], styles: ['street', 'sport'] },
]

type HotComboTheme = (typeof HOT_COMBO_THEMES)[number]

// 按主题的场合/风格命中度挑选，命中度相同再看人气，保证三档组合内容真正不同
function pickThemeItem(category: string, theme: HotComboTheme) {
  const themeScore = (item: LocalAccessory) =>
    theme.occasions.filter((occasion) => item.occasions.includes(occasion)).length * 2 +
    theme.styles.filter((style) => item.styles.includes(style)).length
  return LOCAL_ACCESSORIES
    .filter((item) => item.category === category)
    .sort((a, b) => themeScore(b) - themeScore(a) || b.basePopularity - a.basePopularity)[0]
}

function loadRatings(): Record<string, number> {
  try {
    return JSON.parse(uni.getStorageSync(RATINGS_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveLocalAccessoryRating(id: string, score: number) {
  const ratings = loadRatings()
  ratings[id] = score
  uni.setStorageSync(RATINGS_KEY, JSON.stringify(ratings))
}

function scoreItem(item: LocalAccessory, outfit: AccessoryContextItem[], ratings: Record<string, number>) {
  const anchor = outfit[0] || {}
  const seasons = outfit.map((piece) => piece.season).filter((season): season is string => !!season)
  const occasions = outfit.flatMap((piece) => piece.occasions || [])
  const styles = outfit.flatMap((piece) => piece.styles || [])
  const colorHits = (outfit.flatMap((piece) => piece.colors || []).length)
  const seasonHit = seasons.some((season) => item.seasons.includes(season) || item.seasons.includes('四季'))
  const occasionHit = occasions.filter((occasion) => item.occasions.includes(occasion)).length
  const styleHit = styles.filter((style) => item.styles.includes(style)).length
  const userRating = ratings[item.id] || 0
  const score = Math.round(
    54 +
    Math.min(colorHits, 12) +
    (seasonHit ? 15 : 0) +
    Math.min(occasionHit * 8, 16) +
    Math.min(styleHit * 5, 10) +
    (userRating ? (userRating - 3) * 4 : 0) +
    (item.basePopularity - 3.5) * 5,
  )
  const reasons = [
    `${colorName(item.primaryColor)}色系可呼应当前服装整体氛围`,
    seasonHit ? '与当前服装季节一致' : '可根据当前服装替换季节',
    occasionHit ? `适合「${item.occasions.join('、')}」场合` : '可与其他风格搭配',
  ]
  return {
    ...item,
    categoryLabel: CATEGORY_LABELS[item.category],
    userRating: userRating || null,
    aggregateRating: item.basePopularity,
    ratingCount: item.favoriteCount,
    matchScore: Math.max(24, Math.min(100, score)),
    matchReason: reasons.slice(0, 2).join('；'),
    matchReasons: reasons,
  }
}

export function buildFallbackRecommendations(
  outfit: AccessoryContextItem[],
): AccessoryRecommendations {
  const ratings = loadRatings()
  const categories = Object.keys(CATEGORY_LABELS).map((key) => ({
    key,
    label: CATEGORY_LABELS[key],
    items: LOCAL_ACCESSORIES
      .filter((item) => item.category === key)
      .map((item) => scoreItem(item, outfit, ratings))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5),
  }))
  const hotCombos = HOT_COMBO_THEMES.map((theme) => {
    const items = Object.keys(CATEGORY_LABELS)
      .map((category) => pickThemeItem(category, theme))
      .filter(Boolean)
    const avgScore = items.length
      ? items.reduce((sum, item) => sum + item.basePopularity, 0) / items.length
      : 3.5
    return {
      id: theme.id,
      title: theme.title,
      subtitle: '本地演示数据',
      score: Number(avgScore.toFixed(1)),
      favoriteCount: items.reduce((sum, item) => sum + item.favoriteCount, 0),
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        categoryLabel: CATEGORY_LABELS[item.category],
        imageUrl: '',
        emoji: item.emoji,
        from: item.primaryColor,
        to: item.secondaryColor,
        aggregateRating: item.basePopularity,
        ratingCount: item.favoriteCount,
      })),
    }
  })
  return {
    source: 'local',
    currentOutfit: {
      anchor: {
        id: outfit[0]?.id || '',
        name: outfit[0]?.name || '当前服装',
        category: outfit[0]?.category || '',
        categoryLabel: CATEGORY_LABELS[outfit[0]?.category] || outfit[0]?.category || '服装',
      },
      colors: outfit.flatMap((piece) => piece.colors || []),
      seasons: outfit.map((piece) => piece.season || '').filter(Boolean),
      occasions: outfit.flatMap((piece) => piece.occasions || []),
      styles: outfit.flatMap((piece) => piece.styles || []),
      garmentIds: outfit.map((piece) => piece.id).filter(Boolean),
    },
    categories,
    discountEligible: false,
    hotCombos,
  }
}

export function loadLocalAccessoryCart(): AccessoryCart {
  // 形状要和服务端购物车一致（规格 §4.5 §13），否则断网回退时
  // 页面上的合计、下架标记这些字段会突然变 undefined。
  const empty: AccessoryCart = { items: [], count: 0, totalPrice: 0 }
  try {
    const saved = JSON.parse(uni.getStorageSync(CART_KEY) || 'null')
    if (!saved?.items) return empty
    return {
      items: saved.items,
      count: saved.count ?? 0,
      totalPrice: saved.totalPrice ?? 0,
    }
  } catch {
    return empty
  }
}

export function saveLocalAccessoryCart(cart: AccessoryCart) {
  uni.setStorageSync(CART_KEY, JSON.stringify(cart))
}
