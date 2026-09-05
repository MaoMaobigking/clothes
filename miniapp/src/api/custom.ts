import { API_BASE_URL, ensureToken, request } from '@/utils/request'
import { USE_CLOUD, cloudUploadImage } from '@/utils/cloud'

export type CustomRequestStatus = 'submitted' | 'design' | 'sample' | 'production' | 'shipped'

export interface CustomSummary {
  role: string
  membershipLevel: 'standard' | 'vip' | string
  requestCount: number
}

export interface CustomDesigner {
  id: number
  name: string
  specialty: string
  avatarUrl: string
}

export interface CustomMeasurement {
  id: number
  serviceType: string
  dimensions: {
    height: number
    weight: number
    bust: number
    waist: number
    hips: number
    shoulder: number
  }
  frontImage: string
  sideImage: string
  backImage: string
  detailImages: string[]
  notes: string
  createdAt: string
}

export interface CustomRequest {
  id: number
  serviceType: string
  source: 'inquiry' | 'measurement'
  status: CustomRequestStatus
  requirements: Record<string, any>
  referenceImages: string[]
  measurementId: number | null
  designer: CustomDesigner | null
  createdAt: string
  updatedAt: string
}

export interface CustomMessage {
  id: number
  sender: 'user' | 'designer' | 'system'
  content: string
  designerId: number | null
  createdAt: string
}

export interface CustomRequestDetail {
  request: CustomRequest
  measurement: CustomMeasurement | null
  messages: CustomMessage[]
}

export interface InquiryPayload {
  serviceType: string
  requirements: string
  budget?: string
  sizeNotes?: string
  referenceImages: string[]
  vipOnly?: boolean
}

export interface MeasurementPayload {
  serviceType: string
  height: number
  weight: number
  bust: number
  waist: number
  hips: number
  shoulder: number
  frontImage: string
  sideImage: string
  backImage?: string
  detailImages?: string[]
  notes?: string
  vipOnly?: boolean
}

export function resolveMediaUrl(url: string) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${API_BASE_URL}${url}`
}

export async function uploadCustomImage(filePath: string) {
  // 云开发模式下改走「云存储 → 后端下载落盘」，理由见 utils/cloud.ts
  if (USE_CLOUD) {
    const { url } = await cloudUploadImage(filePath, 'custom')
    return await request<{ url: string }>({
      url: '/api/custom/upload-remote',
      method: 'POST',
      data: { url },
    })
  }
  const token = await ensureToken()
  return new Promise<{ url: string }>((resolve, reject) => {
    uni.uploadFile({
      url: `${API_BASE_URL}/api/custom/upload`,
      filePath,
      name: 'file',
      header: {
        Authorization: `Bearer ${token}`,
      },
      success: (res) => {
        let payload: any = {}
        try {
          payload = JSON.parse(res.data || '{}')
        } catch {
          reject(new Error('图片上传返回格式异常'))
          return
        }
        if (res.statusCode >= 400) {
          const error = new Error(payload?.message || '图片上传失败')
          ;(error as any).statusCode = res.statusCode
          reject(error)
          return
        }
        resolve(payload)
      },
      fail: (err) => reject(new Error(err.errMsg || '图片上传失败')),
    })
  })
}

export async function uploadCustomImages(paths: string[]) {
  const urls: string[] = []
  for (const path of paths) {
    const result = await uploadCustomImage(path)
    urls.push(result.url)
  }
  return urls
}

export function fetchCustomSummary() {
  return request<CustomSummary>({ url: '/api/custom/me' })
}

export async function fetchCustomRequests() {
  const data = await request<{ requests?: CustomRequest[] }>({
    url: '/api/custom/requests',
  })
  return data.requests || []
}

export async function submitCustomInquiry(payload: InquiryPayload) {
  const data = await request<{ request: CustomRequest }>({
    url: '/api/custom/inquiries',
    method: 'POST',
    data: payload,
  })
  return data.request
}

export async function submitCustomMeasurement(payload: MeasurementPayload) {
  const data = await request<{ request: CustomRequest }>({
    url: '/api/custom/measurements',
    method: 'POST',
    data: payload,
  })
  return data.request
}

export function fetchCustomRequestDetail(id: number) {
  return request<CustomRequestDetail>({
    url: `/api/custom/requests/${id}`,
  })
}

export async function advanceCustomRequest(id: number) {
  const data = await request<{ request: CustomRequest }>({
    url: `/api/custom/requests/${id}/advance`,
    method: 'POST',
  })
  return data.request
}

export async function sendDesignerMessage(id: number, content: string) {
  const data = await request<{ messages: CustomMessage[] }>({
    url: `/api/custom/requests/${id}/messages`,
    method: 'POST',
    data: { content },
  })
  return data.messages || []
}

export function upgradeCustomMembership() {
  return request<CustomSummary>({
    url: '/api/custom/membership/upgrade',
    method: 'POST',
  })
}
