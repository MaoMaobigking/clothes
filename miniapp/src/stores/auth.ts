/*
 * 登录态（规格 §5）。
 *
 * token 存在 http.ts（请求层要用），这里存「人是谁」：昵称、角色、演示账号类型。
 * 两边都落 storage，H5 刷新页面后不会退回未登录。
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  fetchMe,
  getWechatCode,
  loginAsAdmin,
  loginAsDev,
  loginByPassword,
  loginByWechatCode,
  type LoginResult,
} from '@/api/auth'
import { LOGIN_PAGE, clearToken, getToken, setAuthToken } from '@/api/http'
import { useProfileStore } from './profile'
import { useWardrobeStore } from './wardrobe'
import { useCartStore } from './cart'

const SESSION_KEY = 'ai-fashion-session'

/**
 * 跟人绑定、又落在本地的缓存键。换人登录必须清掉。
 * 不清的话：从演示女性退出、用空白账号登录，五步测试页 loadPersisted()
 * 会把上一个人的画像读回来，「空白账号从零开始」这条验收当场就假了。
 */
const USER_SCOPED_STORAGE_KEYS = ['ai-fashion-profile']

export interface Session {
  userId: number
  nickname: string
  role: string
  account: string
  demoKind: string | null
}

function emptySession(): Session {
  return { userId: 0, nickname: '', role: 'user', account: '', demoKind: null }
}

function readSession(): Session {
  try {
    const raw = uni.getStorageSync(SESSION_KEY)
    if (!raw) return emptySession()
    const saved = typeof raw === 'string' ? JSON.parse(raw) : raw
    return { ...emptySession(), ...saved }
  } catch {
    return emptySession()
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(getToken())
  const session = ref<Session>(readSession())
  const loading = ref(false)

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => session.value.role === 'admin')
  const displayName = computed(() => session.value.nickname || session.value.account || '时尚探索家')

  function purgeUserScopedCaches() {
    USER_SCOPED_STORAGE_KEYS.forEach((key) => {
      try {
        uni.removeStorageSync(key)
      } catch {
        // 清缓存失败不该挡住登录/退出
      }
    })
    // pinia store 活在内存里，reLaunch 不会重建，这里显式回到初始态
    try {
      useProfileStore().reset()
      useWardrobeStore().reset()
      // 购物车按人落库，不清会让新账号先看到上一个人的车再被刷新覆盖
      useCartStore().reset()
    } catch {
      // store 尚未初始化时忽略
    }
  }

  /**
   * 登录成功后统一落地：换人就清掉上一个人的本地缓存。
   *
   * 顺序要紧：先写 token 再清缓存。反过来的话，清缓存里 useWardrobeStore()
   * 第一次实例化会立刻发一次列表请求，此时手上还没有新 token，
   * 请求层判定未登录，人在登录成功的瞬间被踢回登录页。
   */
  function applyLogin(result: LoginResult) {
    const switched = !!session.value.userId && session.value.userId !== result.userId

    setAuthToken(result.token)
    token.value = result.token
    session.value = {
      userId: result.userId,
      nickname: result.nickname || '',
      role: result.role || 'user',
      account: result.account || '',
      demoKind: result.demoKind ?? null,
    }
    uni.setStorageSync(SESSION_KEY, JSON.stringify(session.value))

    if (switched) purgeUserScopedCaches()
    return result
  }

  async function withLoading<T>(fn: () => Promise<T>): Promise<T> {
    loading.value = true
    try {
      return await fn()
    } finally {
      loading.value = false
    }
  }

  /** 账号密码登录（§5.1、§5.2） */
  function signInWithPassword(account: string, password: string) {
    return withLoading(async () => applyLogin(await loginByPassword(account, password)))
  }

  /** 微信一键注册 / 登录（§5.1）。首次即注册，之后同一 openid 回到同一账号。 */
  function signInWithWechat() {
    return withLoading(async () => applyLogin(await loginByWechatCode(await getWechatCode())))
  }

  /** 管理员密码（§5.3）。成功后当前身份就是管理员账号。 */
  function signInAsAdmin(password: string) {
    return withLoading(async () => applyLogin(await loginAsAdmin(password)))
  }

  /** 开发身份，仅登录页开发入口使用 */
  function signInAsDev(tag?: string) {
    return withLoading(async () => applyLogin(await loginAsDev(tag)))
  }

  /**
   * 用后端校验一次当前 token。
   * 本地有 token 不代表还有效 —— 服务重启换了 JWT 密钥、或者库被重置过，
   * token 就成了空壳，不校验的话人会卡在「看着已登录、每个接口都 401」。
   */
  async function verify(): Promise<boolean> {
    if (!token.value) return false
    try {
      const data = await fetchMe()
      if (data?.user?.role && data.user.role !== session.value.role) {
        session.value = { ...session.value, role: data.user.role }
        uni.setStorageSync(SESSION_KEY, JSON.stringify(session.value))
      }
      return true
    } catch {
      clearSession()
      return false
    }
  }

  /** 只清身份，不跳页面 */
  function clearSession() {
    clearToken()
    token.value = ''
    session.value = emptySession()
    uni.removeStorageSync(SESSION_KEY)
    purgeUserScopedCaches()
  }

  /** 退出登录并回到登录页 */
  function logout() {
    clearSession()
    uni.reLaunch({ url: LOGIN_PAGE })
  }

  return {
    token,
    session,
    loading,
    isLoggedIn,
    isAdmin,
    displayName,
    applyLogin,
    signInWithPassword,
    signInWithWechat,
    signInAsAdmin,
    signInAsDev,
    verify,
    clearSession,
    logout,
  }
})
