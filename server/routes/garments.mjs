/*
 * 衣橱路由（Controller）
 *  - 挂载于 /api/garments，全部接口需登录
 *  - 只做：取参数 → 调 service → 定 HTTP 状态码
 *
 * 越权控制：userId 一律取 req.userId（JWT 解出来的），
 * 绝不接受请求体里的 userId —— 那等于让客户端自己声明身份。
 */
import { Router } from 'express'
import { authRequired } from '../middleware/auth.mjs'
import * as garmentService from '../services/garmentService.mjs'

const router = Router()

router.use(authRequired)

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

// GET / — 只返回当前用户的衣物
router.get('/', asyncHandler(async (req, res) => {
  const items = await garmentService.listGarments(req.userId)
  res.json({ items })
}))

// POST /
router.post('/', asyncHandler(async (req, res) => {
  const body = { ...(req.body || {}) }
  // 防御性剔除：客户端传什么 userId/user_id 都不算
  delete body.userId
  delete body.user_id
  const item = await garmentService.addGarment(req.userId, body)
  res.status(201).json({ item })
}))

// DELETE /:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const ok = await garmentService.deleteGarment(req.userId, req.params.id)
  // 别人的资源返 404 而不是 403：403 等于告诉攻击者「这个 id 存在」，可被枚举
  if (!ok) return res.status(404).json({ error: 'NOT_FOUND', message: '衣物不存在' })
  res.json({ ok: true })
}))

// POST /:id/fav
router.post('/:id/fav', asyncHandler(async (req, res) => {
  const fav = await garmentService.toggleFav(req.userId, req.params.id)
  if (fav === null) return res.status(404).json({ error: 'NOT_FOUND', message: '衣物不存在' })
  res.json({ fav })
}))

export default router
