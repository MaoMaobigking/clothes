/**
 * 场景模拟领域的固定配置表。
 *
 * 从 services/sceneService.mjs 迁出（第 4 条规矩：数据与逻辑分离）。
 * SCENE_DEFINITIONS 决定「有哪些场景、每个场景要哪些槽位」，
 * WEATHER_* 两张表只在没有 OpenWeather key 时给降级天气用 —— 都是查表数据，
 * 不该和搭配生成算法挤在一个文件里。
 */
/*
 * 十个场景（客户实拍素材版）。
 *
 * 原先是 daily/business/date/travel/academy/cosplay 六个抽象场景。客户交付的
 * 素材是十个具体地点（通勤 + 社交两条线），「学院风」「cosplay」压根没有对应
 * 场景，所以这张表跟着素材重建。key 必须和前端 constants/scene.ts 的
 * SceneKey、seeds/scene-catalog.json 的 sceneKey 完全一致 —— 三者是一套 key。
 *
 * slots 从原来的 4-5 个收到 3 个：scene_catalog 只有 30 件人工维护的新品，
 * 分到十个场景就是每场景 3 件。slots 开得比库存多也不会报错（planner 会
 * 回落到用户自己的衣服），但混搭方案里能补的缺槽会变少，不如按库存定。
 */
export const SCENE_DEFINITIONS = [
  {
    key: 'subway',
    label: '地铁通勤',
    keywords: ['通勤', '利落', '耐挤'],
    slots: ['top', 'pants', 'shoes'],
  },
  {
    key: 'station',
    label: '车站出行',
    keywords: ['轻便', '好走', '出行'],
    slots: ['top', 'pants', 'bag'],
  },
  {
    key: 'desk',
    label: '工位日常',
    keywords: ['久坐', '舒适', '得体'],
    slots: ['top', 'pants', 'shoes'],
  },
  {
    key: 'meeting',
    label: '会议室',
    keywords: ['正式', '利落', '专业'],
    slots: ['top', 'bag', 'shoes'],
  },
  {
    key: 'restaurant',
    label: '西餐厅',
    keywords: ['精致', '约会', '浪漫'],
    slots: ['dress', 'bag', 'accessory'],
  },
  {
    key: 'lobby',
    label: '酒店大厅',
    keywords: ['商务', '社交', '体面'],
    slots: ['top', 'shoes', 'bag'],
  },
  {
    key: 'cafe',
    label: '咖啡厅',
    keywords: ['休闲', '松弛', '百搭'],
    slots: ['top', 'shoes', 'accessory'],
  },
  {
    key: 'terrace',
    label: '露天餐厅',
    keywords: ['度假', '轻盈', '户外'],
    slots: ['skirt', 'shoes', 'hat'],
  },
  {
    key: 'banquet',
    label: '宴会厅',
    keywords: ['隆重', '礼服', '晚宴'],
    slots: ['dress', 'shoes', 'jewelry'],
  },
  {
    key: 'bar',
    label: '酒吧',
    keywords: ['夜场', '个性', '吸睛'],
    slots: ['top', 'skirt', 'shoes'],
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
