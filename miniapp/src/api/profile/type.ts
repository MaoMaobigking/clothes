/*
 * 个人档案与风格报告的数据结构。
 *
 * ProfileRecord 是后端行的形状（下划线转驼峰后），和前端交互用的
 * UserProfile（见 @/types）不是一回事：后者按页面表单组织，
 * 两者的转换在 index.ts 的 toProfilePayload。
 */

export interface ProfileRecord {
  id: number
  gender: string
  styles: string[]
  skin: string
  face: string
  visualBody: string
  height: number | null
  weight: number | null
  bmi: number | null
  bust: number | null
  waist: number | null
  hips: number | null
  shoulder: number | null
  thigh: number | null
  calf: number | null
  preferences: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface StyleReportListItem {
  id: number
  created_at: string
}

export interface StyleReportRecord {
  id: number
  answers: any
  result: any
  created_at: string
}
