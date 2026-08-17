/*
 * uni-app 请求底座。
 *
 * 规格 §5 之后的关键变化：这里不再「无 token 就偷偷建号」。
 * 以前 ensureToken() 会自动调 /api/auth/dev-token 造一个新用户，
 * 表现上人人都能进，实际上每次清缓存就换一个人，
 * 「数据重新打开仍存在」这条验收根本立不住。
 * 现在无 token 一律抛 NO_AUTH 并跳登录页，身份只能从登录页拿。
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

/** 登录页路径。放常量是为了让「跳登录」和「判断当前是否已在登录页」用同一个来源。 */
export const LOGIN_PAGE = '/pages/login/index'

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  data?: any
  header?: Record<string, string>
  withAuth?: boolean
}

export type ApiError = Error & { statusCode?: number; code?: string }

export function getToken(): string {
  return uni.getStorageSync(TOKEN_KEY) || ''
}

export function setAuthToken(token: string) {
  uni.setStorageSync(TOKEN_KEY, token)
}

export function clearToken() {
  uni.removeStorageSync(TOKEN_KEY)
}

/** 开发入口用的稳定标识：同一台设备换 tag 就是换一个人，用来手测数据隔离。 */
export function getDevTag(): string {
  let tag = uni.getStorageSync(DEV_TAG_KEY)
  if (!tag) {
    tag = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    uni.setStorageSync(DEV_TAG_KEY, tag)
  }
  return tag
}

function makeError(message: string, statusCode: number, code: string): ApiError {
  const error = new Error(message) as ApiError
  error.statusCode = statusCode
  error.code = code
  return error
}

/**
 * 未登录错误。调用方可以用它判断「这个错要不要提示」，不必去抠文案。
 *
 * 只认 NO_AUTH（以及没带业务码的裸 401）。不能把所有 401 都算进来 ——
 * 登录类接口走 publicRequest，密码错也是 401（如 ADMIN_LOGIN_FAILED），
 * 那属于用户操作失败，必须让人看见；算成「未登录」就会被静默吞掉，
 * 表现成「点了登录什么都没发生」。
 */
export function isAuthError(error: unknown): boolean {
  const err = error as ApiError
  if (err?.code === 'NO_AUTH') return true
  return err?.statusCode === 401 && !err?.code
}

/**
 * 跳登录页。
 *
 * 两层防抖：一层是 redirecting 标志（一次 401 风暴里只跳一次），
 * 一层是判断当前栈顶已经是登录页就不跳 —— 登录页自己也会发请求，
 * 少了这层判断会在登录页上无限 reLaunch 自己。
 *
 * 还有一层是时机：微信小程序在 App.onLaunch 阶段首页还没创建完，
 * 这时候 reLaunch 会被直接吞掉，首页也不再渲染，表现就是整屏白屏。
 * 所以先等页面栈起来再跳。
 */
let redirecting = false

function whenPageStackReady(run: () => void, retry = 0) {
  let ready = false
  try {
    ready = typeof getCurrentPages === 'function' && getCurrentPages().length > 0
  } catch {
    ready = false
  }
  // 最多等 20 × 50ms；等不到就硬跳，总好过卡在没有身份的页面上
  if (!ready && retry < 20) {
    setTimeout(() => whenPageStackReady(run, retry + 1), 50)
    return
  }
  run()
}

export function redirectToLogin() {
  if (redirecting) return
  redirecting = true
  whenPageStackReady(() => {
    try {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      const top = pages[pages.length - 1] as any
      const route: string = top?.route || top?.$page?.route || ''
      if (route && `/${route}` === LOGIN_PAGE) {
        redirecting = false
        return
      }
    } catch {
      // 取不到页面栈时宁可跳一次
    }
    uni.reLaunch({
      url: LOGIN_PAGE,
      complete: () => {
        setTimeout(() => (redirecting = false), 300)
      },
    })
  })
}

/**
 * 会话过期提示。
 *
 * 只在「本来有 token、被服务端拒了」时提示一次：首次打开根本没有 token
 * 属于正常流程，那时候弹「登录已失效」是误导。有了这一处提示，各页面就
 * 不必再为 NO_AUTH 各弹一次 toast —— 页面马上要被 reLaunch 掉，
 * 那些提示只会叠在登录页上（规格 §5）。
 */
function notifySessionExpired() {
  try {
    uni.showToast({ title: '登录状态已失效，请重新登录', icon: 'none' })
  } catch {
    // 提示失败不该挡住跳转
  }
}

function rawRequest<T>(options: RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${API_BASE_URL}${options.url}`,
      method: (options.method || 'GET') as any,
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
          reject(makeError(message, res.statusCode, payload?.error))
          return
        }
        resolve(res.data as T)
      },
      fail: (err) => reject(new Error(err.errMsg || '网络请求失败')),
    })
  })
}

/**
 * 不带身份的请求，登录相关接口专用。
 * 登录接口必须走这条，否则会带上一个已失效的 token，
 * 401 拦截又把人踢回登录页 —— 登录页自己把自己刷了。
 */
export function publicRequest<T>(options: RequestOptions): Promise<T> {
  return rawRequest<T>({ ...options, withAuth: false })
}

/**
 * 取当前身份。没有就跳登录并抛 NO_AUTH，不再自动建号。
 */
export async function ensureToken(): Promise<string> {
  const cached = getToken()
  if (cached) return cached
  redirectToLogin()
  throw makeError('请先登录', 401, 'NO_AUTH')
}

export async function request<T>(options: RequestOptions): Promise<T> {
  await ensureToken()
  try {
    return await rawRequest<T>(options)
  } catch (error) {
    if ((error as ApiError)?.statusCode !== 401) throw error
    // token 过期或被服务端拒绝：清掉并回登录页，不再静默换一个身份继续跑
    clearToken()
    notifySessionExpired()
    redirectToLogin()
    throw makeError('登录状态已失效，请重新登录', 401, 'NO_AUTH')
  }
}

export async function uploadFile<T>(options: {
  url: string
  filePath: string
  name?: string
  formData?: Record<string, string>
}): Promise<T> {
  await ensureToken()
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${API_BASE_URL}${options.url}`,
      filePath: options.filePath,
      name: options.name || 'file',
      formData: options.formData || {},
      header: {
        Authorization: `Bearer ${getToken()}`,
      },
      success: (res) => {
        let payload = res.data as any
        if (typeof payload === 'string') {
          try {
            payload = JSON.parse(payload)
          } catch {
            payload = {}
          }
        }
        if (res.statusCode >= 400) {
          if (res.statusCode === 401) {
            clearToken()
            notifySessionExpired()
            redirectToLogin()
            reject(makeError('登录状态已失效，请重新登录', 401, 'NO_AUTH'))
            return
          }
          const message = payload?.message || payload?.error || `上传失败（${res.statusCode}）`
          reject(makeError(message, res.statusCode, payload?.error))
          return
        }
        resolve(payload as T)
      },
      fail: (err) => reject(new Error(err.errMsg || '图片上传失败')),
    })
  })
}
