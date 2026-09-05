/**
 * 配饰购物车路由 —— 已弃用（规格 §4.5 §13）
 *
 * 购物车已统一到 /api/cart，本路由转发到同一个 service，
 * 只为兼容前端 api/accessories.ts 与 checkAccessories.mjs 的历史调用。
 * 新前端代码请用 /api/cart。
 */
import { Router } from 'express'
import { authRequired } from '../middleware/auth.mjs'
import * as cartService from '../services/cartService.mjs'

const router = Router()
router.use(authRequired)

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await cartService.listCart(req.userId))
  }),
)

router.post(
  '/',
  asyncHandler(async (req, res) => {
    res.status(201).json(await cartService.addItem(req.userId, req.body || {}))
  }),
)

router.post(
  '/batch',
  asyncHandler(async (req, res) => {
    res.status(201).json(await cartService.addBatch(req.userId, req.body?.items || []))
  }),
)

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const item = await cartService.setCartQuantity(req.userId, Number(req.params.id), req.body?.quantity)
    res.json({ item })
  }),
)

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const ok = await cartService.removeItem(req.userId, Number(req.params.id))
    if (!ok) return res.status(404).json({ error: 'NOT_FOUND', message: '购物车商品不存在' })
    res.json({ ok: true })
  }),
)

export default router
