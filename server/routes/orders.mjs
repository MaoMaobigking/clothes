/**
 * 演示结算路由：收货地址 + 订单。
 *
 * 全部需要登录，且每条 SQL 都带 user_id —— 和购物车同一套隔离口径（规格 §13）。
 */
import { Router } from 'express'
import { authRequired } from '../middleware/auth.mjs'
import * as orderService from '../services/commerce/order.mjs'

const router = Router()
router.use(authRequired)

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

/* ---------- 收货地址 ---------- */

router.get(
  '/addresses',
  asyncHandler(async (req, res) => {
    const items = await orderService.listAddresses(req.userId)
    res.json({ items })
  }),
)

router.post(
  '/addresses',
  asyncHandler(async (req, res) => {
    const address = await orderService.createAddress(req.userId, req.body || {})
    res.status(201).json({ address })
  }),
)

router.put(
  '/addresses/:id',
  asyncHandler(async (req, res) => {
    const address = await orderService.updateAddress(req.userId, req.params.id, req.body || {})
    res.json({ address })
  }),
)

router.delete(
  '/addresses/:id',
  asyncHandler(async (req, res) => {
    const result = await orderService.deleteAddress(req.userId, req.params.id)
    res.json(result)
  }),
)

/* ---------- 结算 ---------- */

/** 结算页进来先拉这个：车、地址、可用券、试算金额一次给全，不用前端串三个请求 */
router.get(
  '/checkout',
  asyncHandler(async (req, res) => {
    const preview = await orderService.getCheckoutPreview(req.userId, req.query?.coupon || '')
    res.json(preview)
  }),
)

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const order = await orderService.createOrder(req.userId, req.body || {})
    res.status(201).json({ order })
  }),
)

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await orderService.listOrders(req.userId)
    res.json({ items })
  }),
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await orderService.getOrder(req.userId, req.params.id)
    res.json({ order })
  }),
)

/** 演示按钮：action=next 往前推一步，action=cancel 取消（仅待付款） */
router.post(
  '/:id/advance',
  asyncHandler(async (req, res) => {
    const order = await orderService.advanceOrder(req.userId, req.params.id, req.body?.action)
    res.json({ order })
  }),
)

export default router
