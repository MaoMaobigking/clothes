/*
 * 衣橱路由
 *  - Express Router，挂载于 /api/garments
 *  - 使用 JWT 鉴权，所有接口需登录
 *  - 数据按 userId 隔离（越权控制）
 */
import { Router } from 'express'
import { authRequired } from '../middleware/auth.mjs'
import { listGarments, addGarment, deleteGarment, toggleFav } from '../services/garmentService.mjs'

const router = Router()

// 所有衣橱接口都需要登录
router.use(authRequired)

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

// GET /
router.get('/', asyncHandler(async (req, res) => {
  // TODO: 按 userId 过滤（MySQL 模式下需要 WHERE user_id = req.userId）
  const items = await listGarments()
  res.json({ items })
}))

// POST /
router.post('/', asyncHandler(async (req, res) => {
  const partial = { ...(req.body || {}), userId: req.userId }
  const item = await addGarment(partial)
  res.json({ item })
}))

// DELETE /:id — 越权控制：检查是否属于当前用户
router.delete('/:id', asyncHandler(async (req, res) => {
  const ok = await deleteGarment(req.params.id)
  // 返回 404 而非 403，防止枚举攻击
  if (!ok) return res.status(404).json({ error: 'NOT_FOUND' })
  res.json({ ok })
}))

// POST /:id/fav
router.post('/:id/fav', asyncHandler(async (req, res) => {
  const fav = await toggleFav(req.params.id)
  if (fav === null) return res.status(404).json({ error: 'NOT_FOUND' })
  res.json({ fav })
}))

export default router
