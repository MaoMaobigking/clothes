/**
 * AI 异步任务路由（阿里百炼）
 *
 * 导出的是一个**工厂**而不是路由实例：试衣 / 换脸 / 场景生成的接口形状完全一样
 * （POST 提交、GET :taskId 查、GET 列表），只有 capability 不同。
 * 加一个能力 = services/vision/bailian.mjs 的 CAPABILITIES 加一条 + index.mjs 加一行 app.use，
 * 这个文件不用动。
 *
 *   POST /api/tryon          提交任务，立刻返回 { task } （status=PENDING）
 *   GET  /api/tryon/:taskId  查任务（非终态时会去百炼查一次并回写）
 *   GET  /api/tryon          我的历史任务
 */
import { Router } from 'express'
import { authRequired } from '../middleware/auth.mjs'
import * as aiTaskService from '../services/vision/tasks.mjs'
import { findResultImage } from '../repositories/resultImageRepo.mjs'

export function createAiTaskRouter(capability) {
  const router = Router()
  router.use(authRequired)
  router.get('/images/:id', async (req, res, next) => {
    try {
      if (!/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(req.params.id)) return res.sendStatus(404)
      const image = await findResultImage(req.userId, req.params.id)
      if (!image) return res.sendStatus(404)
      res.set('Cache-Control', 'no-store')
      res.json({ dataUrl: `data:${image.mime};base64,${image.content.toString('base64')}` })
    } catch (err) {
      next(err)
    }
  })

  router.post('/', async (req, res, next) => {
    try {
      const task = await aiTaskService.submitTask(req.userId, capability, req.body || {}, {
        model: req.body?.model,
      })
      res.json({ task })
    } catch (err) {
      next(err)
    }
  })

  router.get('/', async (req, res, next) => {
    try {
      const tasks = await aiTaskService.listTasks(req.userId, {
        capability,
        limit: req.query.limit,
      })
      res.json({ tasks })
    } catch (err) {
      next(err)
    }
  })

  router.get('/:taskId', async (req, res, next) => {
    try {
      const task = await aiTaskService.syncTask(req.userId, req.params.taskId)
      res.json({ task })
    } catch (err) {
      next(err)
    }
  })

  return router
}

export default createAiTaskRouter
