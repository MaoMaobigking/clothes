/*
 * 全站 mock 数据 —— 从 src/data/mock.ts 迁移
 * 图片路径适配为 miniapp static 目录
 */

/** App logo */
export const LOGO = '/static/images/logo.png'

/** 虚拟形象模特图 */
export const MODEL_IMAGES = {
  front: '/static/images/model/front.png',
  frontMale: '/static/images/model/front-male.png',
  outfit: '/static/images/model/outfit.png',
}

/** 发型选项，后续接入真实图片时在此扩展 */
export const HAIR_STYLES: { id: string; label: string; emoji: string }[] = [
  { id: 'straight', label: '直发', emoji: '💇‍♀️' },
  { id: 'curly', label: '卷发', emoji: '🦱' },
  { id: 'bun', label: '丸子头', emoji: '👱‍♀️' },
  { id: 'short', label: '短发', emoji: '💇‍♂️' },
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
  season: '春夏' | '秋冬' | '四季'
  img: string
  tags?: string[]
}
type RawGarment = Omit<Garment, 'img'>

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
  { id: 'g1', name: '宽松工装外套', category: 'top', brand: 'BASIC', emoji: '🧥', from: '#a6c8ff', to: '#5f8bff', price: 329, season: '秋冬', tags: ['街头', '百搭'] },
  { id: 'g2', name: '毛领派克大衣', category: 'top', brand: 'WARM', emoji: '🧥', from: '#f6d9b8', to: '#c99a6b', price: 599, season: '秋冬', tags: ['保暖'] },
  { id: 'g3', name: '基础白T', category: 'top', brand: 'DAILY', emoji: '👕', from: '#ffffff', to: '#e7e7ef', price: 89, season: '四季', tags: ['基础款'] },
  { id: 'g4', name: '法式泡泡袖衬衫', category: 'top', brand: 'ROMANCE', emoji: '👚', from: '#ffd9e6', to: '#ff9fc0', price: 219, season: '春夏', tags: ['法式', '甜美'] },
  { id: 'g5', name: '直筒西装裤', category: 'pants', brand: 'COMMUTE', emoji: '👖', from: '#cfd4e6', to: '#8a90ad', price: 259, season: '四季', tags: ['通勤'] },
  { id: 'g6', name: '水洗牛仔裤', category: 'pants', brand: 'DENIM', emoji: '👖', from: '#b7c9e8', to: '#6f8ec4', price: 199, season: '四季', tags: ['耐穿'] },
  { id: 'g7', name: '灯芯绒半裙', category: 'skirt', brand: 'VINTAGE', emoji: '👗', from: '#e8c39a', to: '#c98a52', price: 179, season: '秋冬', tags: ['复古'] },
  { id: 'g8', name: '百褶短裙', category: 'skirt', brand: 'SWEET', emoji: '👗', from: '#ffe0ef', to: '#ffb3d9', price: 149, season: '春夏', tags: ['韩系'] },
  { id: 'g9', name: '碎花连衣裙', category: 'dress', brand: 'ROMANCE', emoji: '🥻', from: '#ffd6e8', to: '#d6a0ff', price: 399, season: '春夏', tags: ['茶歇', '法式'] },
  { id: 'g10', name: '机能束脚连体裤', category: 'dress', brand: 'TECH', emoji: '🩱', from: '#b8ecdf', to: '#5fc9b0', price: 429, season: '四季', tags: ['运动'] },
  { id: 'g11', name: '厚底板鞋', category: 'shoes', brand: 'STREET', emoji: '👟', from: '#e7e7ef', to: '#b8b8cf', price: 359, season: '四季', tags: ['街头'] },
  { id: 'g12', name: '玛丽珍单鞋', category: 'shoes', brand: 'SWEET', emoji: '🥿', from: '#ffdfe9', to: '#ff9ec2', price: 289, season: '春夏', tags: ['甜美'] },
  { id: 'g13', name: '通勤托特包', category: 'bag', brand: 'COMMUTE', emoji: '👜', from: '#d8c3a5', to: '#a9885c', price: 469, season: '四季', tags: ['大容量'] },
  { id: 'g14', name: '红色链条包', category: 'bag', brand: 'CHIC', emoji: '👛', from: '#ffb3b3', to: '#e0504f', price: 359, season: '四季', tags: ['点睛'] },
  { id: 'g15', name: '针织毛线帽', category: 'hat', brand: 'WARM', emoji: '🧢', from: '#ffd6c9', to: '#ff9e86', price: 79, season: '秋冬', tags: ['保暖'] },
  { id: 'g16', name: '银色耳夹', category: 'jewelry', brand: 'GLOW', emoji: '💍', from: '#eef1f6', to: '#c3ccdb', price: 84, season: '四季', tags: ['精致'] },
  { id: 'g17', name: '格纹羊毛围巾', category: 'accessory', brand: 'VINTAGE', emoji: '🧣', from: '#f0d3d0', to: '#c98f8a', price: 129, season: '秋冬', tags: ['复古'] },
  { id: 'g18', name: '羊羔毛夹克', category: 'top', brand: 'WARM', emoji: '🧥', from: '#f3ead6', to: '#cbb488', price: 519, season: '秋冬', tags: ['保暖'] },
]
export const GARMENTS: Garment[] = GARMENTS_RAW.map((g) => ({
  ...g,
  img: `/static/images/closet/${g.id}.png`,
}))

/* ----------------------------- 商城 ----------------------------- */

export interface MallProduct {
  id: string
  name: string
  category: string
  price: number
  emoji: string
  from: string
  to: string
  img: string
  tag?: string
}
type RawMallProduct = Omit<MallProduct, 'img'>

export const MALL_CATEGORIES: { key: string; label: string }[] = [
  { key: 'earring', label: '耳饰' },
  { key: 'necklace', label: '项链' },
  { key: 'ring', label: '戒指' },
  { key: 'bracelet', label: '手链' },
  { key: 'bag', label: '包袋' },
]

const MALL_PRODUCTS_RAW: RawMallProduct[] = [
  { id: 'm1', name: 'C 形环扣耳夹', category: 'earring', price: 84, emoji: '💫', from: '#eef1f6', to: '#c3ccdb', tag: '现货系列' },
  { id: 'm2', name: '流苏长耳线', category: 'earring', price: 138, emoji: '✨', from: '#f6eef7', to: '#d6b8dd' },
  { id: 'm3', name: '海马造型耳饰', category: 'earring', price: 84, emoji: '🐚', from: '#e6f3f1', to: '#a9d8cf' },
  { id: 'm4', name: '珍珠爱心耳钉', category: 'earring', price: 138, emoji: '🤍', from: '#fdf3f6', to: '#f2cdd8' },
  { id: 'm5', name: '几何银项链', category: 'necklace', price: 168, emoji: '📿', from: '#eef1f6', to: '#b9c2d4' },
  { id: 'm6', name: '锁骨细链', category: 'necklace', price: 118, emoji: '🔗', from: '#f6f0ea', to: '#d8c3a5' },
  { id: 'm7', name: '开口戒指', category: 'ring', price: 79, emoji: '💍', from: '#f2eef7', to: '#cbb8e0' },
  { id: 'm8', name: '编织手链', category: 'bracelet', price: 84, emoji: '🧶', from: '#fdeee6', to: '#f0c2a5' },
  { id: 'm9', name: '亚克力手镯', category: 'bracelet', price: 138, emoji: '⭕', from: '#eaf0ff', to: '#b8c8f0' },
  { id: 'm10', name: '迷你链条包', category: 'bag', price: 359, emoji: '👛', from: '#ffd9de', to: '#e0716f' },
]
export const MALL_PRODUCTS: MallProduct[] = MALL_PRODUCTS_RAW.map((p) => ({
  ...p,
  img: `/static/images/mall/${p.id}.png`,
}))

/* ----------------------------- 时尚杂志 ----------------------------- */

export interface Magazine {
  id: string
  title: string
  subtitle: string
  emoji: string
  from: string
  to: string
  tag: string
  img: string
}
type RawMagazine = Omit<Magazine, 'img'>

const MAGAZINES_RAW: RawMagazine[] = [
  { id: 'z1', title: 'BAZAAR', subtitle: '超现实主义 100 年', emoji: '🎩', from: '#e9e2d6', to: '#b7a98f', tag: '本期封面' },
  { id: 'z2', title: 'VOGUE', subtitle: '春夏高定秀场解析', emoji: '👗', from: '#f3d9e4', to: '#c98fb0', tag: '秀场' },
  { id: 'z3', title: 'ELLE', subtitle: '通勤穿搭的 10 个公式', emoji: '💼', from: '#d6e4f0', to: '#8fa9c9', tag: '干货' },
  { id: 'z4', title: 'GQ', subtitle: '机能风的正确打开方式', emoji: '🧥', from: '#d9ece6', to: '#7fc0b0', tag: '风格' },
  { id: 'z5', title: 'NYLON', subtitle: 'Y2K 复古回潮', emoji: '🕶️', from: '#efe0f0', to: '#c29ad6', tag: '趋势' },
  { id: 'z6', title: 'KINFOLK', subtitle: '莫兰迪配色搭配指南', emoji: '🫧', from: '#e8e6e1', to: '#b3aea3', tag: '配色' },
]
export const MAGAZINES: Magazine[] = MAGAZINES_RAW.map((m) => ({
  ...m,
  img: `/static/images/magazine/${m.id}.png`,
}))

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
  { id: 'p1', author: '小鱼要暴富', avatar: '🐟', text: '155 小个子秋冬这样穿显高 10cm，姐妹冲！', likes: 1289, comments: 96, emoji: '🧥', from: '#d6e4f0', to: '#9ab6d8', topic: '显瘦公式' },
  { id: 'p2', author: 'Ariel', avatar: '🧜‍♀️', text: '把去年的旧毛衣改成了马甲，成本 0 元', likes: 864, comments: 52, emoji: '♻️', from: '#e3f0e6', to: '#9fceb0', topic: '旧衣改造' },
  { id: 'p3', author: '通勤小圈', avatar: '💼', text: '一周五天不重样的通勤 look 分享', likes: 2033, comments: 141, emoji: '👔', from: '#e7e2f0', to: '#b3a0d8', topic: '通勤穿搭' },
  { id: 'p4', author: 'vintage鱼', avatar: '🕰️', text: '复古格纹 + 皮革，秋天的第一套', likes: 597, comments: 33, emoji: '🧣', from: '#f0e0d6', to: '#c9a07e', topic: '风格塑造' },
  { id: 'p5', author: '甜辣本辣', avatar: '🌶️', text: '甜辣风穿搭教科书，收藏这一篇就够', likes: 1720, comments: 88, emoji: '🔥', from: '#ffe0e6', to: '#ff9eb0', topic: '风格塑造' },
  { id: 'p6', author: '莫兰迪', avatar: '🫧', text: '低饱和配色，怎么搭都高级', likes: 903, comments: 41, emoji: '🎨', from: '#eae7e2', to: '#b7b0a5', topic: '秀场解析' },
]
export const POSTS: Post[] = POSTS_RAW.map((p) => ({
  ...p,
  img: `/static/images/community/${p.id}.png`,
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
  pieces: r.pieces.map((p, i) => ({ ...p, img: `/static/images/outfit/${r.id}-${i + 1}.png` })),
}))

/* ----------------------------- 场景 / 模式 / 工具 ----------------------------- */

export interface Scene {
  key: string
  label: string
  emoji: string
  img: string
}
const SCENES_RAW: Omit<Scene, 'img'>[] = [
  { key: 'play', label: '游玩', emoji: '🎡' },
  { key: 'work', label: '职场', emoji: '💼' },
  { key: 'date', label: '约会', emoji: '💕' },
  { key: 'sport', label: '运动', emoji: '🏃' },
  { key: 'party', label: '派对', emoji: '🎉' },
]
export const SCENES: Scene[] = SCENES_RAW.map((s) => ({
  ...s,
  img: `/static/images/scene/${s.key}.png`,
}))

/** 情景模拟底部三种模式 */
export const SCENE_MODES: { key: string; label: string; emoji: string; desc: string }[] = [
  { key: 'mix', label: '新旧混搭', emoji: '🔀', desc: '衣橱旧衣 + 商城新品智能混搭' },
  { key: 'renew', label: '旧衣新生', emoji: '♻️', desc: '给旧衣服换个搭法重新焕新' },
  { key: 'custom', label: '个性化定制', emoji: '🎯', desc: '按你的画像深度定制整套造型' },
]

/** 个性化创建页右侧工具 */
export const AI_TOOLS: { key: string; label: string; emoji: string; disabled?: boolean }[] = [
  { key: 'info', label: '基础信息', emoji: '📋' },
  { key: 'gender', label: '更换性别', emoji: '⚧️' },
  { key: 'face', label: '拍照换脸', emoji: '📷', disabled: true },
  { key: 'style', label: '造型优化', emoji: '💇‍♀️' },
  { key: 'body', label: '局部身材', emoji: '📐' },
  { key: 'fav', label: '收藏夹', emoji: '⭐' },
]

/** AI hub 功能入口 */
export const AI_FEATURES: {
  key: string
  label: string
  desc: string
  emoji: string
  from: string
  to: string
  route: string
}[] = [
  { key: 'create', label: '个性化创建', desc: '打造你的专属虚拟形象', emoji: '🧍‍♀️', from: '#ffd6e8', to: '#d6a0ff', route: '/pages/body-create/index' },
  { key: 'stylist', label: 'AI 穿搭顾问', desc: '在线问穿搭，实时回答', emoji: '🤖', from: '#c9f0e6', to: '#7fd0c0', route: '/pages/stylist/index' },
  { key: 'free', label: '自由搭配', desc: '给形象自由换装试穿', emoji: '🧥', from: '#c9d8ff', to: '#9ab0ff', route: '/pages/free-match/index' },
  { key: 'scene', label: '情景模拟', desc: '看天气 + AI 一键搭配', emoji: '🌦️', from: '#c9ecff', to: '#8fc9f0', route: '/pages/scene/index' },
  { key: 'renew', label: '旧衣新生', desc: '旧衣服焕发新搭法', emoji: '♻️', from: '#d6f0d9', to: '#9fceb0', route: '/pages/scene/index' },
  { key: 'magazine', label: '时尚杂志', desc: '灵感 & 穿搭思路', emoji: '📖', from: '#f3e0d6', to: '#d8b08f', route: '/pages/magazine/index' },
  { key: 'community', label: '时尚社群', desc: '和同好交流穿搭', emoji: '💬', from: '#efe0f0', to: '#c29ad6', route: '/pages/community/index' },
]
