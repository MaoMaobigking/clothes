/*
 * 登录相关的数据结构（规格 §5）。
 */

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
