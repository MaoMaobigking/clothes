/*
 * AI 路由
 *  - 挂载于裸 /api；每个路由各自挂 authRequired（原因见下方 router 处的注释）
 *  - POST /style-report      → 结构化输出（JSON Schema）
 *  - GET  /style-reports     → 本人历史报告列表 / :id 单条
 *  - POST /scene-outfits     → 结构化输出
 *  - POST /chat              → 普通对话
 *  - POST /chat/stream       → SSE 流式对话（3.2）
 *  - GET  /chat/tools        → 工具清单（OpenAI 格式，前端直接读）
 *  - POST /chat/tools        → 手写 tool-calling 对话（3.3）
 *  - POST /chat/rag          → 语义检索增强对话
 *  - GET  /chat/sessions     → 会话列表 / :id 详情 / DELETE :id 删除
 *
 * 四个对话接口都接受可选的 sessionId：不传就新建会话，传了就续聊（会验归属）。
 * 响应里一律回传 sessionId，前端拿它续下一轮。
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
  ensureSession,
  appendMessage,
  listSessions,
  getHistory,
  removeSession,
  saveReport,
  listReports,
  getReport,
  withAiLog,
} from '../services/ai/index.mjs'
import { searchRAG, buildRAGPrompt } from '../services/ragService.mjs'
import { listGarments } from '../services/garmentService.mjs'
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
    const result = await withAiLog({ userId: req.userId, scene: 'style_report' }, () =>
      generateReport(req.body?.profile ?? {}),
    )
    const answers = req.body?.answers ?? req.body?.profile ?? {}
    const reportId = await saveReport(req.userId, answers, result)
    res.json({ ...result, reportId })
  }),
)

// GET /style-reports — 历史报告列表
router.get(
  '/style-reports',
  authRequired,
  asyncHandler(async (req, res) => {
    const items = await listReports(req.userId)
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
    // 不属于自己时 getReport 抛 404，交给 errorHandler
    const report = await getReport(req.userId, id)
    res.json({ report })
  }),
)

// POST /scene-outfits
router.post(
  '/scene-outfits',
  authRequired,
  asyncHandler(async (req, res) => {
    if (!requireKey(req, res)) return
    const result = await withAiLog({ userId: req.userId, scene: 'scene_outfits' }, () =>
      generateSceneOutfits(req.body || {}),
    )
    res.json(result)
  }),
)

/* ============ 3.2 SSE 流式 ============ */

// POST /chat/stream
router.post('/chat/stream', authRequired, async (req, res, next) => {
  if (!requireKey(req, res)) return
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : []
  if (messages.length === 0) return res.status(400).json({ error: 'EMPTY_MESSAGES' })

  /*
   * 会话要在写 SSE 响应头**之前**确定。
   * ensureSession 在 sessionId 不属于当前用户时抛 404 —— 头一旦发出去就只能在
   * data 事件里塞 error 了，前端处理起来麻烦得多，不如在这儿走正常的 HTTP 错误。
   */
  let sessionId
  try {
    sessionId = await ensureSession(req.userId, req.body?.sessionId, messages[messages.length - 1]?.content)
  } catch (err) {
    return next(err)
  }
  await appendMessage(req.userId, sessionId, 'user', messages[messages.length - 1]?.content)

  // SSE 响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  // 先把 sessionId 推给前端：后面续聊要带上它，而且中途断了也已经拿到了
  res.write(`data: ${JSON.stringify({ sessionId, delta: '', done: false })}\n\n`)

  const abortController = new AbortController()
  res.on('close', () => abortController.abort())

  try {
    const fullText = await withAiLog({ userId: req.userId, scene: 'chat_stream' }, () =>
      aiChatStream(
        messages,
        null,
        (delta) => {
          res.write(`data: ${JSON.stringify({ delta, done: false })}\n\n`)
        },
        abortController.signal,
      ),
    )
    // 流式结束、拿到完整文本才存 —— 逐片存会写一堆碎片
    await appendMessage(req.userId, sessionId, 'assistant', fullText)
    res.write(`data: ${JSON.stringify({ sessionId, delta: '', done: true, fullText })}\n\n`)
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

  // 同 /chat/stream：会话要在写 SSE 头之前定好，越权才能走正常的 HTTP 404
  let sessionId
  try {
    sessionId = await ensureSession(req.userId, req.body?.sessionId, messages[messages.length - 1]?.content)
  } catch (err) {
    return next(err)
  }
  await appendMessage(req.userId, sessionId, 'user', messages[messages.length - 1]?.content)

  // SSE 流式
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.write(`data: ${JSON.stringify({ sessionId, delta: '', done: false })}\n\n`)

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
    const fullText = await withAiLog({ userId: req.userId, scene: 'chat_tools' }, () =>
      aiChatWithTools(
        messages,
        (delta) => {
          res.write(`data: ${JSON.stringify({ delta, done: false })}\n\n`)
        },
        context,
        abortController.signal,
      ),
    )
    await appendMessage(req.userId, sessionId, 'assistant', fullText)
    res.write(`data: ${JSON.stringify({ sessionId, delta: '', done: true, fullText })}\n\n`)
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
    if (messages.length === 0) return res.status(400).json({ error: 'EMPTY_MESSAGES' })

    const lastMsg = messages[messages.length - 1]?.content
    const sessionId = await ensureSession(req.userId, req.body?.sessionId, lastMsg)
    await appendMessage(req.userId, sessionId, 'user', lastMsg)

    const reply = await withAiLog({ userId: req.userId, scene: 'chat' }, () => aiChat(messages))
    await appendMessage(req.userId, sessionId, 'assistant', reply)
    // sessionId 一并返回：前端续聊时带回来就能接上同一个会话
    res.json({ reply, sessionId })
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
    const sessionId = await ensureSession(req.userId, req.body?.sessionId, lastMsg)
    // 存用户原话，不存拼了参考资料的增强版 —— 历史记录要能还原用户当时问了什么
    await appendMessage(req.userId, sessionId, 'user', lastMsg)

    // 语义检索，要先把 query 向量化，所以是 async
    const chunks = await searchRAG(lastMsg)

    const reply = await withAiLog({ userId: req.userId, scene: 'chat_rag' }, () => {
      if (chunks.length > 0) {
        const ragPrompt = buildRAGPrompt(lastMsg, chunks)
        // 保留历史消息，将 RAG 增强 prompt 作为最后一条 user 消息
        return aiChat([...messages.slice(0, -1), { role: 'user', content: ragPrompt }])
      }
      return aiChat(messages)
    })
    await appendMessage(req.userId, sessionId, 'assistant', reply)

    res.json({ reply, sessionId, sources: chunks.map((c) => c.source) })
  }),
)

/* ============ 会话历史 ============ */

// GET /chat/sessions — 本人会话列表（带消息条数）
router.get(
  '/chat/sessions',
  authRequired,
  asyncHandler(async (req, res) => {
    const items = await listSessions(req.userId)
    res.json({ items })
  }),
)

// GET /chat/sessions/:id — 会话详情 + 全部消息
router.get(
  '/chat/sessions/:id',
  authRequired,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'INVALID_SESSION_ID', message: '会话 ID 不合法' })
    }
    // 不属于自己时 getHistory 抛 404（不区分「不存在」和「是别人的」）
    res.json(await getHistory(req.userId, id))
  }),
)

// DELETE /chat/sessions/:id — 消息靠 chat_messages 的外键级联一起删
router.delete(
  '/chat/sessions/:id',
  authRequired,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'INVALID_SESSION_ID', message: '会话 ID 不合法' })
    }
    await removeSession(req.userId, id)
    res.json({ ok: true })
  }),
)

export default router
