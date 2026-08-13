export interface WardrobeOption {
  key: string
  label: string
  emoji?: string
  color?: string
}

export const WARDROBE_CATEGORIES: WardrobeOption[] = [
  { key: 'top', label: '上衣', emoji: '👕' },
  { key: 'pants', label: '下装', emoji: '👖' },
  { key: 'skirt', label: '半身裙', emoji: '👗' },
  { key: 'dress', label: '连体装', emoji: '🥻' },
  { key: 'shoes', label: '鞋', emoji: '👟' },
  { key: 'bag', label: '包', emoji: '👜' },
  { key: 'hat', label: '帽子', emoji: '🧢' },
  { key: 'jewelry', label: '首饰', emoji: '💍' },
  { key: 'accessory', label: '配饰', emoji: '🧣' },
]

export const WARDROBE_SEASONS: WardrobeOption[] = [
  { key: 'spring', label: '春', emoji: '🌸' },
  { key: 'summer', label: '夏', emoji: '☀️' },
  { key: 'autumn', label: '秋', emoji: '🍂' },
  { key: 'winter', label: '冬', emoji: '❄️' },
]

export const WARDROBE_OCCASIONS: WardrobeOption[] = [
  { key: 'daily', label: '日常', emoji: '🛋️' },
  { key: 'work', label: '通勤', emoji: '💼' },
  { key: 'date', label: '约会', emoji: '💐' },
  { key: 'travel', label: '旅行', emoji: '🧳' },
  { key: 'sport', label: '运动', emoji: '🏃' },
  { key: 'party', label: '聚会', emoji: '🎉' },
]

export const WARDROBE_COLORS: WardrobeOption[] = [
  { key: '#4f5668', label: '炭黑', color: '#4f5668' },
  { key: '#d9e2ee', label: '雾灰', color: '#d9e2ee' },
  { key: '#f1e7d8', label: '米白', color: '#f1e7d8' },
  { key: '#d16f5f', label: '砖红', color: '#d16f5f' },
  { key: '#b6a6d8', label: '香芋紫', color: '#b6a6d8' },
  { key: '#88c7b5', label: '薄荷绿', color: '#88c7b5' },
  { key: '#9d5c50', label: '焦糖棕', color: '#9d5c50' },
  { key: '#f0b7c1', label: '樱花粉', color: '#f0b7c1' },
  { key: '#c9d2dd', label: '浅蓝', color: '#c9d2dd' },
  { key: '#6e7c91', label: '雾霾蓝', color: '#6e7c91' },
]

export function categoryLabel(key?: string) {
  return WARDROBE_CATEGORIES.find((item) => item.key === key)?.label || key || '未分类'
}

export function seasonLabel(key?: string) {
  return WARDROBE_SEASONS.find((item) => item.key === key)?.label || key || '四季'
}

export function occasionLabel(key?: string) {
  return WARDROBE_OCCASIONS.find((item) => item.key === key)?.label || key || '不限场景'
}

export function colorLabel(key?: string) {
  return WARDROBE_COLORS.find((item) => item.key === key)?.label || key || '未知颜色'
}
