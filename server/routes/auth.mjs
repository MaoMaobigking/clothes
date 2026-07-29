/*
 * 认证路由
 *  - POST /login 微信登录
 *  - POST /dev-token 开发用（仅非生产环境）
 */
import { Router } from 'express'
import { wxLogin, devToken, checkToken } from '../services/authService.mjs'

const router = Router()

// POST /api/auth/login → 微信登录
router.post('/login', async (req, res, next) => {
  try {
    const { code } = req.body || {}
    if (!code) return res.status(400).json({ error: 'MISSING_CODE', message: '缺少登录凭证 code' })
    const result = await wxLogin(code)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/dev-token → 开发用，生成测试 token
if (process.env.NODE_ENV !== 'production') {
  router.post('/dev-token', (_req, res) => {
    const token = devToken(1)
    res.json({ token, note: '开发环境专用，生产环境禁用' })
  })
}

// GET /api/auth/me → 检查当前 token 是否有效
router.get('/me', (req, res) => {
  const header = req.headers.authorization || ''
  const token = header.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' })
  const user = checkToken(token)
  if (!user) return res.status(401).json({ error: 'TOKEN_INVALID' })
  res.json({ ok: true, user })
})

export default router
