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
    img: '/static/images/scene/daily.png',
    from: '#f3ead6',
    to: '#cbb488',
  },
  {
    key: 'business',
    label: '商务正装',
    emoji: '💼',
    keywords: ['通勤', '利落', '正式'],
    img: '/static/images/scene/business.png',
    from: '#d6e4f0',
    to: '#8fa9c9',
  },
  {
    key: 'date',
    label: '约会聚会',
    emoji: '💕',
    keywords: ['浪漫', '精致', '社交'],
    img: '/static/images/scene/date.png',
    from: '#ffd6e8',
    to: '#d6a0ff',
  },
  {
    key: 'travel',
    label: '旅行度假',
    emoji: '🏝️',
    keywords: ['轻便', '防晒', '度假'],
    img: '/static/images/scene/travel.png',
    from: '#d9ece6',
    to: '#7fc0b0',
  },
  {
    key: 'academy',
    label: '学院风',
    emoji: '🎓',
    keywords: ['复古', '学院', '减龄'],
    img: '/static/images/scene/academy.png',
    from: '#efe0f0',
    to: '#c29ad6',
  },
  {
    key: 'cosplay',
    label: 'cosplay',
    emoji: '🎭',
    keywords: ['造型', '戏剧', '个性'],
    img: '/static/images/scene/cosplay.png',
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

