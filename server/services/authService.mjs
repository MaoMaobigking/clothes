/*
 * 认证服务
 *  - 微信小程序登录流程：code → openid → JWT
 *  - 当前使用 mock（待接入真实微信 API）
 */
import { signToken, verifyToken } from '../middleware/auth.mjs'

/**
 * 微信登录
 * 真实流程：
 *   1. 前端 wx.login() 拿到 code
 *   2. 后端用 code 调微信接口 https://api.weixin.qq.com/sns/jscode2session
 *   3. 拿到 openid + session_key
 *   4. 查找/创建用户，签发 JWT
 *
 * 当前 mock：直接返回 token（开发用）
 */
export async function wxLogin(code) {
  // TODO: 替换为真实微信 API 调用
  // const wxRes = await fetch(`https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${SECRET}&js_code=${code}&grant_type=authorization_code`)
  // const { openid } = await wxRes.json()

  // Mock: 用 code 的 hash 模拟 openid
  const openid = code ? `mock_openid_${Buffer.from(code).toString('hex').slice(0, 16)}` : 'mock_openid_dev'
  const userId = 1 // TODO: 从 users 表查找/创建

  const token = signToken({ userId, openid })
  return { token, userId, openid }
}

/**
 * 验证 token 并返回用户信息
 */
export function checkToken(token) {
  const payload = verifyToken(token)
  if (!payload) return null
  return { userId: payload.userId, openid: payload.openid }
}

/** 生成开发用 token（调试用） */
export function devToken(userId = 1) {
  return signToken({ userId, openid: 'dev_openid' })
}
