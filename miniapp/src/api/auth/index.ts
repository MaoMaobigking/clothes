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
import type { DemoAccount, LoginResult, MyProfile } from './type'

enum API {
  /** 账号密码登录 */
  LOGIN_PASSWORD_URL = '/api/auth/login-password',
  /** 微信 code 换 token */
  LOGIN_WECHAT_URL = '/api/auth/login',
  /** 管理员独立密码 */
  ADMIN_LOGIN_URL = '/api/auth/admin-login',
  /** 开发身份，仅非生产环境 */
  DEV_TOKEN_URL = '/api/auth/dev-token',
  /** 演示账号清单 */
  DEMO_ACCOUNTS_URL = '/api/auth/demo-accounts',
  /** 当前身份，GET 校验 / PUT 改资料 */
  ME_URL = '/api/auth/me',
}

/** 类型再导出的理由见 api/diary/index.ts 的说明 */
export type { DemoAccount, LoginResult, MyProfile } from './type'

/** 账号密码登录（§5.1、§5.2） */
export function loginByPassword(account: string, password: string) {
  return publicRequest<LoginResult>({
    url: API.LOGIN_PASSWORD_URL,
    method: 'POST',
    data: { account, password },
  })
}

/** 微信 code 换 token（§5.1）。code 由 uni.login 拿，只有小程序端能拿到真的。 */
export function loginByWechatCode(code: string) {
  return publicRequest<LoginResult>({
    url: API.LOGIN_WECHAT_URL,
    method: 'POST',
    data: { code },
  })
}

/** 管理员独立密码（§5.3）。成功后返回的是管理员身份的 token。 */
export function loginAsAdmin(password: string) {
  return publicRequest<LoginResult>({
    url: API.ADMIN_LOGIN_URL,
    method: 'POST',
    data: { password },
  })
}

/** 开发身份：换 tag 就是换一个人，用来手测数据隔离。 */
export function loginAsDev(tag?: string) {
  return publicRequest<LoginResult>({
    url: API.DEV_TOKEN_URL,
    method: 'POST',
    data: { tag: tag || getDevTag() },
  })
}

/** 演示账号清单（§5.4）。非生产环境会带上密码，方便现场一键填入。 */
export async function fetchDemoAccounts(): Promise<DemoAccount[]> {
  const data = await publicRequest<{ accounts?: DemoAccount[] }>({
    url: API.DEMO_ACCOUNTS_URL,
  })
  return data.accounts || []
}

/** 校验当前 token 是否仍然有效，顺带拿回资料 */
export function fetchMe() {
  return request<{
    ok: boolean
    user: { userId: number; openid: string; role: string }
    profile?: MyProfile
  }>({
    url: API.ME_URL,
  })
}

/** 保存昵称 / 头像。只传要改的字段，后端也只认这两个。 */
export async function apiUpdateMe(patch: { nickname?: string; avatarUrl?: string }): Promise<MyProfile> {
  const data = await request<{ profile: MyProfile }>({
    url: API.ME_URL,
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
