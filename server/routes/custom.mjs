/**
 * 定制服务路由，挂载于 /api/custom。
 *
 * 上传和业务提交分开：
 * - POST /upload 先把一张真实图片落盘并返回可引用地址；
 * - 咨询和量体接口只收 URL，JSON 请求体更稳定，也方便小程序端逐张上传。
 */
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Router } from 'express'
import multer from 'multer'
import { authRequired } from '../middleware/auth.mjs'
import * as customService from '../services/customService.mjs'

const router = Router()
const UPLOAD_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'uploads', 'custom')
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    mkdirSync(UPLOAD_DIR, { recursive: true })
    cb(null, UPLOAD_DIR)
  },
  filename(_req, file, cb) {
    const extension = extname(file.originalname || '').toLowerCase()
    const safeExtension = ALLOWED_EXTENSIONS.has(extension) ? extension : '.jpg'
    cb(null, `${Date.now()}-${randomUUID()}${safeExtension}`)
  },
})

const upload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1,
  },
  fileFilter(_req, file, cb) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      const err = new Error('仅支持 JPG、PNG 或 WebP 图片')
      err.status = 400
      err.code = 'INVALID_IMAGE_TYPE'
      cb(err)
      return
    }
    cb(null, true)
  },
})

function uploadSingle(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (!err) return next()
      if (err instanceof multer.MulterError) {
        err.status = 400
        err.code = err.code === 'LIMIT_FILE_SIZE' ? 'IMAGE_TOO_LARGE' : 'UPLOAD_FAILED'
        err.message = err.code === 'LIMIT_FILE_SIZE' ? '图片不能超过 8MB' : err.message
      }
      if (!err.status) {
        err.status = 500
        err.code = err.code || 'UPLOAD_FAILED'
      }
      next(err)
    })
  }
}

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

router.use(authRequired)

router.post('/upload', uploadSingle(upload.single('file')), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'MISSING_IMAGE',
      message: '请选择要上传的图片',
    })
  }
  res.status(201).json({ url: `/uploads/custom/${req.file.filename}` })
})

/*
 * 云开发模式的上传入口：前端先把图传到云存储，再把换出来的 https 地址发到这里。
 * 理由和 wardrobe 那条 /upload-remote 一样 —— 小程序 uploadFile 连不上裸 IP，
 * 而云存储的临时地址两小时就过期，必须服务端下载落盘才能长期引用。
 */
router.post(
  '/upload-remote',
  asyncHandler(async (req, res) => {
    const url = typeof req.body?.url === 'string' ? req.body.url : ''
    if (!url) {
      return res.status(400).json({ error: 'MISSING_IMAGE', message: '请选择要上传的图片' })
    }
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
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
      return res.status(400).json({ error: 'INVALID_IMAGE_TYPE', message: '仅支持 JPG、PNG 或 WebP 图片' })
    }
    const buf = Buffer.from(await resp.arrayBuffer())
    if (buf.length > 8 * 1024 * 1024) {
      return res.status(400).json({ error: 'IMAGE_TOO_LARGE', message: '图片不能超过 8MB' })
    }
    mkdirSync(UPLOAD_DIR, { recursive: true })
    const extension = mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg'
    const filename = `${Date.now()}-${randomUUID()}${extension}`
    writeFileSync(join(UPLOAD_DIR, filename), buf)
    res.status(201).json({ url: `/uploads/custom/${filename}` })
  }),
)

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const summary = await customService.getSummary(req.userId)
    res.json(summary)
  }),
)

router.get(
  '/requests',
  asyncHandler(async (req, res) => {
    const requests = await customService.listRequests(req.userId)
    res.json({ requests })
  }),
)

router.post(
  '/inquiries',
  asyncHandler(async (req, res) => {
    const request = await customService.createInquiry(req.userId, req.body || {})
    res.status(201).json({ request })
  }),
)

router.post(
  '/measurements',
  asyncHandler(async (req, res) => {
    const request = await customService.createMeasurement(req.userId, req.body || {})
    res.status(201).json({ request })
  }),
)

router.get(
  '/requests/:id',
  asyncHandler(async (req, res) => {
    const detail = await customService.getRequest(req.userId, req.params.id)
    res.json(detail)
  }),
)

router.post(
  '/requests/:id/advance',
  asyncHandler(async (req, res) => {
    const request = await customService.advanceRequest(req.userId, req.params.id)
    res.json({ request })
  }),
)

router.get(
  '/requests/:id/messages',
  asyncHandler(async (req, res) => {
    const messages = await customService.listMessages(req.userId, req.params.id)
    res.json({ messages })
  }),
)

router.post(
  '/requests/:id/messages',
  asyncHandler(async (req, res) => {
    const messages = await customService.sendMessage(req.userId, req.params.id, req.body?.content || '')
    res.json({ messages })
  }),
)

router.post(
  '/membership/upgrade',
  asyncHandler(async (req, res) => {
    const membership = await customService.upgradeMembership(req.userId)
    res.json(membership)
  }),
)

export default router
