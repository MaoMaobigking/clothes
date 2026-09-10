/**
 * 穿搭日记路由（规格 §11.1）
 *  - GET    /api/diary?month=YYYY-MM  某月记录；不带 month 则回最近 30 条
 *  - GET    /api/diary/:date          某天记录，没有返回 { diary: null }
 *  - PUT    /api/diary/:date          记录 / 覆盖某天（upsert）
 *  - DELETE /api/diary/:date          删掉某天
 *
 * 日期在路径里而不是 body 里：一天一条，日期就是这条资源的主键，
 * PUT 同一个 URL 两次结果一样（幂等），符合 PUT 的语义。
 */
import { Router } from 'express'
import { authRequired } from '../middleware/auth.mjs'
import * as diaryService from '../services/wardrobe/diary.mjs'

const router = Router()
router.use(authRequired)

router.get('/', async (req, res, next) => {
  try {
    const diaries = await diaryService.listDiary(req.userId, { month: req.query.month })
    res.json({ diaries })
  } catch (err) {
    next(err)
  }
})

router.get('/:date', async (req, res, next) => {
  try {
    res.json({ diary: await diaryService.getDiaryByDate(req.userId, req.params.date) })
  } catch (err) {
    next(err)
  }
})

router.put('/:date', async (req, res, next) => {
  try {
    const diary = await diaryService.saveDiary(req.userId, req.params.date, req.body || {})
    res.json({ diary })
  } catch (err) {
    next(err)
  }
})

router.delete('/:date', async (req, res, next) => {
  try {
    res.json({ ok: await diaryService.deleteDiary(req.userId, req.params.date) })
  } catch (err) {
    next(err)
  }
})

export default router
