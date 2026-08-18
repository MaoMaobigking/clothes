/*
 * AI 服装 · 后端
 *  - 真实数据库（MySQL + mysql2/promise 连接池）：用户 / 衣橱 / AI 结果落库
 *  - 真实大模型：风格报告 / 情景搭配推荐 / AI 穿搭顾问对话
 *
 * 启动：npm run dev（脚本里带 --env-file=.env）
 *
 * 切换服务商只改 .env：
 *   AI_PROVIDER=deepseek   → DeepSeek（默认）
 *   AI_PROVIDER=openai     → OpenAI 兼容（OpenAI/通义/Kimi/智谱…）
 *   AI_PROVIDER=anthropic  → Claude
 */
import express from 'express'
import cors from 'cors'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { logger } from './middleware/logger.mjs'
import { errorHandler } from './middleware/errorHandler.mjs'
import garmentRoutes from './routes/garments.mjs'
import aiRoutes from './routes/ai.mjs'
import authRoutes from './routes/auth.mjs'
import profileRoutes from './routes/profile.mjs'
import wardrobeRoutes from './routes/wardrobe.mjs'
import diaryRoutes from './routes/diary.mjs'
import cartRoutes from './routes/cart.mjs'
import accessoryRoutes from './routes/accessories.mjs'
import accessoryCartRoutes from './routes/accessoryCart.mjs'
import { ensureAccessories } from './services/accessoryService.mjs'
import sceneRoutes from './routes/scene.mjs'
import mallRoutes from './routes/mall.mjs'
import { ensureSceneCatalog } from './services/sceneService.mjs'
import customRoutes from './routes/custom.mjs'
import { ensureDesigners } from './services/customService.mjs'
import communityRoutes from './routes/community.mjs'
import orderRoutes from './routes/orders.mjs'
import { createAiTaskRouter } from './routes/aiTasks.mjs'
import { ensureDemoData } from './services/demoSeedService.mjs'
import { getAiRuntime } from './services/aiService.mjs'
import { getBailianRuntime } from './services/bailianService.mjs'
import { initDb, ping, DB_NAME } from './db/mysql.mjs'

const app = express()
const here = dirname(fileURLToPath(import.meta.url))
const uploadDir = join(here, 'uploads')
mkdirSync(uploadDir, { recursive: true })

const ai = getAiRuntime()
const bailian = getBailianRuntime()
const PORT = Number(process.env.PORT || 8787)

app.use(cors())
app.use(express.json({ limit: '12mb' }))
app.use(logger)
app.use('/uploads', express.static(uploadDir))

/* ============ 健康检查 ============ */
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    provider: ai.provider,
    providerLabel: ai.providerLabel,
    model: ai.model,
    hasKey: ai.hasKey,
    // 前端据此决定「AI 试衣」按钮是可点还是置灰，不用等提交了才知道没配 key
    bailian: { enabled: bailian.enabled, capabilities: bailian.capabilities },
  })
})

/* ============ 路由挂载 ============ */
app.use('/api/garments', garmentRoutes)
app.use('/api', aiRoutes) // /api/style-report, /api/scene-outfits, /api/chat
app.use('/api/auth', authRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/wardrobe', wardrobeRoutes)
app.use('/api/diary', diaryRoutes) // 穿搭日记（规格 §11.1）
app.use('/api/accessories', accessoryRoutes)
app.use('/api/accessory-cart', accessoryCartRoutes)
app.use('/api/cart', cartRoutes)
app.use('/api/scene', sceneRoutes)
app.use('/api/mall', mallRoutes) // 商城目录复用 scene_catalog，见 services/mallService.mjs
app.use('/api/custom', customRoutes)
app.use('/api/community', communityRoutes)
// 演示结算：收货地址 + 订单（无支付，状态由演示按钮推进，见 services/orderService.mjs）
app.use('/api/orders', orderRoutes)
// 阿里百炼异步任务。加新能力（换脸 / 场景生成）= bailianService 的 CAPABILITIES
// 加一条 + 这里加一行，路由和服务层都不用改。
app.use('/api/tryon', createAiTaskRouter('tryon'))

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
    const accessorySeed = await ensureAccessories()
    if (accessorySeed.inserted > 0) {
      console.log(`✅ 配饰目录已初始化: ${accessorySeed.inserted} 件`)
    }
    await ensureSceneCatalog()
    console.log('✅ 场景商城目录已初始化')
    const designerSeed = await ensureDesigners()
    if (designerSeed.inserted > 0) {
      console.log(`✅ 定制设计师目录已初始化: ${designerSeed.inserted} 位`)
    }
    // 规格 §5.2：四类预置演示账号。幂等，已有数据不覆盖。
    const demoSeed = await ensureDemoData()
    console.log(`✅ 演示账号已就绪: ${demoSeed.filter((item) => item.ok).length}/${demoSeed.length}`)
  } catch (err) {
    console.error(`\n❌ MySQL 连接失败 (${dbHost}/${DB_NAME}): ${err.message}`)
    console.error('   排查：1) 容器是否启动 docker ps  2) .env 里 MYSQL_PORT/PASSWORD 是否对\n')
    process.exit(1)
  }

  app.listen(PORT, async () => {
    console.log(`\n✅ AI 后端已启动: http://localhost:${PORT}`)
    console.log(`   AI: provider=${ai.provider} model=${ai.model} hasKey=${ai.hasKey}`)

    // 初始化 RAG（失败不影响主服务）
    try {
      const { initRAG } = await import('./services/ragService.mjs')
      await initRAG()
    } catch (e) {
      console.log('   ⚠️ RAG 初始化失败:', e.message)
    }

    if (!ai.hasKey) console.log('   ⚠️ 未填 AI_API_KEY，AI 类接口会提示；衣橱数据库接口不受影响。\n')
  })
}

bootstrap()
