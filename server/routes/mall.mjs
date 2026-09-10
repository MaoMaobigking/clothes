/**
 * 商城路由（规格 §4.4 §10.6）
 *
 *   GET /api/mall/products      商品列表（?category= 按品类筛）
 *   GET /api/mall/products/:id  单品详情
 *
 * 商品来自 scene_catalog，加购走 /api/cart 的 item_type='catalog'，
 * 这里不重复实现购物车。
 */
import { Router } from 'express'
import { authRequired } from '../middleware/auth.mjs'
import * as mallService from '../services/commerce/mall.mjs'

const router = Router()
router.use(authRequired)

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    res.json(
      await mallService.listProducts({
        category: req.query.category ? String(req.query.category) : '',
        sceneKey: req.query.sceneKey ? String(req.query.sceneKey) : '',
      }),
    )
  }),
)

router.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const product = await mallService.getProduct(req.params.id)
    if (!product) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '商品不存在' })
    }
    res.json({ product })
  }),
)

export default router
