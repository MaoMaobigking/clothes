/*
 * uni-app 请求底座。
 *
 * 规格 §5 之后的关键变化：这里不再「无 token 就偷偷建号」。
 * 以前 ensureToken() 会自动调 /api/auth/dev-token 造一个新用户，
 * 表现上人人都能进，实际上每次清缓存就换一个人，
 * 「数据重新打开仍存在」这条验收根本立不住。
 * 现在无 token 一律抛 NO_AUTH 并跳登录页，身份只能从登录页拿。
 */

import { USE_CLOUD, cloudRequest, rewriteAssetPaths } from './cloud'
import { ROUTES } from '@/constants/routes'

/*
 * 接口根地址。打包时用 VITE_API_BASE_URL 注入，不注入则退回开发地址。
 *
 * H5 默认留空 = 走同源 /api/*：开发时被 vite proxy 转到 8787，
 * 部署时由后端自己托管 H5 产物（server/index.mjs 末尾那段 static），
 * 所以前后端天然同域，不用配 CORS 也不用填地址。
 *
 * 小程序没有「同源」这回事，必须写全 URL，所以单独留了
 * VITE_MP_DEV_API_BASE_URL（见 miniapp/.env.development）：
 * 默认 127.0.0.1 只在开发者工具里有效，真机上它指的是手机自己 ——
 * 用真机调试时把它改成你电脑的局域网 IP，比如 http://192.168.1.5:8787，
 * 不用再改源码。
 *
 * 要发体验版给别人看，打包前注入公网地址：
 *   VITE_API_BASE_URL=https://demo.example.com npm run build:mp-weixin
 */
export const API_BASE_URL = (() => {
  const injected = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (injected) return injected.replace(/\/$/, '')
  // #ifdef H5
  return ''
  // #endif
  // #ifndef H5
  // 末位兜底保留字面量：没有任何 .env 文件时也能在开发者工具里直接跑起来
  return (import.meta.env.VITE_MP_DEV_API_BASE_URL as string) || 'http://127.0.0.1:8787'
  // #endif
})()

const TOKEN_KEY = 'ai-fashion-token'
const DEV_TAG_KEY = 'ai-fashion-dev-tag'

/**
 * 登录页路径。放常量是为了让「跳登录」和「判断当前是否已在登录页」用同一个来源。
 *
 * 值本身来自 constants/routes.ts —— 那里是全站路由表。
 * 这里保留这个导出名（stores/auth.ts 在用），但不再自己写死路径字符串，
 * 否则改登录页路径时会漏掉这一处。
 */
export const LOGIN_PAGE: string = ROUTES.login

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
  const header = {
    'Content-Type': 'application/json',
    ...(options.withAuth === false ? {} : { Authorization: `Bearer ${getToken()}` }),
    ...(options.header || {}),
  }

  /*
   * 走云函数转发。原因见 cloudfunctions/api/index.js：小程序 request 只认
   * 已备案域名，裸公网 IP 填不进去；云函数出网没这个限制。
   * 没开云开发时这段整个跳过，链路和以前完全一样。
   */
  if (USE_CLOUD) {
    return cloudRequest({ url: options.url, method: options.method || 'GET', data: options.data, header }).then(
      (res) => {
        if (res.statusCode >= 400) {
          const payload = res.data as any
          const message = payload?.message || payload?.error || `请求失败（${res.statusCode}）`
          throw makeError(message, res.statusCode, payload?.error)
        }
        return rewriteAssetPaths(res.data as T)
      },
    )
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: `${API_BASE_URL}${options.url}`,
      method: (options.method || 'GET') as any,
      data: options.data,
      header,
      success: (res) => {
        if (res.statusCode >= 400) {
          const payload = res.data as any
          const message = payload?.message || payload?.error || `请求失败（${res.statusCode}）`
          reject(makeError(message, res.statusCode, payload?.error))
          return
        }
        resolve(rewriteAssetPaths(res.data as T))
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

/**
 * 身份被服务端拒了之后的统一收尾：清 token、提示一次、回登录页，并造出要抛的错。
 *
 * 抽出来是因为现在有三条路会撞上 401（request / uploadFile / SSE 流式对话），
 * 三处各写一遍迟早会漏掉其中一步 —— 漏掉 clearToken 就会拿着废 token 反复重试，
 * 漏掉 redirectToLogin 就停在一个永远加载不出来的页面上。
 */
export function handleUnauthorized(): ApiError {
  clearToken()
  notifySessionExpired()
  redirectToLogin()
  return makeError('登录状态已失效，请重新登录', 401, 'NO_AUTH')
}

export async function request<T>(options: RequestOptions): Promise<T> {
  await ensureToken()
  try {
    return await rawRequest<T>(options)
  } catch (error) {
    if ((error as ApiError)?.statusCode !== 401) throw error
    // token 过期或被服务端拒绝：清掉并回登录页，不再静默换一个身份继续跑
    throw handleUnauthorized()
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
            reject(handleUnauthorized())
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
