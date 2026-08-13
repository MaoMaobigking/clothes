/*
 * AI 服装 · 后端
 *  - 真实数据库（MySQL + mysql2/promise 连接池）：用户 / 衣橱 / AI 结果落库
 *  - 真实大模型：风格报告 / 情景搭配推荐 / AI 穿搭顾问对话
 *
 * 启动：npm run dev（脚本里带 --env-file=.env）
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
import profileRoutes from './routes/profile.mjs'
import sceneRoutes from './routes/scene.mjs'
import { ensureSceneCatalog } from './services/sceneService.mjs'
import { initDb, ping, DB_NAME } from './db/mysql.mjs'

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
app.use('/api/profile', profileRoutes)
app.use('/api/scene', sceneRoutes)

/* ============ 统一错误处理（必须放在所有路由之后） ============ */
app.use(errorHandler)

/* ============ 启动 ============ */
/**
 * 先连数据库、建表，成功了才 listen。
 * 顺序很重要：如果先 listen 再连库，数据库挂掉时服务照样「启动成功」，
 * 每个请求各自 500 —— 属于最难查的那类故障。宁可起不来，也别半死不活。
 */
async function bootstrap() {
  const dbHost = `${process.env.MYSQL_HOST || 'localhost'}:${process.env.MYSQL_PORT || 3306}`
  try {
    await initDb()
    await ping()
    console.log(`✅ MySQL 已连接并建表: ${dbHost}/${DB_NAME}`)
    await ensureSceneCatalog()
    console.log('✅ 场景商城目录已初始化')
  } catch (err) {
    console.error(`\n❌ MySQL 连接失败 (${dbHost}/${DB_NAME}): ${err.message}`)
    console.error('   排查：1) 容器是否启动 docker ps  2) .env 里 MYSQL_PORT/PASSWORD 是否对\n')
    process.exit(1)
  }

  app.listen(PORT, async () => {
    console.log(`\n✅ AI 后端已启动: http://localhost:${PORT}`)
    console.log(`   AI: provider=${PROVIDER} model=${MODEL} hasKey=${Boolean(API_KEY)}`)

    // 初始化 RAG（失败不影响主服务）
    try {
      const { initRAG } = await import('./services/ragService.mjs')
      await initRAG()
    } catch (e) {
      console.log('   ⚠️ RAG 初始化失败:', e.message)
    }

    if (!API_KEY) console.log('   ⚠️ 未填 AI_API_KEY，AI 类接口会提示；衣橱数据库接口不受影响。\n')
  })
}

bootstrap()
