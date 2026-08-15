/**
 * 购物车路由（规格 §4.5 §13）
 *
 * 全项目唯一的购物车 API。/api/accessory-cart 是保留兼容的旧路径，
 * 已转发到同一个 service，新代码一律用这里。
 *
 *   GET    /api/cart              购物车列表
 *   POST   /api/cart              加单件（garment / accessory / catalog）
 *   POST   /api/cart/batch        批量加
 *   POST   /api/cart/outfits/:id  整套搭配拆成单品
 *   PATCH  /api/cart/:id          改数量
 *   DELETE /api/cart/:id          删除
 */
import { Router } from 'express'
import { authRequired } from '../middleware/auth.mjs'
import * as cartService from '../services/cartService.mjs'

const router = Router()
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

router.use(authRequired)

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

// :id 是搭配 id，必须排在 /:id 之前，否则被后者吃掉
router.post(
  '/outfits/:id',
  asyncHandler(async (req, res) => {
    const cart = await cartService.addOutfitToCart(req.userId, Number(req.params.id))
    res.status(201).json(cart)
  }),
)

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const item = await cartService.setCartQuantity(
      req.userId,
      Number(req.params.id),
      req.body?.quantity,
    )
    res.json({ item })
  }),
)

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await cartService.deleteCartItem(req.userId, Number(req.params.id))
    res.json({ ok: true })
  }),
)

export default router
