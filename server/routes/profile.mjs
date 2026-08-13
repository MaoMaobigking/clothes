/**
 * 个人身形档案路由
 *  - GET  /api/profile/current
 *  - PUT  /api/profile/current
 */
import { Router } from 'express'
import { authRequired } from '../middleware/auth.mjs'
import * as profileService from '../services/profileService.mjs'

const router = Router()
router.use(authRequired)

router.get('/current', async (req, res, next) => {
  try {
    const profile = await profileService.getLatestProfile(req.userId)
    res.json({ profile })
  } catch (err) {
    next(err)
  }
})

router.put('/current', async (req, res, next) => {
  try {
    const profile = await profileService.saveProfile(req.userId, req.body || {})
    res.json({ profile })
  } catch (err) {
    next(err)
  }
})

export default router
