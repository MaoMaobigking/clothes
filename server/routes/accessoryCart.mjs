import { Router } from 'express'
import { authRequired } from '../middleware/auth.mjs'
import * as cartService from '../services/accessoryCartService.mjs'

const router = Router()
router.use(authRequired)

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

router.get('/', asyncHandler(async (req, res) => {
  res.json(await cartService.listCart(req.userId))
}))

router.post('/', asyncHandler(async (req, res) => {
  res.status(201).json(await cartService.addItem(req.userId, req.body || {}))
}))

router.post('/batch', asyncHandler(async (req, res) => {
  res.status(201).json(await cartService.addBatch(req.userId, req.body?.items || []))
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  const ok = await cartService.removeItem(req.userId, req.params.id)
  if (!ok) return res.status(404).json({ error: 'NOT_FOUND', message: '购物车商品不存在' })
  res.json({ ok: true })
}))

export default router
