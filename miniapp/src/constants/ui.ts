/*
 * 界面静态配置 —— 选项表、入口清单、素材路径。
 *
 * 这些**不是** mock 数据：它们是生产代码的一部分，改了会直接改变线上表现。
 * 原先和假数据一起塞在 data/mock.ts 里，名字骗人，所以拆到 constants/。
 *
 * 品牌名、logo 之类的全局配置在 @/setting。
 */
import type { IconName } from '@/utils/icons'
import type { RouteKey } from './routes'

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

/* ----------------------------- AI 入口 ----------------------------- */

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
  /* 路由 key 而不是路径字符串：写错 key 是编译错误，写错路径只会静默跳不动 */
  route: RouteKey
  /** 少数入口要带参数进社区页的某个 tab */
  query?: Record<string, string>
}[] = [
  {
    key: 'create',
    label: '个性化创建',
    desc: '打造你的专属虚拟形象',
    emoji: '🧍‍♀️',
    icon: 'me',
    from: '#ffd6e8',
    to: '#d6a0ff',
    route: 'bodyCreate',
  },
  {
    key: 'stylist',
    label: 'AI 穿搭顾问',
    desc: '在线问穿搭，实时回答',
    emoji: '🤖',
    icon: 'robot',
    from: '#c9f0e6',
    to: '#7fd0c0',
    route: 'stylist',
  },
  {
    key: 'free',
    label: '自由搭配',
    desc: '给形象自由换装试穿',
    emoji: '🧥',
    icon: 'outfit-switch',
    from: '#c9d8ff',
    to: '#9ab0ff',
    route: 'freeMatch',
  },
  {
    key: 'scene',
    label: '情景模拟',
    desc: '看天气 + AI 一键搭配',
    emoji: '🌦️',
    icon: 'w-cloud-sun',
    from: '#c9ecff',
    to: '#8fc9f0',
    route: 'scene',
  },
  {
    key: 'renew',
    label: '旧衣新生',
    desc: '旧衣服焕发新搭法',
    emoji: '♻️',
    icon: 'recycle',
    from: '#d6f0d9',
    to: '#9fceb0',
    route: 'wardrobeUpload',
  },
  {
    key: 'accessory',
    label: '配饰推荐',
    desc: '按当前服装挑首饰鞋帽',
    emoji: '💎',
    icon: 'gem',
    from: '#f3e0d6',
    to: '#d8b08f',
    route: 'accessory',
  },
  {
    key: 'magazine',
    label: '时尚杂志',
    desc: '灵感 & 穿搭思路',
    emoji: '📖',
    icon: 'book',
    from: '#f3e0d6',
    to: '#d8b08f',
    route: 'community',
    query: { tab: 'magazine' },
  },
  {
    key: 'community',
    label: '时尚社群',
    desc: '和同好交流穿搭',
    emoji: '💬',
    icon: 'comment',
    from: '#efe0f0',
    to: '#c29ad6',
    route: 'community',
    query: { tab: 'share' },
  },
  {
    key: 'custom',
    label: '差异化定制',
    desc: '量体裁衣与设计师沟通',
    emoji: '🧵',
    icon: 'scissors',
    from: '#f8d8c7',
    to: '#d7a7df',
    route: 'custom',
  },
]
