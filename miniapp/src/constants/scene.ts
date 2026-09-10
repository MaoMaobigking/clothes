/*
 * 十个场景，key 必须和 static/images/scene/ 下的文件名一一对应。
 *
 * 原先是 daily/business/date/travel/academy/cosplay 六个抽象场景，配的是脚本
 * 抓来的占位图。客户交付的实拍素材是十个具体地点（通勤 + 社交两条线），
 * 语义对不上——「学院风」「cosplay」在这批素材里压根没有对应场景——所以
 * 场景表跟着素材重建。后端 constants/scene.mjs 的 SCENE_DEFINITIONS 和
 * seeds/scene-catalog.json 的 sceneKey 必须同步，三者是一套 key。
 */
export type SceneKey =
  'subway' | 'station' | 'desk' | 'meeting' | 'restaurant' | 'lobby' | 'cafe' | 'terrace' | 'banquet' | 'bar'

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
    key: 'subway',
    label: '地铁通勤',
    emoji: '🚇',
    keywords: ['通勤', '利落', '耐挤'],
    img: '/static/images/scene/subway.jpg',
    from: '#dfe6f0',
    to: '#9aa8c0',
  },
  {
    key: 'station',
    label: '车站出行',
    emoji: '🚉',
    keywords: ['轻便', '好走', '出行'],
    img: '/static/images/scene/station.jpg',
    from: '#e0ecf5',
    to: '#94b6cf',
  },
  {
    key: 'desk',
    label: '工位日常',
    emoji: '💻',
    keywords: ['久坐', '舒适', '得体'],
    img: '/static/images/scene/desk.jpg',
    from: '#eef0e8',
    to: '#b3bda0',
  },
  {
    key: 'meeting',
    label: '会议室',
    emoji: '📊',
    keywords: ['正式', '利落', '专业'],
    img: '/static/images/scene/meeting.jpg',
    from: '#dde3ec',
    to: '#8b9bb5',
  },
  {
    key: 'restaurant',
    label: '西餐厅',
    emoji: '🍽️',
    keywords: ['精致', '约会', '浪漫'],
    img: '/static/images/scene/restaurant.jpg',
    from: '#f5e2dd',
    to: '#c99a92',
  },
  {
    key: 'lobby',
    label: '酒店大厅',
    emoji: '🏨',
    keywords: ['商务', '社交', '体面'],
    img: '/static/images/scene/lobby.jpg',
    from: '#f0e8dc',
    to: '#bfa889',
  },
  {
    key: 'cafe',
    label: '咖啡厅',
    emoji: '☕',
    keywords: ['休闲', '松弛', '百搭'],
    img: '/static/images/scene/cafe.jpg',
    from: '#f3ead6',
    to: '#cbb488',
  },
  {
    key: 'terrace',
    label: '露天餐厅',
    emoji: '🌿',
    keywords: ['度假', '轻盈', '户外'],
    img: '/static/images/scene/terrace.jpg',
    from: '#e2efe4',
    to: '#93bfa0',
  },
  {
    key: 'banquet',
    label: '宴会厅',
    emoji: '🥂',
    keywords: ['隆重', '礼服', '晚宴'],
    img: '/static/images/scene/banquet.jpg',
    from: '#efe0f0',
    to: '#b98fc4',
  },
  {
    key: 'bar',
    label: '酒吧',
    emoji: '🍸',
    keywords: ['夜场', '个性', '吸睛'],
    img: '/static/images/scene/bar.jpg',
    from: '#2f2f3a',
    to: '#6b5a7a',
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

export function currentSeason(): (typeof SCENE_SEASONS)[number] {
  const month = new Date().getMonth() + 1
  if (month >= 3 && month <= 5) return '春季'
  if (month >= 6 && month <= 8) return '夏季'
  if (month >= 9 && month <= 11) return '秋季'
  return '冬季'
}
