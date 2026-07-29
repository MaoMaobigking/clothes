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

// POST /api/auth/dev-token → 开发用，走完整登录流程建一个真用户
// body: { tag } —— 换 tag 就是换一个人，用来手测数据隔离
if (process.env.NODE_ENV !== 'production') {
  router.post('/dev-token', async (req, res, next) => {
    try {
      const { tag } = req.body || {}
      const result = await devToken(tag || 'dev')
      res.json({ ...result, note: '开发环境专用，生产环境禁用' })
    } catch (err) {
      next(err)
    }
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
