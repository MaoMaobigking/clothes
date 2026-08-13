/*
 * uni-app 请求底座。
 *
 * 开发阶段使用后端 dev-token 建立稳定用户身份；
 * 正式上线前应替换为 /api/auth/login + uni.login 的微信登录流程。
 */

export const API_BASE_URL = (() => {
  // #ifdef H5
  return ''
  // #endif
  // #ifndef H5
  return 'http://127.0.0.1:8787'
  // #endif
})()

const TOKEN_KEY = 'ai-fashion-token'
const DEV_TAG_KEY = 'ai-fashion-dev-tag'

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
  withAuth?: boolean
}

function getToken() {
  return uni.getStorageSync(TOKEN_KEY) || ''
}

function setToken(token: string) {
  uni.setStorageSync(TOKEN_KEY, token)
}

export function setAuthToken(token: string) {
  setToken(token)
}

function getDevTag() {
  let tag = uni.getStorageSync(DEV_TAG_KEY)
  if (!tag) {
    tag = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    uni.setStorageSync(DEV_TAG_KEY, tag)
  }
  return tag
}

function rawRequest<T>(options: RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${API_BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        ...(options.withAuth === false ? {} : { Authorization: `Bearer ${getToken()}` }),
        ...(options.header || {}),
      },
      success: (res) => {
        if (res.statusCode >= 400) {
          const payload = res.data as any
          const message = payload?.message || payload?.error || `请求失败（${res.statusCode}）`
          const error = new Error(message) as Error & { statusCode?: number; code?: string }
          error.statusCode = res.statusCode
          error.code = payload?.error
          reject(error)
          return
        }
        resolve(res.data as T)
      },
      fail: (err) => reject(new Error(err.errMsg || '网络请求失败')),
    })
  })
}

export async function ensureToken(): Promise<string> {
  const cached = getToken()
  if (cached) return cached

  const data = await rawRequest<{ token?: string; userId?: number }>({
    url: '/api/auth/dev-token',
    method: 'POST',
    data: { tag: getDevTag() },
    withAuth: false,
  })
  if (!data.token) throw new Error('登录返回中没有 token')
  setToken(data.token)
  return data.token
}

export function clearToken() {
  uni.removeStorageSync(TOKEN_KEY)
}

export async function request<T>(options: RequestOptions): Promise<T> {
  await ensureToken()
  try {
    return await rawRequest<T>(options)
  } catch (error) {
    const statusCode = (error as any)?.statusCode
    if (statusCode !== 401) throw error

    // 开发 token 失效时重新建立身份并只重试一次。
    clearToken()
    await ensureToken()
    return rawRequest<T>(options)
  }
}
