import type { AiRadarDim, StyleReport } from '@/api/ai'
import {
  FACE_OPTIONS,
  PREFERENCE_QUESTIONS,
  SKIN_OPTIONS,
  STYLE_OPTIONS,
} from '@/data/questions'
import type { Gender, HairStyleId } from '@/types'

export interface LocalProfileInput {
  styles: string[]
  skinTone: string
  faceShape: string
  body: Record<string, number>
  preferences: Record<string, string>
  gender: Gender | ''
  hairstyle: HairStyleId
}

const PALETTE: Record<string, string[]> = {
  '休闲街头': ['#2f2f3a', '#b8c8d8', '#e8e2d0', '#d97757'],
  '简约通勤': ['#3f4655', '#a9b6c9', '#e7e4da', '#8d7f6f'],
  '法式浪漫': ['#f4c6d2', '#e0d0ee', '#f7efe2', '#9d7188'],
  '韩系甜美': ['#ffd9e6', '#ffb3d1', '#f4e3ff', '#c9a7d8'],
  '复古优雅': ['#d9b58f', '#6f4e3d', '#efe6d5', '#9b5b3f'],
  '运动机能': ['#1f2933', '#6fc9b0', '#e8edf0', '#ff9e5e'],
}

const FACE_SCORE: Record<string, number> = {
  oval: 95,
  heart: 88,
  diamond: 84,
  square: 80,
  round: 78,
  long: 76,
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

export function buildLocalStyleReport(input: LocalProfileInput): StyleReport {
  const styleLabels = input.styles
    .map((id) => STYLE_OPTIONS.find((o) => o.id === id)?.label)
    .filter(Boolean) as string[]
  const skinLabel = SKIN_OPTIONS.find((o) => o.id === input.skinTone)?.label ?? '自然肤'
  const faceLabel = FACE_OPTIONS.find((o) => o.id === input.faceShape)?.label ?? '标准脸型'
  const mainStyle = styleLabels[0] || '百搭'

  const h = Number(input.body.height) || 165
  const w = Number(input.body.weight) || 52
  const bmi = Math.round((w / (h / 100) ** 2) * 10) / 10

  const styleScore = Math.round(40 + (Math.min(styleLabels.length, 3) / 3) * 60)
  const skinIndex = SKIN_OPTIONS.findIndex((o) => o.id === input.skinTone)
  const skinScore = skinIndex < 0 ? 0 : 92 - skinIndex * 8
  const faceScore = FACE_SCORE[input.faceShape] ?? 0
  const bodyScore = clamp(Math.round(100 - Math.abs(bmi - 21) * 4), 40, 100)
  const prefScore = Math.round(
    (Object.keys(input.preferences).length / PREFERENCE_QUESTIONS.length) * 100,
  )

  const radar: AiRadarDim[] = [
    { name: '风格', value: styleScore },
    { name: '肤色', value: skinScore, incomplete: !input.skinTone },
    { name: '脸型', value: faceScore, incomplete: !input.faceShape },
    { name: '体型', value: bodyScore },
    { name: '偏好', value: prefScore, incomplete: Object.keys(input.preferences).length < PREFERENCE_QUESTIONS.length },
  ]

  const palette = PALETTE[mainStyle] || PALETTE['简约通勤']

  const prefLabels = PREFERENCE_QUESTIONS.map((q) => {
    const optId = input.preferences[q.id]
    return q.options.find((o) => o.id === optId)?.label ?? ''
  }).filter(Boolean)

  const basePieces: Record<string, string[]> = {
    '休闲街头': ['白T恤', '牛仔外套', '直筒裤', '厚底板鞋'],
    '简约通勤': ['衬衫', '西装裤', '针织开衫', '托特包'],
    '法式浪漫': ['泡泡袖衬衫', '碎花半裙', '玛丽珍鞋', '珍珠耳饰'],
    '韩系甜美': ['娃娃领上衣', '百褶裙', '针织开衫', '小方包'],
    '复古优雅': ['格纹西装', '直筒牛仔裤', '乐福鞋', '丝巾'],
    '运动机能': ['冲锋衣', '束脚裤', '机能鞋', '帆布包'],
  }
  const pieces = basePieces[mainStyle] || basePieces['简约通勤']
  const sceneByStyle = ['约会', '周末', '职场', '日常']

  const recommendations = [0, 1, 2].map((i) => ({
    title: `「${mainStyle}」${sceneByStyle[i]}方案`,
    scene: sceneByStyle[i],
    pieces: [pieces[0], pieces[(i + 1) % pieces.length], pieces[(i + 2) % pieces.length], pieces[(i + 3) % pieces.length]],
    reason: `根据你的肤色（${skinLabel}）和偏好（${prefLabels.join('、') || '舒适耐穿'}）生成，适合作为${sceneByStyle[i]}的日常参考。`,
  }))

  const tips = [
    bmi < 18.5
      ? '体型偏瘦时优先选择有肩线和微廓形的外套，增加上半身分量感。'
      : bmi > 24
        ? '体型偏丰满时利用垂直线条和收腰剪裁，视觉上更利落。'
        : '你的身形比例均衡，可以大胆尝试叠穿和亮色局部点缀。',
    skinIndex <= 1
      ? '偏冷调肤色适合蓝、紫、玫粉色，避开大面积土黄。'
      : '偏暖调肤色适合米白、砖红、橄榄绿，能提升气色。',
    '一套造型尽量不超过 3 个主色，配饰和鞋包统一色系。',
  ]

  const summary = `${skinLabel} · ${faceLabel} · 偏爱「${mainStyle}」的你`

  return {
    summary,
    radar,
    palette,
    recommendations,
    tips,
  }
}
