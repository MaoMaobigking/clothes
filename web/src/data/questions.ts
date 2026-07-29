import type {
  BodyField,
  Option,
  PreferenceQuestion,
  StepMeta,
} from '@/types'

/** 5 个步骤的定义（顶部进度 & 步骤指示都用它） */
export const STEPS: StepMeta[] = [
  { key: 'style', title: '风格测试', emoji: '👕' },
  { key: 'skin', title: '肤色测试', emoji: '🎨' },
  { key: 'face', title: '脸型测试', emoji: '🙂' },
  { key: 'body', title: '体型测试', emoji: '📏' },
  { key: 'pref', title: '偏好测试', emoji: '📝' },
]

/** 风格测试：多选，至少选 3 项 */
export const STYLE_OPTIONS: Option[] = [
  { id: 'street', label: '休闲街头', desc: '卫衣 / 工装 / 板鞋', emoji: '🧢', color: '#ffd27d' },
  { id: 'commute', label: '简约通勤', desc: '西装 / 衬衫 / 直筒裤', emoji: '👔', color: '#9ec5ff' },
  { id: 'french', label: '法式浪漫', desc: '碎花 / 泡泡袖 / 茶歇裙', emoji: '🌷', color: '#ff9fc0' },
  { id: 'korean', label: '韩系甜美', desc: '针织 / 百褶裙 / 娃娃领', emoji: '🎀', color: '#ffb3d9' },
  { id: 'vintage', label: '复古优雅', desc: '格纹 / 风衣 / 皮革', emoji: '🕰️', color: '#c9a27e' },
  { id: 'sport', label: '运动机能', desc: '冲锋衣 / 束脚裤 / 机能鞋', emoji: '🏃', color: '#8fd6c6' },
]

/** 肤色测试：单选（color 直接当色块） */
export const SKIN_OPTIONS: Option[] = [
  { id: 'cool-fair', label: '冷白皮', desc: '偏粉调、白皙', color: '#fbe6df' },
  { id: 'warm-fair', label: '暖白皮', desc: '偏黄调、白净', color: '#f7dcc4' },
  { id: 'natural', label: '自然色', desc: '健康均匀', color: '#e8c3a0' },
  { id: 'wheat', label: '小麦色', desc: '阳光健康', color: '#cd9f74' },
  { id: 'olive', label: '橄榄皮', desc: '偏冷、微黄绿调', color: '#b48a5f' },
  { id: 'deep', label: '深棕皮', desc: '深邃有质感', color: '#8a5c3b' },
]

/** 脸型测试：单选（用 emoji + 描述做轻量占位） */
export const FACE_OPTIONS: Option[] = [
  { id: 'oval', label: '鹅蛋脸', desc: '标准脸型', emoji: '🥚', color: '#ffd9e6' },
  { id: 'round', label: '圆脸', desc: '圆润可爱', emoji: '⚪', color: '#fff0b3' },
  { id: 'square', label: '方脸', desc: '轮廓分明', emoji: '⬜', color: '#c9e4ff' },
  { id: 'long', label: '长脸', desc: '纵向偏长', emoji: '🥑', color: '#d9f0c9' },
  { id: 'heart', label: '心形脸', desc: '上宽下窄', emoji: '💗', color: '#ffcfe0' },
  { id: 'diamond', label: '菱形脸', desc: '颧骨突出', emoji: '💎', color: '#e0d4ff' },
]

/** 体型测试：数值测量项 */
export const BODY_FIELDS: BodyField[] = [
  { key: 'height', label: '身高', unit: 'cm', min: 140, max: 200, step: 1, default: 165 },
  { key: 'weight', label: '体重', unit: 'kg', min: 35, max: 120, step: 1, default: 52 },
  { key: 'bust', label: '胸围', unit: 'cm', min: 60, max: 130, step: 1, default: 84 },
  { key: 'waist', label: '腰围', unit: 'cm', min: 50, max: 120, step: 1, default: 66 },
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
