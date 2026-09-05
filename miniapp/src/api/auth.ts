/*
 * 登录相关接口（规格 §5）。
 *
 * 四条登录路径，对应后端 server/routes/auth.mjs：
 *   1. 账号密码      POST /api/auth/login-password
 *   2. 微信一键注册  POST /api/auth/login          （首次即注册，之后同一 openid 回到同一账号）
 *   3. 管理员密码    POST /api/auth/admin-login
 *   4. 开发身份      POST /api/auth/dev-token      （仅非生产环境，登录页开发入口）
 *
 * 全部走 publicRequest：登录时手里的 token 可能已经失效，
 * 带上去只会被 401 拦截器踢回登录页。
 */
import { getDevTag, publicRequest, request } from '@/utils/request'

export interface LoginResult {
  token: string
  userId: number
  openid?: string
  account?: string
  role?: string
  nickname?: string
  /** 头像 emoji（见下面 MyProfile 的说明），登录时一并下发 */
  avatarUrl?: string
  demoKind?: string | null
  isNewUser?: boolean
}

export interface DemoAccount {
  account: string
  nickname: string
  role: string
  kind: string
  label: string
  description: string
  /** 生产环境后端不下发密码，这里就是 undefined */
  password?: string
}

/** 账号密码登录（§5.1、§5.2） */
export function loginByPassword(account: string, password: string) {
  return publicRequest<LoginResult>({
    url: '/api/auth/login-password',
    method: 'POST',
    data: { account, password },
  })
}

/** 微信 code 换 token（§5.1）。code 由 uni.login 拿，只有小程序端能拿到真的。 */
export function loginByWechatCode(code: string) {
  return publicRequest<LoginResult>({
    url: '/api/auth/login',
    method: 'POST',
    data: { code },
  })
}

/** 管理员独立密码（§5.3）。成功后返回的是管理员身份的 token。 */
export function loginAsAdmin(password: string) {
  return publicRequest<LoginResult>({
    url: '/api/auth/admin-login',
    method: 'POST',
    data: { password },
  })
}

/** 开发身份：换 tag 就是换一个人，用来手测数据隔离。 */
export function loginAsDev(tag?: string) {
  return publicRequest<LoginResult>({
    url: '/api/auth/dev-token',
    method: 'POST',
    data: { tag: tag || getDevTag() },
  })
}

/** 演示账号清单（§5.4）。非生产环境会带上密码，方便现场一键填入。 */
export async function fetchDemoAccounts(): Promise<DemoAccount[]> {
  const data = await publicRequest<{ accounts?: DemoAccount[] }>({
    url: '/api/auth/demo-accounts',
  })
  return data.accounts || []
}

/**
 * 当前用户资料（规格 §11.2）。
 * avatarUrl 存的是一个 emoji，不是图片地址 —— 社群那边把它当文本直接渲染，
 * 「我的」页则用 iconForEmoji() 换成线性图标。命名沿用数据库列名，没改。
 */
export interface MyProfile {
  userId: number
  account: string
  nickname: string
  avatarUrl: string
  role: string
  membershipLevel: string
  demoKind: string | null
}

/** 校验当前 token 是否仍然有效，顺带拿回资料 */
export function fetchMe() {
  return request<{
    ok: boolean
    user: { userId: number; openid: string; role: string }
    profile?: MyProfile
  }>({
    url: '/api/auth/me',
  })
}

/** 保存昵称 / 头像。只传要改的字段，后端也只认这两个。 */
export async function apiUpdateMe(patch: { nickname?: string; avatarUrl?: string }): Promise<MyProfile> {
  const data = await request<{ profile: MyProfile }>({
    url: '/api/auth/me',
    method: 'PUT',
    data: patch,
  })
  return data.profile
}

/**
 * 取微信登录 code。
 * H5 没有微信运行环境，uni.login 会走 fail，这里统一转成可读错误，
 * 由调用方提示改用演示账号 —— 别在 H5 上假装微信登录成功。
 */
export function getWechatCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (res: any) => {
        if (res?.code) resolve(res.code)
        else reject(new Error('未获取到微信登录凭证'))
      },
      fail: () => reject(new Error('当前环境不支持微信登录')),
    })
  })
}
