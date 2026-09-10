import { Router } from 'express'
import { authRequired } from '../middleware/auth.mjs'
import * as accessoryService from '../services/wardrobe/accessory.mjs'

const router = Router()
router.use(authRequired)

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

router.get(
  '/catalog',
  asyncHandler(async (_req, res) => {
    res.json({ items: await accessoryService.getCatalog() })
  }),
)

router.post(
  '/recommend',
  asyncHandler(async (req, res) => {
    res.json(await accessoryService.recommend(req.userId, req.body || {}))
  }),
)

router.get(
  '/hot',
  asyncHandler(async (_req, res) => {
    res.json({ combos: await accessoryService.getHotCombos() })
  }),
)

router.post(
  '/:id/rating',
  asyncHandler(async (req, res) => {
    res.json(await accessoryService.rateAccessory(req.userId, req.params.id, req.body?.score))
  }),
)

export default router
