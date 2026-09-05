import { request } from './http'
import type { BodyMetricKey, UserProfile } from '@/types'

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
    url: '/api/profile/current',
  })
  return data.profile || null
}

export async function saveCurrentProfile(profile: UserProfile): Promise<ProfileRecord> {
  const data = await request<{ profile: ProfileRecord }>({
    url: '/api/profile/current',
    method: 'PUT',
    data: toProfilePayload(profile),
  })
  return data.profile
}

export async function fetchStyleReports(): Promise<StyleReportListItem[]> {
  const data = await request<{ items?: StyleReportListItem[] }>({
    url: '/api/style-reports',
  })
  return data.items || []
}

export async function fetchStyleReportById(id: number): Promise<StyleReportRecord> {
  const data = await request<{ report: StyleReportRecord }>({
    url: `/api/style-reports/${id}`,
  })
  return data.report
}
