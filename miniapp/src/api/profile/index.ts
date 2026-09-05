/*
 * 个人档案 / 风格报告接口。
 */
import { request } from '@/utils/request'
import type { BodyMetricKey, UserProfile } from '@/types'
import type { ProfileRecord, StyleReportListItem, StyleReportRecord } from './type'

enum API {
  /** 当前用户档案，GET 读 / PUT 写 */
  CURRENT_PROFILE_URL = '/api/profile/current',
  /** 风格报告列表 */
  STYLE_REPORTS_URL = '/api/style-reports',
  /** 单份风格报告，后面接 id */
  STYLE_REPORT_URL = '/api/style-reports/',
}

/** 类型再导出的理由见 api/diary/index.ts 的说明 */
export type { ProfileRecord, StyleReportListItem, StyleReportRecord } from './type'

export function toProfilePayload(profile: UserProfile) {
  const body: Record<string, number> = {}
  const keys: BodyMetricKey[] = ['height', 'weight', 'bust', 'waist', 'hip', 'shoulder', 'thigh', 'calf']
  keys.forEach((key) => {
    body[key] = Number(profile.body[key])
  })

  return {
    gender: profile.gender,
    styles: profile.styles,
    skin: profile.skinTone,
    face: profile.faceShape,
    visualBody: profile.visualBody,
    height: body.height,
    weight: body.weight,
    bust: body.bust,
    waist: body.waist,
    hips: body.hip,
    shoulder: body.shoulder,
    thigh: body.thigh,
    calf: body.calf,
    preferences: profile.preferences,
  }
}

export async function fetchCurrentProfile(): Promise<ProfileRecord | null> {
  const data = await request<{ profile?: ProfileRecord | null }>({
    url: API.CURRENT_PROFILE_URL,
  })
  return data.profile || null
}

export async function saveCurrentProfile(profile: UserProfile): Promise<ProfileRecord> {
  const data = await request<{ profile: ProfileRecord }>({
    url: API.CURRENT_PROFILE_URL,
    method: 'PUT',
    data: toProfilePayload(profile),
  })
  return data.profile
}

export async function fetchStyleReports(): Promise<StyleReportListItem[]> {
  const data = await request<{ items?: StyleReportListItem[] }>({
    url: API.STYLE_REPORTS_URL,
  })
  return data.items || []
}

export async function fetchStyleReportById(id: number): Promise<StyleReportRecord> {
  const data = await request<{ report: StyleReportRecord }>({
    url: API.STYLE_REPORT_URL + id,
  })
  return data.report
}
