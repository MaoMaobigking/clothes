/**
 * 功能六时尚社区路由
 *
 * 所有内容列表和用户状态接口均需登录；管理员统计额外校验 role。
 */
import { Router } from 'express'
import { authRequired } from '../middleware/auth.mjs'
import * as communityService from '../services/communityService.mjs'

const router = Router()
router.use(authRequired)

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

function adminRequired(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: '仅管理员可查看数据看板',
    })
  }
  next()
}

router.get('/contents', asyncHandler(async (req, res) => {
  const items = await communityService.listContents(req.userId, req.query || {})
  res.json({ items })
}))

router.get('/contents/:id', asyncHandler(async (req, res) => {
  const content = await communityService.getContent(req.userId, req.params.id)
  res.json({ content })
}))

router.post('/contents/:id/interactions', asyncHandler(async (req, res) => {
  const result = await communityService.toggleInteraction(
    req.userId,
    req.params.id,
    req.body?.action,
  )
  res.json(result)
}))

router.post('/contents/:id/comments', asyncHandler(async (req, res) => {
  const comment = await communityService.addComment(
    req.userId,
    req.params.id,
    req.body?.content,
  )
  res.status(201).json({ comment })
}))

router.post('/contents/:id/bookmark', asyncHandler(async (req, res) => {
  const result = await communityService.saveBookmark(
    req.userId,
    req.params.id,
    req.body?.note,
  )
  res.json(result)
}))

router.post('/tutorials/:id/complete', asyncHandler(async (req, res) => {
  const result = await communityService.completeTutorial(
    req.userId,
    req.params.id,
  )
  res.json(result)
}))

router.post('/shares', asyncHandler(async (req, res) => {
  const share = await communityService.createShare(req.userId, req.body || {})
  res.status(201).json({ share })
}))

router.get('/bookmarks', asyncHandler(async (req, res) => {
  const items = await communityService.listBookmarks(req.userId)
  res.json({ items })
}))

router.get('/achievements', asyncHandler(async (req, res) => {
  const result = await communityService.listAchievements(req.userId)
  res.json(result)
}))

router.get('/admin/stats', adminRequired, asyncHandler(async (_req, res) => {
  const dashboard = await communityService.getAdminDashboard()
  res.json(dashboard)
}))

export default router
