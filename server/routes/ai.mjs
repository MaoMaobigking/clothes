/*
 * AI 路由
 *  - 挂载于裸 /api；每个路由各自挂 authRequired（原因见下方 router 处的注释）
 *  - POST /style-report   → 结构化输出（JSON Schema）
 *  - GET  /style-reports  → 本人历史报告列表 / :id 单条
 *  - POST /scene-outfits  → 结构化输出
 *  - POST /chat           → 普通对话
 *  - POST /chat/stream    → SSE 流式对话（3.2）
 *  - GET  /chat/tools     → 工具清单（OpenAI 格式，前端直接读）
 *  - POST /chat/tools     → 手写 tool-calling 对话（3.3）
 *  - POST /chat/rag       → 检索增强对话
 */
import { Router } from 'express'
import { authRequired } from '../middleware/auth.mjs'
import {
  generateReport,
  generateSceneOutfits,
  aiChat,
  aiChatStream,
  aiChatWithTools,
  TOOLS,
} from '../services/ai/index.mjs'
import { searchRAG, buildRAGPrompt } from '../services/ragService.mjs'
import { listGarments } from '../services/garmentService.mjs'
import { saveStyleReport, listStyleReports, findStyleReport } from '../repositories/aiRepo.mjs'
import { config } from '../config/env.mjs'

const router = Router()

/*
 * ⚠️ 鉴权必须逐路由挂 authRequired，不能图省事写成 router.use(authRequired)。
 *
 * 原因在 index.mjs：本路由器挂在**裸 /api** 上（`app.use('/api', aiRoutes)`），
 * 而且排在 authRoutes、profileRoutes 等 15 个路由器**之前**。
 * router.use() 不带路径就会匹配 /api/* 的每一个请求 —— 包括本该由后面路由器
 * 处理的 /api/auth/login。一旦 401 就不再 next()，登录接口自己也要求登录，死锁。
 * （routes/garments.mjs 能用 router.use 是因为它挂在 /api/garments 这个独立前缀下。）
 *
 * 本次补的是：/chat、/chat/stream、/chat/rag 原来一个中间件都没挂，
 * /chat/tools 挂的是 authOptional，而同文件的 /style-report 是 authRequired
 * —— 那是遗漏不是设计。配合 index.mjs 里全开的 cors() 和 12mb body 上限，
 * 等于任何人拿到地址就能烧掉 AI_API_KEY 的额度。
 *
 * 注意别把下面的 requireKey() 当鉴权：它只检查服务端自己配没配 key，
 * 跟调用方是谁毫无关系。
 */

/** 只检查服务端是否配置了 AI key，与调用方身份无关 —— 鉴权靠各路由的 authRequired */
function requireKey(_req, res) {
  if (!config.ai.apiKey) {
    res.status(400).json({ error: 'NO_API_KEY', message: '请在 .env 中配置 AI_API_KEY' })
    return false
  }
  return true
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

/* ============ 3.1 结构化输出 ============ */

// POST /style-report
router.post(
  '/style-report',
  authRequired,
  asyncHandler(async (req, res) => {
    const result = await generateReport(req.body?.profile ?? {})
    const answers = req.body?.answers ?? req.body?.profile ?? {}
    const reportId = await saveStyleReport(req.userId, answers, result)
    res.json({ ...result, reportId })
  }),
)

// GET /style-reports — 历史报告列表
router.get(
  '/style-reports',
  authRequired,
  asyncHandler(async (req, res) => {
    const items = await listStyleReports(req.userId)
    res.json({ items })
  }),
)

// GET /style-reports/:id — 读取本人历史报告
router.get(
  '/style-reports/:id',
  authRequired,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'INVALID_REPORT_ID', message: '报告 ID 不合法' })
    }
    const report = await findStyleReport(req.userId, id)
    if (!report) return res.status(404).json({ error: 'NOT_FOUND', message: '报告不存在' })
    res.json({ report })
  }),
)

// POST /scene-outfits
router.post(
  '/scene-outfits',
  authRequired,
  asyncHandler(async (req, res) => {
    if (!requireKey(req, res)) return
    const result = await generateSceneOutfits(req.body || {})
    res.json(result)
  }),
)

/* ============ 3.2 SSE 流式 ============ */

// POST /chat/stream
router.post('/chat/stream', authRequired, async (req, res, next) => {
  if (!requireKey(req, res)) return
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : []
  if (messages.length === 0) return res.status(400).json({ error: 'EMPTY_MESSAGES' })

  // SSE 响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const abortController = new AbortController()
  res.on('close', () => abortController.abort())

  try {
    const fullText = await aiChatStream(
      messages,
      null,
      (delta) => {
        res.write(`data: ${JSON.stringify({ delta, done: false })}\n\n`)
      },
      abortController.signal,
    )
    res.write(`data: ${JSON.stringify({ delta: '', done: true, fullText })}\n\n`)
    res.end()
  } catch (err) {
    if (!res.headersSent) {
      next(err)
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      res.end()
    }
  }
})

/* ============ 3.3 工具调用 ============ */

// GET /chat/tools — 列出可用工具
router.get('/chat/tools', authRequired, (_req, res) => {
  res.json({ tools: TOOLS })
})

// POST /chat/tools — 手写 tool-calling 对话
router.post('/chat/tools', authRequired, async (req, res, next) => {
  if (!requireKey(req, res)) return
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : []
  if (messages.length === 0) return res.status(400).json({ error: 'EMPTY_MESSAGES' })

  // SSE 流式
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  const abortController = new AbortController()
  res.on('close', () => abortController.abort())

  try {
    // 构建工具执行上下文
    // req.userId 一定存在（本路由已挂 authRequired），不必再兜空
    const garments = await listGarments(req.userId)
    const context = {
      garments,
      profile: req.body?.profile || {},
    }

    // 流式输出：工具调用结果也通过 SSE 推送
    const fullText = await aiChatWithTools(
      messages,
      (delta) => {
        res.write(`data: ${JSON.stringify({ delta, done: false })}\n\n`)
      },
      context,
      abortController.signal,
    )
    res.write(`data: ${JSON.stringify({ delta: '', done: true, fullText })}\n\n`)
    res.end()
  } catch (err) {
    if (!res.headersSent) {
      next(err)
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      res.end()
    }
  }
})

/* ============ 普通对话（保留向后兼容） ============ */

// POST /chat
router.post(
  '/chat',
  authRequired,
  asyncHandler(async (req, res) => {
    if (!requireKey(req, res)) return
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : []
    const reply = await aiChat(messages)
    res.json({ reply })
  }),
)

/* ============ RAG 增强对话 ============ */

// POST /chat/rag — 检索增强生成
router.post(
  '/chat/rag',
  authRequired,
  asyncHandler(async (req, res) => {
    if (!requireKey(req, res)) return
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : []
    if (messages.length === 0) return res.status(400).json({ error: 'EMPTY_MESSAGES' })

    const lastMsg = messages[messages.length - 1].content
    const chunks = searchRAG(lastMsg)

    let reply
    if (chunks.length > 0) {
      const ragPrompt = buildRAGPrompt(lastMsg, chunks)
      // 保留历史消息，将 RAG 增强 prompt 作为最后一条 user 消息
      const augmented = [...messages.slice(0, -1), { role: 'user', content: ragPrompt }]
      reply = await aiChat(augmented)
    } else {
      reply = await aiChat(messages)
    }

    res.json({ reply, sources: chunks.map((c) => c.source) })
  }),
)

export default router
