import { Router } from 'express'
import multer from 'multer'
import { mkdirSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { authRequired } from '../middleware/auth.mjs'
import * as garmentService from '../services/garmentService.mjs'
import * as outfitService from '../services/outfitService.mjs'

const router = Router()
const here = dirname(fileURLToPath(import.meta.url))
const uploadDir = join(here, '..', 'uploads', 'garments')
mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = (extname(file.originalname) || '.jpg').toLowerCase()
    cb(null, `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 20,
  },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.mimetype)) {
      const err = new Error('只支持 JPEG、PNG、WebP 图片')
      err.status = 400
      err.code = 'INVALID_IMAGE'
      return cb(err)
    }
    cb(null, true)
  },
})

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

router.use(authRequired)

router.post(
  '/upload',
  upload.array('files', 20),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'EMPTY_UPLOAD', message: '请先选择衣物照片' })
    }
    const items = await garmentService.uploadGarments(req.userId, req.files)
    res.status(201).json({ items, source: 'demo' })
  }),
)

router.post(
  '/generate',
  asyncHandler(async (req, res) => {
    const selectedIds = Array.isArray(req.body?.selectedIds) ? req.body.selectedIds : []
    const batch = await outfitService.generateOutfits(req.userId, selectedIds)
    res.json({ batch })
  }),
)

router.get(
  '/batch/:batchId',
  asyncHandler(async (req, res) => {
    const batch = await outfitService.getBatch(req.userId, req.params.batchId)
    if (!batch) {
      return res.status(404).json({ error: 'BATCH_NOT_FOUND', message: '搭配批次不存在' })
    }
    res.json({ batch })
  }),
)

router.get(
  '/outfits',
  asyncHandler(async (req, res) => {
    const saved = req.query.saved === '1' || req.query.kind === 'saved'
    const items = await outfitService.listOutfits(req.userId, { saved })
    res.json({ items })
  }),
)

router.post(
  '/outfits/:id/save',
  asyncHandler(async (req, res) => {
    const item = await outfitService.saveOutfit(req.userId, Number(req.params.id))
    res.json({ item })
  }),
)

router.post(
  '/outfits/:id/replace',
  asyncHandler(async (req, res) => {
    const item = await outfitService.replaceOutfitItem(
      req.userId,
      Number(req.params.id),
      String(req.body?.oldGarmentId || ''),
      String(req.body?.newGarmentId || ''),
    )
    res.json({ item })
  }),
)

router.get(
  '/outfits/:id',
  asyncHandler(async (req, res) => {
    const item = await outfitService.getOutfit(req.userId, Number(req.params.id))
    if (!item) {
      return res.status(404).json({ error: 'OUTFIT_NOT_FOUND', message: '搭配不存在' })
    }
    res.json({ item })
  }),
)

router.delete(
  '/outfits/:id',
  asyncHandler(async (req, res) => {
    const ok = await outfitService.deleteOutfit(req.userId, Number(req.params.id))
    if (!ok) {
      return res.status(404).json({ error: 'OUTFIT_NOT_FOUND', message: '搭配不存在' })
    }
    res.json({ ok: true })
  }),
)

export default router
