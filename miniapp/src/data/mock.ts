/*
 * 全站 mock 数据 —— 从 src/data/mock.ts 迁移
 * 图片路径适配为 miniapp static 目录
 */
import type { IconName } from '@/utils/icons'

/** App logo */
export const LOGO = '/static/images/logo.png'

/** 虚拟形象模特图 */
export const MODEL_IMAGES = {
  front: '/static/images/model/front.jpg',
  frontMale: '/static/images/model/front-male.jpg',
  outfit: '/static/images/model/outfit.jpg',
  /** 百炼官方示例人像（720×1280，AI 试衣出图质量有保证） */
  official: '/static/images/tryon/person.jpg',
}

/*
 * 发型选项。
 * 必须显式给 icon：💇‍♀️（直发）和 💇‍♂️（短发）去掉 ZWJ 后都是 💇，
 * 走 iconForEmoji 查表会撞成同一个图标。
 */
export const HAIR_STYLES: { id: string; label: string; emoji: string; icon: IconName }[] = [
  { id: 'straight', label: '直发', emoji: '💇‍♀️', icon: 'hair-straight' },
  { id: 'curly', label: '卷发', emoji: '🦱', icon: 'hair-curly' },
  { id: 'bun', label: '丸子头', emoji: '👱‍♀️', icon: 'hair-bun' },
  { id: 'short', label: '短发', emoji: '💇‍♂️', icon: 'hair-short' },
]

/* ----------------------------- 衣橱 / 衣物 ----------------------------- */

export interface Garment {
  id: string
  name: string
  category: string
  brand: string
  emoji: string
  from: string
  to: string
  price: number
  season: string
  img: string
  tags?: string[]
  primaryColor?: string
  secondaryColors?: string[]
  seasons?: string[]
  occasions?: string[]
  frequentlyWorn?: boolean
  sortOrder?: number
  recognitionStatus?: string
  recognitionSource?: string
  uploadedAt?: string
}
type RawGarment = Omit<Garment, 'img'> & { img?: string }

export const CLOSET_CATEGORIES: { key: string; label: string; emoji: string }[] = [
  { key: 'all', label: '全部', emoji: '🗂️' },
  { key: 'top', label: '上衣', emoji: '👕' },
  { key: 'pants', label: '裤子', emoji: '👖' },
  { key: 'skirt', label: '半身裙', emoji: '👗' },
  { key: 'dress', label: '连体装', emoji: '🥻' },
  { key: 'shoes', label: '鞋', emoji: '👟' },
  { key: 'bag', label: '包', emoji: '👜' },
  { key: 'hat', label: '帽子', emoji: '🧢' },
  { key: 'jewelry', label: '首饰', emoji: '💍' },
  { key: 'accessory', label: '配饰', emoji: '🧣' },
]

const GARMENTS_RAW: RawGarment[] = [
  {
    id: 'g1',
    name: '宽松工装外套',
    category: 'top',
    brand: 'BASIC',
    emoji: '🧥',
    from: '#a6c8ff',
    to: '#5f8bff',
    price: 329,
    season: '秋冬',
    tags: ['街头', '百搭'],
  },
  {
    id: 'g2',
    name: '毛领派克大衣',
    category: 'top',
    brand: 'WARM',
    emoji: '🧥',
    from: '#f6d9b8',
    to: '#c99a6b',
    price: 599,
    season: '秋冬',
    tags: ['保暖'],
  },
  {
    id: 'g3',
    name: '基础白T',
    category: 'top',
    brand: 'DAILY',
    emoji: '👕',
    from: '#ffffff',
    to: '#e7e7ef',
    price: 89,
    season: '四季',
    tags: ['基础款'],
  },
  {
    id: 'g4',
    name: '法式泡泡袖衬衫',
    category: 'top',
    brand: 'ROMANCE',
    emoji: '👚',
    from: '#ffd9e6',
    to: '#ff9fc0',
    price: 219,
    season: '春夏',
    tags: ['法式', '甜美'],
  },
  {
    id: 'g5',
    name: '直筒西装裤',
    category: 'pants',
    brand: 'COMMUTE',
    emoji: '👖',
    from: '#cfd4e6',
    to: '#8a90ad',
    price: 259,
    season: '四季',
    tags: ['通勤'],
  },
  {
    id: 'g6',
    name: '水洗牛仔裤',
    category: 'pants',
    brand: 'DENIM',
    emoji: '👖',
    from: '#b7c9e8',
    to: '#6f8ec4',
    price: 199,
    season: '四季',
    tags: ['耐穿'],
  },
  {
    id: 'g7',
    name: '灯芯绒半裙',
    category: 'skirt',
    brand: 'VINTAGE',
    emoji: '👗',
    from: '#e8c39a',
    to: '#c98a52',
    price: 179,
    season: '秋冬',
    tags: ['复古'],
  },
  {
    id: 'g8',
    name: '百褶短裙',
    category: 'skirt',
    brand: 'SWEET',
    emoji: '👗',
    from: '#ffe0ef',
    to: '#ffb3d9',
    price: 149,
    season: '春夏',
    tags: ['韩系'],
  },
  {
    id: 'g9',
    name: '碎花连衣裙',
    category: 'dress',
    brand: 'ROMANCE',
    emoji: '🥻',
    from: '#ffd6e8',
    to: '#d6a0ff',
    price: 399,
    season: '春夏',
    tags: ['茶歇', '法式'],
  },
  {
    id: 'g10',
    name: '机能束脚连体裤',
    category: 'dress',
    brand: 'TECH',
    emoji: '🩱',
    from: '#b8ecdf',
    to: '#5fc9b0',
    price: 429,
    season: '四季',
    tags: ['运动'],
  },
  {
    id: 'g11',
    name: '厚底板鞋',
    category: 'shoes',
    brand: 'STREET',
    emoji: '👟',
    from: '#e7e7ef',
    to: '#b8b8cf',
    price: 359,
    season: '四季',
    tags: ['街头'],
  },
  {
    id: 'g12',
    name: '玛丽珍单鞋',
    category: 'shoes',
    brand: 'SWEET',
    emoji: '🥿',
    from: '#ffdfe9',
    to: '#ff9ec2',
    price: 289,
    season: '春夏',
    tags: ['甜美'],
  },
  {
    id: 'g13',
    name: '通勤托特包',
    category: 'bag',
    brand: 'COMMUTE',
    emoji: '👜',
    from: '#d8c3a5',
    to: '#a9885c',
    price: 469,
    season: '四季',
    tags: ['大容量'],
  },
  {
    id: 'g14',
    name: '红色链条包',
    category: 'bag',
    brand: 'CHIC',
    emoji: '👛',
    from: '#ffb3b3',
    to: '#e0504f',
    price: 359,
    season: '四季',
    tags: ['点睛'],
  },
  {
    id: 'g15',
    name: '针织毛线帽',
    category: 'hat',
    brand: 'WARM',
    emoji: '🧢',
    from: '#ffd6c9',
    to: '#ff9e86',
    price: 79,
    season: '秋冬',
    tags: ['保暖'],
  },
  {
    id: 'g16',
    name: '银色耳夹',
    category: 'jewelry',
    brand: 'GLOW',
    emoji: '💍',
    from: '#eef1f6',
    to: '#c3ccdb',
    price: 84,
    season: '四季',
    tags: ['精致'],
  },
  {
    id: 'g17',
    name: '格纹羊毛围巾',
    category: 'accessory',
    brand: 'VINTAGE',
    emoji: '🧣',
    from: '#f0d3d0',
    to: '#c98f8a',
    price: 129,
    season: '秋冬',
    tags: ['复古'],
  },
  {
    id: 'g18',
    name: '羊羔毛夹克',
    category: 'top',
    brand: 'WARM',
    emoji: '🧥',
    from: '#f3ead6',
    to: '#cbb488',
    price: 519,
    season: '秋冬',
    tags: ['保暖'],
  },
  {
    id: 'g19',
    name: '官方示例 · 短袖上衣',
    category: 'top',
    brand: 'BAILIAN',
    emoji: '👕',
    from: '#ffffff',
    to: '#e7e7ef',
    price: 0,
    season: '四季',
    tags: ['官方素材', 'AI试衣'],
    img: '/static/images/tryon/top.jpeg',
  },
  {
    id: 'g20',
    name: '官方示例 · 直筒长裤',
    category: 'pants',
    brand: 'BAILIAN',
    emoji: '👖',
    from: '#cfd4e6',
    to: '#8a90ad',
    price: 0,
    season: '四季',
    tags: ['官方素材', 'AI试衣'],
    img: '/static/images/tryon/bottom.jpeg',
  },
]
export const GARMENTS: Garment[] = GARMENTS_RAW.map((g) => ({
  ...g,
  img: g.img || `/static/images/closet/${g.id}.jpg`,
}))

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

export interface Post {
  id: string
  author: string
  avatar: string
  text: string
  likes: number
  comments: number
  emoji: string
  from: string
  to: string
  topic: string
  img: string
}
type RawPost = Omit<Post, 'img'>

export const HOT_TOPICS: string[] = ['#秀场解析', '#风格塑造', '#通勤穿搭', '#旧衣改造', '#显瘦公式']

const POSTS_RAW: RawPost[] = [
  {
    id: 'p1',
    author: '小鱼要暴富',
    avatar: '🐟',
    text: '155 小个子秋冬这样穿显高 10cm，姐妹冲！',
    likes: 1289,
    comments: 96,
    emoji: '🧥',
    from: '#d6e4f0',
    to: '#9ab6d8',
    topic: '显瘦公式',
  },
  {
    id: 'p2',
    author: 'Ariel',
    avatar: '🧜‍♀️',
    text: '把去年的旧毛衣改成了马甲，成本 0 元',
    likes: 864,
    comments: 52,
    emoji: '♻️',
    from: '#e3f0e6',
    to: '#9fceb0',
    topic: '旧衣改造',
  },
  {
    id: 'p3',
    author: '通勤小圈',
    avatar: '💼',
    text: '一周五天不重样的通勤 look 分享',
    likes: 2033,
    comments: 141,
    emoji: '👔',
    from: '#e7e2f0',
    to: '#b3a0d8',
    topic: '通勤穿搭',
  },
  {
    id: 'p4',
    author: 'vintage鱼',
    avatar: '🕰️',
    text: '复古格纹 + 皮革，秋天的第一套',
    likes: 597,
    comments: 33,
    emoji: '🧣',
    from: '#f0e0d6',
    to: '#c9a07e',
    topic: '风格塑造',
  },
  {
    id: 'p5',
    author: '甜辣本辣',
    avatar: '🌶️',
    text: '甜辣风穿搭教科书，收藏这一篇就够',
    likes: 1720,
    comments: 88,
    emoji: '🔥',
    from: '#ffe0e6',
    to: '#ff9eb0',
    topic: '风格塑造',
  },
  {
    id: 'p6',
    author: '莫兰迪',
    avatar: '🫧',
    text: '低饱和配色，怎么搭都高级',
    likes: 903,
    comments: 41,
    emoji: '🎨',
    from: '#eae7e2',
    to: '#b7b0a5',
    topic: '秀场解析',
  },
]
export const POSTS: Post[] = POSTS_RAW.map((p) => ({
  ...p,
  img: `/static/images/community/${p.id}.jpg`,
}))

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

export interface Scene {
  key: string
  label: string
  emoji: string
  img: string
}
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

/** 情景模拟底部三种模式 */
export const SCENE_MODES: { key: string; label: string; emoji: string; desc: string }[] = [
  { key: 'mix', label: '新旧混搭', emoji: '🔀', desc: '衣橱旧衣 + 商城新品智能混搭' },
  { key: 'renew', label: '旧衣新生', emoji: '♻️', desc: '给旧衣服换个搭法重新焕新' },
  { key: 'custom', label: '个性化定制', emoji: '🎯', desc: '按你的画像深度定制整套造型' },
]

/** 个性化创建页右侧工具 */
export const AI_TOOLS: {
  key: string
  label: string
  emoji: string
  /** 线性图标名，见 components/UiIcon/icons.ts；emoji 保留给还没换皮的地方兜底 */
  icon: IconName
  disabled?: boolean
}[] = [
  { key: 'info', label: '基础信息', emoji: '📋', icon: 'doc' },
  { key: 'gender', label: '更换性别', emoji: '⚧️', icon: 'gender' },
  { key: 'face', label: '拍照换脸', emoji: '📷', icon: 'camera', disabled: true },
  { key: 'style', label: '造型优化', emoji: '💇‍♀️', icon: 'face' },
  { key: 'body', label: '局部身材', emoji: '📐', icon: 'body' },
  { key: 'fav', label: '收藏夹', emoji: '⭐', icon: 'star-box' },
]

/** AI hub 功能入口 */
export const AI_FEATURES: {
  key: string
  label: string
  desc: string
  emoji: string
  icon: IconName
  from: string
  to: string
  route: string
}[] = [
  {
    key: 'create',
    label: '个性化创建',
    desc: '打造你的专属虚拟形象',
    emoji: '🧍‍♀️',
    icon: 'me',
    from: '#ffd6e8',
    to: '#d6a0ff',
    route: '/pages/body-create/index',
  },
  {
    key: 'stylist',
    label: 'AI 穿搭顾问',
    desc: '在线问穿搭，实时回答',
    emoji: '🤖',
    icon: 'robot',
    from: '#c9f0e6',
    to: '#7fd0c0',
    route: '/pages/stylist/index',
  },
  {
    key: 'free',
    label: '自由搭配',
    desc: '给形象自由换装试穿',
    emoji: '🧥',
    icon: 'outfit-switch',
    from: '#c9d8ff',
    to: '#9ab0ff',
    route: '/pages/free-match/index',
  },
  {
    key: 'scene',
    label: '情景模拟',
    desc: '看天气 + AI 一键搭配',
    emoji: '🌦️',
    icon: 'w-cloud-sun',
    from: '#c9ecff',
    to: '#8fc9f0',
    route: '/pages/scene/index',
  },
  {
    key: 'renew',
    label: '旧衣新生',
    desc: '旧衣服焕发新搭法',
    emoji: '♻️',
    icon: 'recycle',
    from: '#d6f0d9',
    to: '#9fceb0',
    route: '/pages/wardrobe-upload/index',
  },
  {
    key: 'accessory',
    label: '配饰推荐',
    desc: '按当前服装挑首饰鞋帽',
    emoji: '💎',
    icon: 'gem',
    from: '#f3e0d6',
    to: '#d8b08f',
    route: '/pages/accessory/index',
  },
  {
    key: 'magazine',
    label: '时尚杂志',
    desc: '灵感 & 穿搭思路',
    emoji: '📖',
    icon: 'book',
    from: '#f3e0d6',
    to: '#d8b08f',
    route: '/pages/community/index?tab=magazine',
  },
  {
    key: 'community',
    label: '时尚社群',
    desc: '和同好交流穿搭',
    emoji: '💬',
    icon: 'comment',
    from: '#efe0f0',
    to: '#c29ad6',
    route: '/pages/community/index?tab=share',
  },
  {
    key: 'custom',
    label: '差异化定制',
    desc: '量体裁衣与设计师沟通',
    emoji: '🧵',
    icon: 'scissors',
    from: '#f8d8c7',
    to: '#d7a7df',
    route: '/pages/custom/index',
  },
]
