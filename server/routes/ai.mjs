/*
 * AI 路由
 *  - 挂载于 /api
 *  - POST /style-report   → 结构化输出（JSON Schema）
 *  - POST /scene-outfits  → 结构化输出
 *  - POST /chat           → 普通对话
 *  - POST /chat/stream    → SSE 流式对话（3.2）
 *  - POST /chat/tools     → 手写 tool-calling 对话（3.3）
 */
import { Router } from 'express'
import {
  generateReport,
  generateSceneOutfits,
  aiChat,
  aiChatStream,
  aiChatWithTools,
  TOOLS,
  executeTool,
} from '../services/aiService.mjs'
import { searchRAG, buildRAGPrompt, initRAG } from '../services/ragService.mjs'
import { listGarments } from '../services/garmentService.mjs'

const router = Router()

function requireKey(_req, res) {
  if (!process.env.AI_API_KEY) {
    res.status(400).json({ error: 'NO_API_KEY', message: '请在 .env 中配置 AI_API_KEY' })
    return false
  }
  return true
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

/* ============ 3.1 结构化输出 ============ */

// POST /style-report
router.post('/style-report', asyncHandler(async (req, res) => {
  if (!requireKey(req, res)) return
  const result = await generateReport(req.body?.profile ?? {})
  res.json(result)
}))

// POST /scene-outfits
router.post('/scene-outfits', asyncHandler(async (req, res) => {
  if (!requireKey(req, res)) return
  const result = await generateSceneOutfits(req.body || {})
  res.json(result)
}))

/* ============ 3.2 SSE 流式 ============ */

// POST /chat/stream
router.post('/chat/stream', async (req, res, next) => {
  if (!requireKey(req, res)) return
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : []
  if (messages.length === 0) return res.status(400).json({ error: 'EMPTY_MESSAGES' })

  // SSE 响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const abortController = new AbortController()
  req.on('close', () => abortController.abort())

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
router.get('/chat/tools', (_req, res) => {
  res.json({ tools: TOOLS })
})

// POST /chat/tools — 手写 tool-calling 对话
router.post('/chat/tools', async (req, res, next) => {
  if (!requireKey(req, res)) return

  // SSE 流式
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : []
  const abortController = new AbortController()
  req.on('close', () => abortController.abort())

  try {
    // 构建工具执行上下文
    const garments = await listGarments()
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
router.post('/chat', asyncHandler(async (req, res) => {
  if (!requireKey(req, res)) return
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : []
  const reply = await aiChat(messages)
  res.json({ reply })
}))

/* ============ RAG 增强对话 ============ */

// POST /chat/rag — 检索增强生成
router.post('/chat/rag', asyncHandler(async (req, res) => {
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

  res.json({ reply, sources: chunks.map(c => c.source) })
}))

export default router
