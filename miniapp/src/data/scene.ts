export type SceneKey =
  | 'daily'
  | 'business'
  | 'date'
  | 'travel'
  | 'academy'
  | 'cosplay'

export type SceneMode = 'pure' | 'mixed'
export type SceneFilterKey = 'day' | 'night' | 'indoor' | 'outdoor'

export interface SceneOption {
  key: SceneKey
  label: string
  emoji: string
  keywords: string[]
  img: string
  from: string
  to: string
}

export const SCENE_OPTIONS: SceneOption[] = [
  {
    key: 'daily',
    label: '日常休闲',
    emoji: '🛋️',
    keywords: ['舒适', '百搭', '休闲'],
    img: '/static/images/scene/daily.jpg',
    from: '#f3ead6',
    to: '#cbb488',
  },
  {
    key: 'business',
    label: '商务正装',
    emoji: '💼',
    keywords: ['通勤', '利落', '正式'],
    img: '/static/images/scene/business.jpg',
    from: '#d6e4f0',
    to: '#8fa9c9',
  },
  {
    key: 'date',
    label: '约会聚会',
    emoji: '💕',
    keywords: ['浪漫', '精致', '社交'],
    img: '/static/images/scene/date.jpg',
    from: '#ffd6e8',
    to: '#d6a0ff',
  },
  {
    key: 'travel',
    label: '旅行度假',
    emoji: '🏝️',
    keywords: ['轻便', '防晒', '度假'],
    img: '/static/images/scene/travel.jpg',
    from: '#d9ece6',
    to: '#7fc0b0',
  },
  {
    key: 'academy',
    label: '学院风',
    emoji: '🎓',
    keywords: ['复古', '学院', '减龄'],
    img: '/static/images/scene/academy.jpg',
    from: '#efe0f0',
    to: '#c29ad6',
  },
  {
    key: 'cosplay',
    label: 'cosplay',
    emoji: '🎭',
    keywords: ['造型', '戏剧', '个性'],
    img: '/static/images/scene/cosplay.jpg',
    from: '#4a4a52',
    to: '#8d8d9b',
  },
]

export const SCENE_SEASONS = ['春季', '夏季', '秋季', '冬季'] as const

export const SCENE_FILTERS: { key: SceneFilterKey; label: string }[] = [
  { key: 'day', label: '白天' },
  { key: 'night', label: '夜晚' },
  { key: 'indoor', label: '室内' },
  { key: 'outdoor', label: '户外' },
]

/**
 * 四档滤镜的遮罩色（规格 §10.9）。
 *
 * 页面上的舞台和导出的海报用同一组值，切滤镜只改这一层 ——
 * 底图、人台、衣物都不动，「切换滤镜衣服不变」这条才成立。
 * 两段 rgba 是为了让 canvas 也能画：CSS 的 linear-gradient 字符串
 * canvas 认不了，只能拆成起止色自己 createLinearGradient。
 */
export const SCENE_FILTER_OVERLAYS: Record<SceneFilterKey, [string, string]> = {
  day: ['rgba(255,255,255,0.12)', 'rgba(255,207,145,0.22)'],
  night: ['rgba(14,15,36,0.52)', 'rgba(82,53,137,0.35)'],
  indoor: ['rgba(255,235,220,0.46)', 'rgba(179,165,145,0.2)'],
  outdoor: ['rgba(116,196,255,0.28)', 'rgba(182,240,176,0.2)'],
}

/** 海报缺场景底图时的兜底底色，和滤镜同一套色系 */
export const SCENE_FILTER_GRADIENTS: Record<SceneFilterKey, [string, string]> = {
  day: ['#fff5df', '#ffc7d5'],
  night: ['#17182b', '#4a3576'],
  indoor: ['#f7ead8', '#c7b39b'],
  outdoor: ['#cceeff', '#b6e6c0'],
}

export function sceneFilterStyle(key: SceneFilterKey) {
  const [from, to] = SCENE_FILTER_OVERLAYS[key]
  return `linear-gradient(135deg, ${from}, ${to})`
}

export const MANUAL_WEATHER = [
  { city: '杭州', temp: 28, condition: '晴', icon: '☀️' },
  { city: '重庆', temp: 23, condition: '多云', icon: '⛅' },
  { city: '上海', temp: 27, condition: '小雨', icon: '🌦️' },
  { city: '北京', temp: 24, condition: '阴', icon: '☁️' },
]

export function currentSeason(): typeof SCENE_SEASONS[number] {
  const month = new Date().getMonth() + 1
  if (month >= 3 && month <= 5) return '春季'
  if (month >= 6 && month <= 8) return '夏季'
  if (month >= 9 && month <= 11) return '秋季'
  return '冬季'
}

