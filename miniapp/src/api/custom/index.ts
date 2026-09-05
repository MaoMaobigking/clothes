/*
 * 高级定制接口（功能六）。
 */
import { API_BASE_URL, ensureToken, request } from '@/utils/request'
import { USE_CLOUD, cloudUploadImage } from '@/utils/cloud'
import type {
  CustomMessage,
  CustomRequest,
  CustomRequestDetail,
  CustomSummary,
  InquiryPayload,
  MeasurementPayload,
} from './type'

enum API {
  /** 当前用户的定制概况（会员等级、已提交数） */
  ME_URL = '/api/custom/me',
  /** 定制申请列表 */
  REQUESTS_URL = '/api/custom/requests',
  /** 单条申请，后面接 id 再拼 /advance、/messages */
  REQUEST_URL = '/api/custom/requests/',
  /** 咨询式提交 */
  INQUIRIES_URL = '/api/custom/inquiries',
  /** 量体式提交 */
  MEASUREMENTS_URL = '/api/custom/measurements',
  /** 会员升级 */
  MEMBERSHIP_UPGRADE_URL = '/api/custom/membership/upgrade',
  /** multipart 上传 */
  UPLOAD_URL = '/api/custom/upload',
  /** 云开发链路：传云存储后交给后端下载落盘 */
  UPLOAD_REMOTE_URL = '/api/custom/upload-remote',
}

/** 类型再导出的理由见 api/diary/index.ts 的说明 */
export type {
  CustomDesigner,
  CustomMeasurement,
  CustomMessage,
  CustomRequest,
  CustomRequestDetail,
  CustomRequestStatus,
  CustomSummary,
  InquiryPayload,
  MeasurementPayload,
} from './type'

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
      url: API.UPLOAD_REMOTE_URL,
      method: 'POST',
      data: { url },
    })
  }
  const token = await ensureToken()
  return new Promise<{ url: string }>((resolve, reject) => {
    uni.uploadFile({
      url: `${API_BASE_URL}${API.UPLOAD_URL}`,
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
  return request<CustomSummary>({ url: API.ME_URL })
}

export async function fetchCustomRequests() {
  const data = await request<{ requests?: CustomRequest[] }>({
    url: API.REQUESTS_URL,
  })
  return data.requests || []
}

export async function submitCustomInquiry(payload: InquiryPayload) {
  const data = await request<{ request: CustomRequest }>({
    url: API.INQUIRIES_URL,
    method: 'POST',
    data: payload,
  })
  return data.request
}

export async function submitCustomMeasurement(payload: MeasurementPayload) {
  const data = await request<{ request: CustomRequest }>({
    url: API.MEASUREMENTS_URL,
    method: 'POST',
    data: payload,
  })
  return data.request
}

export function fetchCustomRequestDetail(id: number) {
  return request<CustomRequestDetail>({
    url: API.REQUEST_URL + id,
  })
}

export async function advanceCustomRequest(id: number) {
  const data = await request<{ request: CustomRequest }>({
    url: `${API.REQUEST_URL}${id}/advance`,
    method: 'POST',
  })
  return data.request
}

export async function sendDesignerMessage(id: number, content: string) {
  const data = await request<{ messages: CustomMessage[] }>({
    url: `${API.REQUEST_URL}${id}/messages`,
    method: 'POST',
    data: { content },
  })
  return data.messages || []
}

export function upgradeCustomMembership() {
  return request<CustomSummary>({
    url: API.MEMBERSHIP_UPGRADE_URL,
    method: 'POST',
  })
}
