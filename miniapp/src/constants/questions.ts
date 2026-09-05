import type { BodyField, Option, PreferenceQuestion, StepMeta, VisualBodyId } from '@/types'

/** 5 个步骤的定义（顶部进度 & 步骤指示都用它） */
export const STEPS: StepMeta[] = [
  { key: 'style', title: '风格测试', emoji: '👕', icon: 'test-style' },
  { key: 'skin', title: '肤色测试', emoji: '🎨', icon: 'test-skin' },
  { key: 'face', title: '脸型测试', emoji: '🙂', icon: 'test-face' },
  { key: 'body', title: '体型测试', emoji: '📏', icon: 'test-body' },
  { key: 'pref', title: '偏好测试', emoji: '📝', icon: 'test-pref' },
]

/**
 * 风格测试：多选，至少选 3 项。
 * `img` 指向 `/static/images/style/*`；素材未就位时 OptionCard 自动回落到色块 + emoji
 * （规格 §4.3 真实数据原则：不生成卡通图充数）。
 */
export const STYLE_OPTIONS: Option[] = [
  {
    id: 'street',
    label: '休闲街头',
    desc: '卫衣 / 工装 / 板鞋',
    emoji: '🧢',
    color: '#ffd27d',
    img: '/static/images/style/street.jpg',
  },
  {
    id: 'commute',
    label: '简约通勤',
    desc: '西装 / 衬衫 / 直筒裤',
    emoji: '👔',
    color: '#9ec5ff',
    img: '/static/images/style/commute.jpg',
  },
  {
    id: 'french',
    label: '法式浪漫',
    desc: '碎花 / 泡泡袖 / 茶歇裙',
    emoji: '🌷',
    color: '#ff9fc0',
    img: '/static/images/style/french.jpg',
  },
  {
    id: 'korean',
    label: '韩系甜美',
    desc: '针织 / 百褶裙 / 娃娃领',
    emoji: '🎀',
    color: '#ffb3d9',
    img: '/static/images/style/korean.jpg',
  },
  {
    id: 'vintage',
    label: '复古优雅',
    desc: '格纹 / 风衣 / 皮革',
    emoji: '🕰️',
    color: '#c9a27e',
    img: '/static/images/style/vintage.jpg',
  },
  {
    id: 'sport',
    label: '运动机能',
    desc: '冲锋衣 / 束脚裤 / 机能鞋',
    emoji: '🏃',
    color: '#8fd6c6',
    img: '/static/images/style/sport.jpg',
  },
]

/** 肤色测试：单选 */
export const SKIN_OPTIONS: Option[] = [
  {
    id: 'cool-fair',
    label: '冷白皮',
    desc: '偏粉调、白皙',
    color: '#fbe6df',
    img: '/static/images/skin/cool-fair.jpg',
  },
  {
    id: 'warm-fair',
    label: '暖白皮',
    desc: '偏黄调、白净',
    color: '#f7dcc4',
    img: '/static/images/skin/warm-fair.jpg',
  },
  { id: 'natural', label: '自然色', desc: '健康均匀', color: '#e8c3a0', img: '/static/images/skin/natural.jpg' },
  { id: 'wheat', label: '小麦色', desc: '阳光健康', color: '#cd9f74', img: '/static/images/skin/wheat.jpg' },
  { id: 'olive', label: '橄榄皮', desc: '偏冷、微黄绿调', color: '#b48a5f', img: '/static/images/skin/olive.jpg' },
  { id: 'deep', label: '深棕皮', desc: '深邃有质感', color: '#8a5c3b', img: '/static/images/skin/deep.jpg' },
]

/** 脸型测试：单选 */
export const FACE_OPTIONS: Option[] = [
  { id: 'oval', label: '鹅蛋脸', desc: '标准脸型', emoji: '🥚', color: '#ffd9e6', img: '/static/images/face/oval.jpg' },
  { id: 'round', label: '圆脸', desc: '圆润可爱', emoji: '⚪', color: '#fff0b3', img: '/static/images/face/round.jpg' },
  {
    id: 'square',
    label: '方脸',
    desc: '轮廓分明',
    emoji: '⬜',
    color: '#c9e4ff',
    img: '/static/images/face/square.jpg',
  },
  { id: 'long', label: '长脸', desc: '纵向偏长', emoji: '🥑', color: '#d9f0c9', img: '/static/images/face/long.jpg' },
  {
    id: 'heart',
    label: '心形脸',
    desc: '上宽下窄',
    emoji: '💗',
    color: '#ffcfe0',
    img: '/static/images/face/heart.jpg',
  },
  {
    id: 'diamond',
    label: '菱形脸',
    desc: '颧骨突出',
    emoji: '💎',
    color: '#e0d4ff',
    img: '/static/images/face/diamond.jpg',
  },
]

/** 视觉体型：单选，必填 */
export const VISUAL_BODY_OPTIONS: {
  id: VisualBodyId
  label: string
  desc: string
  emoji: string
  color: string
  img: string
}[] = [
  {
    id: 'hourglass',
    label: '沙漏型',
    desc: '肩臀接近，腰线明显',
    emoji: '⏳',
    color: '#ffd1e8',
    img: '/static/images/body/hourglass.jpg',
  },
  {
    id: 'pear',
    label: '梨形',
    desc: '下半身比上半身更丰满',
    emoji: '🍐',
    color: '#d7f0d1',
    img: '/static/images/body/pear.jpg',
  },
  {
    id: 'rectangle',
    label: '矩形',
    desc: '肩、腰、臀比例接近',
    emoji: '▭',
    color: '#cfe0ff',
    img: '/static/images/body/rectangle.jpg',
  },
  {
    id: 'apple',
    label: '苹果形',
    desc: '腰腹较圆，四肢相对纤细',
    emoji: '🍎',
    color: '#ffe4c9',
    img: '/static/images/body/apple.jpg',
  },
  {
    id: 'inverted-triangle',
    label: '倒三角',
    desc: '肩部较宽，下半身偏窄',
    emoji: '🔻',
    color: '#e5dcff',
    img: '/static/images/body/inverted-triangle.jpg',
  },
]

/** 体型测试：数值测量项 */
export const BODY_FIELDS: BodyField[] = [
  { key: 'height', label: '身高', unit: 'cm', min: 140, max: 200, step: 1, default: 165 },
  { key: 'weight', label: '体重', unit: 'kg', min: 35, max: 120, step: 1, default: 52 },
  { key: 'bust', label: '胸围', unit: 'cm', min: 60, max: 130, step: 1, default: 84 },
  { key: 'waist', label: '腰围', unit: 'cm', min: 50, max: 120, step: 1, default: 66 },
  { key: 'hip', label: '臀围', unit: 'cm', min: 60, max: 140, step: 1, default: 90 },
  { key: 'shoulder', label: '肩宽', unit: 'cm', min: 25, max: 65, step: 1, default: 39 },
  { key: 'thigh', label: '大腿围', unit: 'cm', min: 35, max: 80, step: 1, default: 52 },
  { key: 'calf', label: '小腿围', unit: 'cm', min: 25, max: 55, step: 1, default: 34 },
]

/** 偏好测试：多道单选题 */
export const PREFERENCE_QUESTIONS: PreferenceQuestion[] = [
  {
    id: 'priority',
    title: '买衣服你最看重？',
    options: [
      { id: 'comfort', label: '舒适度', emoji: '☁️' },
      { id: 'fashion', label: '时尚度', emoji: '✨' },
      { id: 'value', label: '性价比', emoji: '💰' },
    ],
  },
  {
    id: 'scene',
    title: '最常穿的场合？',
    options: [
      { id: 'work', label: '通勤', emoji: '💼' },
      { id: 'date', label: '约会', emoji: '💕' },
      { id: 'sport', label: '运动', emoji: '🏀' },
      { id: 'home', label: '居家', emoji: '🏠' },
    ],
  },
  {
    id: 'color',
    title: '色彩偏好？',
    options: [
      { id: 'bright', label: '明亮跳色', emoji: '🌈' },
      { id: 'morandi', label: '低饱和莫兰迪', emoji: '🫧' },
      { id: 'classic', label: '黑白灰经典', emoji: '⚫' },
    ],
  },
  {
    id: 'budget',
    title: '预算区间？',
    options: [
      { id: 'low', label: '平价', emoji: '🪙' },
      { id: 'mid', label: '中端', emoji: '💳' },
      { id: 'high', label: '轻奢', emoji: '💎' },
    ],
  },
  {
    id: 'fit',
    title: '版型偏好？',
    options: [
      { id: 'slim', label: '修身', emoji: '📐' },
      { id: 'loose', label: '宽松', emoji: '🧸' },
      { id: 'any', label: '都可以', emoji: '🤷' },
    ],
  },
]
