/**
 * 场景模拟领域的固定配置表。
 *
 * 从 services/sceneService.mjs 迁出（第 4 条规矩：数据与逻辑分离）。
 * SCENE_DEFINITIONS 决定「有哪些场景、每个场景要哪些槽位」，
 * WEATHER_* 两张表只在没有 OpenWeather key 时给降级天气用 —— 都是查表数据，
 * 不该和搭配生成算法挤在一个文件里。
 */
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

export const WEATHER_CITIES = [
  { name: '杭州', latitude: 30.2741, longitude: 120.1551 },
  { name: '重庆', latitude: 29.563, longitude: 106.5516 },
  { name: '上海', latitude: 31.2304, longitude: 121.4737 },
  { name: '北京', latitude: 39.9042, longitude: 116.4074 },
  { name: '广州', latitude: 23.1291, longitude: 113.2644 },
]

export const WEATHER_CONDITIONS = [
  { condition: '晴', icon: '☀️' },
  { condition: '多云', icon: '⛅' },
  { condition: '小雨', icon: '🌦️' },
  { condition: '阴', icon: '☁️' },
]
