/*
 * AI 服装 · 后端
 *  - 真实数据库（node:sqlite）：衣橱的增删改查
 *  - 真实大模型：风格报告 / 情景搭配推荐 / AI 穿搭顾问对话
 *
 * 启动：npm run server（脚本里带 --experimental-sqlite --env-file=.env）
 *
 * 切换服务商只改 .env：
 *   AI_PROVIDER=openai     → OpenAI 兼容（OpenAI/DeepSeek/通义/Kimi/智谱…）
 *   AI_PROVIDER=anthropic  → Claude
 */
import express from 'express'
import cors from 'cors'
import { logger } from './middleware/logger.mjs'
import { errorHandler } from './middleware/errorHandler.mjs'
import garmentRoutes from './routes/garments.mjs'
import aiRoutes from './routes/ai.mjs'
import authRoutes from './routes/auth.mjs'

const app = express()

const PROVIDER = (process.env.AI_PROVIDER || 'openai').toLowerCase()
const API_KEY = process.env.AI_API_KEY || ''
const MODEL =
  process.env.AI_MODEL ||
  (PROVIDER === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini')
const PORT = Number(process.env.PORT || 8787)

app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use(logger)

/* ============ 健康检查 ============ */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, provider: PROVIDER, model: MODEL, hasKey: Boolean(API_KEY) })
})

/* ============ 路由挂载 ============ */
app.use('/api/garments', garmentRoutes)
app.use('/api', aiRoutes) // /api/style-report, /api/scene-outfits, /api/chat
app.use('/api/auth', authRoutes)

/* ============ 统一错误处理（必须放在所有路由之后） ============ */
app.use(errorHandler)

/* ============ 启动 ============ */
app.listen(PORT, async () => {
  console.log(`\n✅ AI 后端已启动: http://localhost:${PORT}`)
  const dbInfo = process.env.DB_TYPE === 'mysql'
    ? `MySQL (${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE})`
    : 'SQLite (server/data.db)'
  console.log(`   数据库: ${dbInfo}`)
  console.log(`   AI: provider=${PROVIDER} model=${MODEL} hasKey=${Boolean(API_KEY)}`)

  // 初始化 RAG（异步，不阻塞启动）
  try {
    const { initRAG } = await import('./services/ragService.mjs')
    await initRAG()
  } catch (e) {
    console.log('   ⚠️ RAG 初始化失败:', e.message)
  }

  if (!API_KEY) console.log('   ⚠️ 未填 AI_API_KEY，AI 类接口会提示；衣橱数据库接口不受影响。\n')
})
