import { Router } from 'express'
import multer from 'multer'
import { mkdirSync, writeFileSync } from 'node:fs'
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

/*
 * 云开发模式下的上传入口。
 *
 * 为什么要这条路由：小程序 wx.uploadFile 和 request 受同一套「已备案域名」
 * 限制，裸公网 IP 传不上来。云开发模式下前端改成先把图传到云存储，再把
 * 换出来的 https 地址发到这里，由服务端自己下载落盘 —— 落盘之后
 * 和 multipart 那条路完全同构（同一个目录、同一套文件名、同一个 service）。
 *
 * 必须下载而不是直接存 URL：云存储的临时地址 2 小时就失效，
 * 存进库里等于衣橱过两小时全部图裂，而且 AI 试衣那边也拉不到图。
 */
router.post(
  '/upload-remote',
  asyncHandler(async (req, res) => {
    const urls = Array.isArray(req.body?.urls) ? req.body.urls.filter(Boolean) : []
    // fileIDs 与 urls 一一对应。存 fileID 而不是 /uploads/ 路径，是因为 cloud://
    // 在 <image> 里被微信原生支持、且永不过期；而 http://IP:8787/uploads/...
    // 在小程序里同样过不了域名校验，存了也显示不出来。
    const fileIDs = Array.isArray(req.body?.fileIDs) ? req.body.fileIDs : []
    if (!urls.length) {
      return res.status(400).json({ error: 'EMPTY_UPLOAD', message: '请先选择衣物照片' })
    }
    if (urls.length > 20) {
      return res.status(400).json({ error: 'UPLOAD_BATCH_LIMIT', message: '单次最多上传 20 件衣物' })
    }

    const files = []
    for (const url of urls) {
      let resp
      try {
        resp = await fetch(url)
      } catch (err) {
        return res.status(400).json({ error: 'FETCH_FAILED', message: `图片下载失败: ${err.message}` })
      }
      if (!resp.ok) {
        return res.status(400).json({ error: 'FETCH_FAILED', message: `图片下载失败（${resp.status}）` })
      }
      const mime = resp.headers.get('content-type') || ''
      if (!/^image\/(jpeg|png|webp)$/i.test(mime)) {
        return res.status(400).json({ error: 'INVALID_IMAGE', message: '只支持 JPEG、PNG、WebP 图片' })
      }
      const buf = Buffer.from(await resp.arrayBuffer())
      if (buf.length > 8 * 1024 * 1024) {
        return res.status(400).json({ error: 'IMAGE_TOO_LARGE', message: '单张图片不能超过 8MB' })
      }
      // 文件名规则和上面 multer.diskStorage 保持一致，两条路产出的文件混在一个目录里也认得出
      const ext = mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg'
      const filename = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${ext}`
      writeFileSync(join(uploadDir, filename), buf)
      // service 只用 originalname（取名字）和 filename（拼路径）这两个字段
      files.push({ originalname: url.split('/').pop()?.split('?')[0] || filename, filename })
    }

    const items = await garmentService.uploadGarments(req.userId, files)
    // 落库用的是 /uploads/ 路径；有 fileID 时改写成 cloud://，让小程序端显示得出来。
    // 本地那份不删 —— 服务端仍然握着原图，日后要换存储或做识别都还在。
    if (fileIDs.length) {
      for (let i = 0; i < items.length; i += 1) {
        if (fileIDs[i]) {
          items[i].img = fileIDs[i]
          await garmentService.updateGarmentImage(req.userId, items[i].id, fileIDs[i])
        }
      }
    }
    res.status(201).json({ items, source: 'cloud' })
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
    const starred = req.query.starred === '1'
    const kind = req.query.kind === 'manual' || req.query.kind === 'generated' ? req.query.kind : ''
    const items = await outfitService.listOutfits(req.userId, { saved, starred, kind })
    res.json({ items })
  }),
)

/* 自由搭配页的「保存」：把手动挑的一组衣物落成一条 kind='manual' 的搭配 */
router.post(
  '/outfits',
  asyncHandler(async (req, res) => {
    const item = await outfitService.createManualOutfit(req.userId, req.body || {})
    res.status(201).json({ item })
  }),
)

/* 「收藏」= 星标。和 /save 是两件事：save 只保证留下来，star 是在留下来的里面挑重点 */
router.post(
  '/outfits/:id/star',
  asyncHandler(async (req, res) => {
    const starred = req.body?.starred !== false
    const item = await outfitService.setOutfitStar(req.userId, Number(req.params.id), starred)
    res.json({ item })
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
