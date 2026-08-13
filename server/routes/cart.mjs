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
    const items = await cartService.listCart(req.userId)
    res.json({ items })
  }),
)

router.post(
  '/outfits/:id',
  asyncHandler(async (req, res) => {
    const items = await cartService.addOutfitToCart(req.userId, Number(req.params.id))
    res.status(201).json({ items })
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
    await cartService.deleteCartItem(req.userId, Number(req.params.id))
    res.json({ ok: true })
  }),
)

export default router
