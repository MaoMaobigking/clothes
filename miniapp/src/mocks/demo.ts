/*
 * 演示用假数据 —— 只剩这三份。
 *
 * 判断标准很简单：这里的东西**不该出现在真实用户面前**，
 * 接了后端就该删。当前还留着是因为对应接口还没做：
 *   WEATHER       首页天气卡（真实天气在 api/scene 的 fetchSceneWeather，
 *                 但首页那张卡还没接过去）
 *   OUTFIT_RECOS  首页与 AI hub 的推荐位
 *   SCENES        自由搭配页的场景选择
 *
 * 静态配置（选项表、入口清单）已经拆到 @/constants/ui，别再往这里加。
 */
import type { Scene } from '@/types'

/*
 * GARMENTS / GARMENTS_RAW 已删除（本次重构）。
 *
 * 20 件写死的假衣服，约 250 行。衣橱早已走后端 /api/garments（见 api/wardrobe），
 * stores/wardrobe.ts 的初始值也明确是空数组 —— 规格 §4.3 禁止用假数据冒充
 * 真实衣橱。删除前全库零引用。
 * 别加回来：假衣服能被选进搭配，但服务端查无此物，后续操作必然 404。
 */

/* ----------------------------- 商城 ----------------------------- */

/*
 * MALL_PRODUCTS / MALL_CATEGORIES 已删除（批次 5，规格 §4.4 §10.6）。
 *
 * 商城商品改为服务端 scene_catalog，接口见 api/mall.ts，
 * 和功能四场景模拟共用一份目录 —— 价格、淘宝链接、淘口令只有一个来源，
 * 加购走 /api/cart 的 item_type='catalog'，购物车页查得到。
 * 别把 mock 商品加回来：服务端查无此物，加购必然 404。
 */

/* ----------------------------- 时尚杂志 ----------------------------- */

/*
 * MAGAZINES 已删除（批次 7，规格 §12.3 §12.4）。
 *
 * 六本写死的假期刊，唯一读它的 pages/magazine/index.vue 已下线成跳转壳。
 * 杂志内容现在来自服务端 community_contents，入口是「时尚社群」的
 * 杂志推送 tab（api/community.ts）。别把 mock 版加回来 ——
 * 两套杂志数据并存时，没人分得清页面上看到的是哪一份。
 */

/* ----------------------------- 时尚社群 ----------------------------- */

/*
 * Post / POSTS / HOT_TOPICS 已删除（本次重构）：全库零引用，约 97 行。
 * 社群内容现在来自服务端 community_contents（见 api/community）。
 */

/* ----------------------------- 天气 ----------------------------- */

export interface WeatherDay {
  day: string
  icon: string
  high: number
  low: number
}

export const WEATHER = {
  city: '重庆市渝北区',
  date: '6月8日',
  weekday: '星期日',
  temp: 23,
  condition: '暴雨',
  alert: '暴雨预警',
  icon: '🌧️',
  forecast: [
    { day: '星期一', icon: '⛅', high: 30, low: 22 },
    { day: '星期二', icon: '☁️', high: 28, low: 21 },
    { day: '星期三', icon: '🌦️', high: 29, low: 20 },
  ] as WeatherDay[],
}

/* ----------------------------- AI 搭配推荐 ----------------------------- */

export interface OutfitPiece {
  name: string
  emoji: string
  from: string
  to: string
  img: string
}

export interface OutfitReco {
  id: string
  title: string
  scene: string
  pieces: OutfitPiece[]
}
type RawPiece = Omit<OutfitPiece, 'img'>
type RawReco = { id: string; title: string; scene: string; pieces: RawPiece[] }

const OUTFIT_RECOS_RAW: RawReco[] = [
  {
    id: 'o1',
    title: '雨天通勤 · 防水利落',
    scene: 'work',
    pieces: [
      { name: '针织开衫', emoji: '🧶', from: '#f3ead6', to: '#d8c3a5' },
      { name: '背心马甲', emoji: '🦺', from: '#2f2f3a', to: '#54545f' },
      { name: '格纹衬衫', emoji: '👔', from: '#e7ecf5', to: '#b8c2d8' },
      { name: '红色手袋', emoji: '👜', from: '#ffb3b3', to: '#e0504f' },
      { name: '毛线帽', emoji: '🧢', from: '#ffd6c9', to: '#ff9e86' },
      { name: '切尔西靴', emoji: '🥾', from: '#4a4a52', to: '#2b2b31' },
    ],
  },
  {
    id: 'o2',
    title: '周末游玩 · 轻松减龄',
    scene: 'play',
    pieces: [
      { name: '牛仔外套', emoji: '🧥', from: '#b7c9e8', to: '#6f8ec4' },
      { name: '白色卫衣', emoji: '👕', from: '#ffffff', to: '#e7e7ef' },
      { name: '工装短裙', emoji: '👗', from: '#e8c39a', to: '#c98a52' },
      { name: '帆布包', emoji: '👜', from: '#e8e2d0', to: '#c3b48f' },
      { name: '厚底板鞋', emoji: '👟', from: '#e7e7ef', to: '#b8b8cf' },
    ],
  },
  {
    id: 'o3',
    title: '约会甜美 · 法式浪漫',
    scene: 'date',
    pieces: [
      { name: '泡泡袖衬衫', emoji: '👚', from: '#ffd9e6', to: '#ff9fc0' },
      { name: '碎花半裙', emoji: '👗', from: '#ffd6e8', to: '#d6a0ff' },
      { name: '玛丽珍鞋', emoji: '🥿', from: '#ffdfe9', to: '#ff9ec2' },
      { name: '珍珠耳饰', emoji: '🤍', from: '#fdf3f6', to: '#f2cdd8' },
    ],
  },
]
export const OUTFIT_RECOS: OutfitReco[] = OUTFIT_RECOS_RAW.map((r) => ({
  ...r,
  pieces: r.pieces.map((p, i) => ({ ...p, img: `/static/images/outfit/${r.id}-${i + 1}.jpg` })),
}))

/* ----------------------------- 场景 / 模式 / 工具 ----------------------------- */

/*
 * 六个场景，key 必须和 static/images/scene/ 下的文件名一一对应。
 * 之前这里是 play/work/sport/party，磁盘上根本没有这四张图，
 * SCENES 一旦被渲染就是四个裂图。改成规格 §10.2 的六场景，和素材对齐。
 */
const SCENES_RAW: Omit<Scene, 'img'>[] = [
  { key: 'daily', label: '日常休闲', emoji: '☕' },
  { key: 'business', label: '商务正装', emoji: '💼' },
  { key: 'date', label: '约会聚会', emoji: '💕' },
  { key: 'travel', label: '旅行度假', emoji: '🧳' },
  { key: 'academy', label: '学院风', emoji: '🎓' },
  { key: 'cosplay', label: 'cosplay', emoji: '🎭' },
]
export const SCENES: Scene[] = SCENES_RAW.map((s) => ({
  ...s,
  img: `/static/images/scene/${s.key}.jpg`,
}))

/*
 * SCENE_MODES 已删除（本次重构）：全库零引用。
 * 情景模拟的模式定义现在在 data/scene.ts 的 SCENE_FILTERS。
 */
