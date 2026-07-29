/**
 * JWT 鉴权中间件
 * - 从 Authorization 头提取 Bearer token
 * - 验证后挂载 req.userId
 * - 未登录返回 401
 */
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'lingxi-dev-secret-change-in-production'

/**
 * 签发 JWT
 * @param {object} payload - { userId, openid }
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
  next()
}

/**
 * Express 中间件：可选登录（不强制，但如果有 token 就解析）
 */
export function authOptional(req, _res, next) {
  const header = req.headers.authorization || ''
  const token = header.replace(/^Bearer\s+/i, '')
  if (token) {
    const payload = verifyToken(token)
    if (payload) {
      req.userId = payload.userId
      req.userOpenid = payload.openid
    }
  }
  next()
}
