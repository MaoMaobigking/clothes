/**
 * JWT 鉴权中间件
 * - 从 Authorization 头提取 Bearer token
 * - 验证后挂载 req.userId
 * - 未登录返回 401
 */
import jwt from 'jsonwebtoken'
import { config } from '../config/env.mjs'

/**
 * JWT 密钥必须来自环境变量，没有就直接拒绝启动。
 *
 * 原来写的是 `process.env.JWT_SECRET || 'lingxi-dev-secret-...'`。
 * 这种兜底默认值是真实事故来源：一旦忘配环境变量，线上就在用一个
 * 写在开源代码里的密钥签 token —— 任何人都能自己签一个 userId=任意值 的
 * 合法 token，所有 WHERE user_id = ? 的隔离一起失效。
 * 「启动失败」比「静默用弱密钥跑起来」安全得多。
 *
 * 读取上移到了 config/env.mjs，但这条硬性拒绝**留在这里**：
 * config 那层只读不抛，改在那里抛会让本来不碰鉴权的脚本也起不来。
 */
const JWT_SECRET = config.auth.jwtSecret
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  //主动让程序崩掉，并附上一句话说明原因
  throw new Error(
    '缺少 JWT_SECRET 环境变量（或长度不足 16）。请在 server/.env 中配置，' +
      "可用 node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" 生成。",
  )
}

/**
 * 签发 JWT
 * @param {object} payload - { userId, openid, role }
 * @returns {string} token
 */
export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

/**
 * 验证 JWT
 * @param {string} token
 * @returns {object|null} payload 或 null
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

/**
 * Express 中间件：必须登录
 * 适用于登录才能看的页面
 */
export function authRequired(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.replace(/^Bearer\s+/i, '')
  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: '请先登录' })
  }
  const payload = verifyToken(token)
  if (!payload) {
    return res.status(401).json({ error: 'TOKEN_INVALID', message: '登录已过期，请重新登录' })
  }
  req.userId = payload.userId
  req.userOpenid = payload.openid
  req.userRole = payload.role || 'user'
  next()
}

/**
 * Express 中间件：可选登录（不强制，但如果有 token 就解析）
 * 适用于不登录也能看的页面
 */
export function authOptional(req, _res, next) {
  const header = req.headers.authorization || ''
  const token = header.replace(/^Bearer\s+/i, '')
  if (token) {
    const payload = verifyToken(token)
    if (payload) {
      req.userId = payload.userId
      req.userOpenid = payload.openid
      req.userRole = payload.role || 'user'
    }
  }
  next()
}
