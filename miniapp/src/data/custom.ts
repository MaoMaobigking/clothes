export type CustomServiceType = 'body' | 'occasion' | 'specific' | 'taste'

export interface CustomCase {
  title: string
  desc: string
  image: string
  vipOnly?: boolean
}

export interface CustomCategory {
  key: CustomServiceType
  label: string
  shortLabel: string
  emoji: string
  desc: string
  image: string
  cases: CustomCase[]
}

export const CUSTOM_CATEGORIES: CustomCategory[] = [
  {
    key: 'body',
    label: '身材特殊人群',
    shortLabel: '特殊身材',
    emoji: '🧍',
    desc: '孕妇、大码、轮椅友好等包容性版型，按真实身体数据调整结构。',
    image: '/static/images/model/front.png',
    cases: [
      { title: '孕妇定制连衣裙', desc: '可调节腰头与立体余量，孕中后期都能舒适穿着。', image: '/static/images/model/front.png' },
      { title: '包容性通勤西装', desc: '肩背活动余量与隐藏式弹力，久坐也保持利落。', image: '/static/images/model/front.png' },
      { title: '轮椅友好长裙', desc: '前短后长剪裁，坐姿自然，不起堆褶。', image: '/static/images/model/front.png' },
    ],
  },
  {
    key: 'occasion',
    label: '特殊场合需求者',
    shortLabel: '特殊场合',
    emoji: '🎭',
    desc: '团建、学院、演出等场景服装，支持团体尺码表与阶段化交付。',
    image: '/static/images/model/front-male.png',
    cases: [
      { title: '年会礼服定制', desc: '正式感与活动量兼顾，提供试穿样与修改档。', image: '/static/images/model/front.png' },
      { title: '学院风制服套装', desc: '按团体尺寸分层，统一版型与细节标识。', image: '/static/images/model/front-male.png' },
      { title: '舞台演出服', desc: '高动态结构，重点处理肩、袖和转身形态。', image: '/static/images/model/front.png' },
    ],
  },
  {
    key: 'specific',
    label: '其他特定人群',
    shortLabel: '特定人群',
    emoji: '👘',
    desc: 'Coser、娃衣、高端消费者等细分需求，支持角色参考与材料说明。',
    image: '/static/images/model/front-male.png',
    cases: [
      { title: 'Cosplay 复刻服装', desc: '以参考图拆解结构与配件，保留角色识别度。', image: '/static/images/model/front.png' },
      { title: '六分娃衣套装', desc: '小尺寸精密缝制，按模型尺寸和关节活动留余量。', image: '/static/images/model/front.png' },
      { title: '限量面料外套', desc: '先确认面料库存，再进入版型和排期。', image: '/static/images/model/front-male.png', vipOnly: true },
    ],
  },
  {
    key: 'taste',
    label: '追求独特品味者',
    shortLabel: '独特品味',
    emoji: '💎',
    desc: '设计师款、手工刺绣和限量联名，重点保留独特廓形与工艺。',
    image: '/static/images/model/front.png',
    cases: [
      { title: '明星同款定制', desc: '根据参考图做非复制式改造，控制版权风险。', image: '/static/images/model/front.png', vipOnly: true },
      { title: '手工刺绣礼服', desc: '手工纹理与局部放大图同步确认。', image: '/static/images/model/front.png', vipOnly: true },
      { title: '设计师联名夹克', desc: '采用独立版型和细节配件，限量排单。', image: '/static/images/model/front-male.png', vipOnly: true },
    ],
  },
]

export const CUSTOM_STEPS = [
  '选择服务类型',
  '填写需求',
  '上传参考图',
  '设计师沟通',
  '查看进度',
]

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  submitted: '已提交',
  design: '设计稿',
  sample: '打样',
  production: '生产中',
  shipped: '发货',
}

export const REQUEST_STATUS_ORDER = [
  'submitted',
  'design',
  'sample',
  'production',
  'shipped',
]

export function getCustomCategory(key?: string) {
  return CUSTOM_CATEGORIES.find((category) => category.key === key) ?? CUSTOM_CATEGORIES[0]
}
