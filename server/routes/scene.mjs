/**
 * 场景模拟路由
 *  - GET  /api/scene/scenes        六类场景定义
 *  - GET  /api/scene/weather       定位/手动天气
 *  - POST /api/scene/plans         生成纯旧衣 + 新旧混搭方案
 *  - POST /api/scene/outfits       保存为“我的搭配”
 *  - GET  /api/scene/outfits       当前用户模板列表
 *  - GET  /api/scene/outfits/:id   读取当前用户模板
 *  - POST /api/scene/buy           把方案新品写入购物车
 */
import { Router } from 'express'
import { authRequired } from '../middleware/auth.mjs'
import {
  SCENE_DEFINITIONS,
  generateScenePlans,
  resolveWeather,
  saveOutfit,
  buyOutfit,
  listSceneOutfits,
  findSceneOutfit,
  listCart,
} from '../services/sceneService.mjs'

const router = Router()
router.use(authRequired)

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

router.get('/scenes', (_req, res) => {
  res.json({ scenes: SCENE_DEFINITIONS })
})

router.get('/weather', asyncHandler(async (req, res) => {
  const weather = await resolveWeather({
    latitude: req.query.latitude,
    longitude: req.query.longitude,
    city: req.query.city,
    temp: req.query.temp,
    condition: req.query.condition,
    icon: req.query.icon,
    season: req.query.season,
  })
  res.json({ weather })
}))

router.post('/plans', asyncHandler(async (req, res) => {
  const result = await generateScenePlans({
    userId: req.userId,
    sceneKey: req.body?.sceneKey,
    season: req.body?.season,
    weather: req.body?.weather || {},
  })
  res.json(result)
}))

router.post('/outfits', asyncHandler(async (req, res) => {
  const outfit = await saveOutfit(req.userId, req.body || {})
  res.status(201).json({ outfit })
}))

router.get('/outfits', asyncHandler(async (req, res) => {
  const items = await listSceneOutfits(req.userId)
  res.json({ items })
}))

router.get('/outfits/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'INVALID_OUTFIT_ID', message: '方案 ID 不合法' })
  }
  const outfit = await findSceneOutfit(req.userId, id)
  if (!outfit) {
    return res.status(404).json({ error: 'NOT_FOUND', message: '方案不存在' })
  }
  res.json({ outfit })
}))

router.post('/buy', asyncHandler(async (req, res) => {
  const result = await buyOutfit(
    req.userId,
    req.body?.itemIds,
    req.body?.sourceOutfitId,
  )
  res.json(result)
}))

router.get('/cart', asyncHandler(async (req, res) => {
  const items = await listCart(req.userId)
  res.json({ items })
}))

export default router

