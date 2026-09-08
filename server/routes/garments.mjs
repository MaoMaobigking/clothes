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
//挂载中间件 凡是经过这个路由器的请求，在匹配具体的接口之前，都必须先给我过一遍这个函数
router.use(authRequired)

//自动捕获异步代码错误（防崩溃包装器）的经典工具函数
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

// GET / — 只返回当前用户的衣物
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await garmentService.listGarments(req.userId)
    res.json({ items })
  }),
)

// POST /
//req（Request）：请求对象，里面装了前端发过来的所有数据（如参数、Token 解析出来的 req.userId 等）。
//res（Response）：响应对象，后端处理完数据后，用它的 res.json(...) 方法把结果吐还给前端。
router.post(
  '/',
  asyncHandler(async (req, res) => {
    //...=浅拷贝；||=左边假值取右边
    const body = { ...(req.body || {}) }
    // 防御性剔除：客户端传什么 userId/user_id 都不算
    //删两种拼写：前端驼峰、库里下划线，攻击者两种都试
    delete body.userId
    delete body.user_id
    const item = await garmentService.addGarment(req.userId, body)
    //把 HTTP 状态码设为 201，然后把刚创建的这件衣服数据打包成 JSON 发回给前端
    res.status(201).json({ item })
  }),
)

router.put(
  '/reorder',
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
    const items = await garmentService.reorderGarments(req.userId, ids)
    res.json({ items })
  }),
)

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = { ...(req.body || {}) }
    delete body.userId
    delete body.user_id
    const item = await garmentService.updateGarment(req.userId, req.params.id, body)
    res.json({ item })
  }),
)

// DELETE /:id
//路径参数 :id：:id 是一个占位符。当前端请求 DELETE /api/garments/123 时，:id 就会自动匹配并提取出 "123"。
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const ok = await garmentService.deleteGarment(req.userId, req.params.id)
    // 别人的资源返 404 而不是 403：403 等于告诉攻击者「这个 id 存在」，可被枚举
    if (!ok) return res.status(404).json({ error: 'NOT_FOUND', message: '衣物不存在' })
    res.json({ ok: true })
  }),
)

// POST /:id/fav
router.post(
  '/:id/fav',
  asyncHandler(async (req, res) => {
    const fav = await garmentService.toggleFav(req.userId, req.params.id)
    if (fav === null) return res.status(404).json({ error: 'NOT_FOUND', message: '衣物不存在' })
    res.json({ fav })
  }),
)

router.post(
  '/:id/frequently-worn',
  asyncHandler(async (req, res) => {
    const item = await garmentService.toggleFrequentlyWorn(req.userId, req.params.id)
    res.json({ item })
  }),
)

export default router
