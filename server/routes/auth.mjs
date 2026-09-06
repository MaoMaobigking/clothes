/*
 * 认证路由
 *  - POST /login          微信一键注册 / 登录（规格 §5.1）
 *  - POST /login-password 账号密码登录（规格 §5.1、§5.2）
 *  - GET  /demo-accounts  H5 兜底演示账号选择器（规格 §5.4）
 *  - POST /admin-login    管理员独立密码（规格 §5.3）
 *  - POST /dev-token      开发用（仅非生产环境）
 *  - GET  /me             校验 token，顺带回当前资料（规格 §11.2）
 *  - PUT  /me             改昵称 / 头像（规格 §11.2）
 */
import { Router } from 'express'
import { authRequired } from '../middleware/auth.mjs'
import {
  wxLogin,
  devToken,
  checkToken,
  adminLogin,
  passwordLogin,
  listDemoAccounts,
  getMyProfile,
  updateMyProfile,
} from '../services/authService.mjs'
import { config } from '../config/env.mjs'

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

// POST /api/auth/login-password → 账号密码登录
router.post('/login-password', async (req, res, next) => {
  try {
    const { account, password } = req.body || {}
    res.json(await passwordLogin(account, password))
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/demo-accounts → 演示账号清单
// 小程序端不调用这个接口，账号选择器只在 H5 兜底入口出现。
router.get('/demo-accounts', async (_req, res, next) => {
  try {
    res.json({ accounts: await listDemoAccounts() })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/dev-token → 开发用，走完整登录流程建一个真用户
// body: { tag } —— 换 tag 就是换一个人，用来手测数据隔离
if (!config.runtime.isProduction) {
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

// POST /api/auth/admin-login → 功能六轻量管理员看板
router.post('/admin-login', async (req, res, next) => {
  try {
    const result = await adminLogin(req.body?.password)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/me → 检查当前 token 是否有效，顺带回一份当前资料
//
// 这条不走 authRequired：它本来就是「token 还能用吗」的探针，
// 401 是正常答案之一，中间件那套统一错误反而不好在前端区分。
router.get('/me', async (req, res, next) => {
  const header = req.headers.authorization || ''
  const token = header.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' })
  const user = checkToken(token)
  if (!user) return res.status(401).json({ error: 'TOKEN_INVALID' })
  try {
    // profile 是后加的（编辑资料要拿昵称和头像回填），user 保持原样别动 ——
    // 前端 stores/auth.ts 的 verify() 读的是 user.role。
    res.json({ ok: true, user, profile: await getMyProfile(user.userId) })
  } catch (err) {
    next(err)
  }
})

// PUT /api/auth/me → 编辑资料（规格 §11.2）。只能改自己的昵称和头像。
router.put('/me', authRequired, async (req, res, next) => {
  try {
    res.json({ profile: await updateMyProfile(req.userId, req.body || {}) })
  } catch (err) {
    next(err)
  }
})

export default router
