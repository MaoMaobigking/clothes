/*
 * 高级定制（功能六）的数据结构。
 */

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
