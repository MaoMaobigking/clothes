import type { IconName } from '@/utils/icons'

/** 单个选项（风格 / 肤色 / 脸型 / 偏好题都用它） */
export interface Option {
  id: string
  label: string
  desc?: string
  /** 卡片主色，用于给占位图上色 */
  color?: string
  /** emoji 图标，做轻量占位 */
  emoji?: string
  /** 小图预览路径（规格 §7.4）；素材缺失时组件回落到色块 + emoji */
  img?: string
}

/** 偏好测试里的单道题 */
export interface PreferenceQuestion {
  id: string
  title: string
  options: Option[]
}

/** 体型测量的一项（身高 / 体重 / 各围度） */
export interface BodyField {
  key: BodyMetricKey
  label: string
  unit: string
  min: number
  max: number
  step: number
  default: number
}

export type BodyMetricKey = 'height' | 'weight' | 'bust' | 'waist' | 'hip' | 'shoulder' | 'thigh' | 'calf'

/** 虚拟形象性别 */
export type Gender = 'female' | 'male'

/** 视觉体型选项 */
export type VisualBodyId = 'hourglass' | 'pear' | 'rectangle' | 'apple' | 'inverted-triangle'

/** 发型 key，先留接口，后续可扩展成图片资源 id */
export type HairStyleId = 'straight' | 'curly' | 'bun' | 'short'

/** 驱动 3D 人台比例的身形参数（规格 §7.9） */
export interface AvatarShape {
  gender: Gender | ''
  /** 身高 cm；0 表示未填，人台走中性默认值 */
  height: number
  /** 体重 kg；0 表示未填 */
  weight: number
  visualBody: VisualBodyId | ''
  /** 可选围度，用户改过才参与肩腰臀微调 */
  shoulder?: number
  waist?: number
  hip?: number
}

/** 必填体型项是否已经由用户确认 */
export interface ProfileProgress {
  genderSelected: boolean
  visualBodySelected: boolean
  heightTouched: boolean
  weightTouched: boolean
}

/** 用户完整画像 —— 这就是 5 步测试沉淀下来的数据 */
export interface UserProfile {
  styles: string[] // 风格：多选，至少 3 项
  skinTone: string // 肤色：单选
  faceShape: string // 脸型：单选
  body: Record<BodyMetricKey, number> // 体型：各项数值
  visualBody: VisualBodyId | '' // 视觉体型：必填
  preferences: Record<string, string> // 偏好：题目 id -> 选项 id
  gender: Gender | '' // 虚拟形象性别，体型步骤中必填
  hairstyle: HairStyleId // 发型，后续可接真实图片
  progress: ProfileProgress // 必填项是否被用户主动确认
}

/** 雷达图的一个维度 */
export interface RadarDimension {
  name: string
  value: number // 0 - 100
  /** 维度被跳过时，图表显示未完善状态 */
  incomplete?: boolean
}

/** 5 个步骤的静态定义 */
export interface StepMeta {
  key: string
  title: string // 步骤名，如「风格测试」
  emoji: string
  /** 线性图标名，见 components/UiIcon/icons.ts；emoji 保留给还没换皮的地方兜底 */
  icon: IconName
}
