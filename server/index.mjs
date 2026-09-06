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
import { mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
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
import { ensureSceneCatalog } from './services/scene/index.mjs'
import customRoutes from './routes/custom.mjs'
import { ensureDesigners } from './services/customService.mjs'
import communityRoutes from './routes/community.mjs'
import orderRoutes from './routes/orders.mjs'
import { createAiTaskRouter } from './routes/aiTasks.mjs'
import { ensureDemoData } from './services/demoSeedService.mjs'
import { getAiRuntime } from './services/ai/index.mjs'
import { getBailianRuntime } from './services/bailianService.mjs'
import { initDb, ping, DB_NAME, DB_TARGET } from './db/mysql.mjs'
import { config, CONFIG_NOTES } from './config/env.mjs'

const app = express()
const here = dirname(fileURLToPath(import.meta.url))
const uploadDir = join(here, 'uploads')
mkdirSync(uploadDir, { recursive: true })

const ai = getAiRuntime()
const bailian = getBailianRuntime()
const PORT = config.runtime.port

app.use(cors())
app.use(express.json({ limit: '12mb' }))
app.use(logger)
app.use('/uploads', express.static(uploadDir))

/*
 * 演示素材（139 张，3.5 MB）。
 *
 * 为什么后端要管静态图：微信小程序主包上限 2 MB，这堆图必须出包，
 * 打包时用 VITE_CLOUD_IMG_BASE 把 /static/images/... 改写成
 * http://本机地址:8787/images/...（见 miniapp/vite.config.ts）。
 *
 * 两个候选目录，按顺序取第一个存在的：
 *   - <上一级>/images        ← 容器里的布局（deploy/pack-cloudrun.mjs 打出来的
 *                              zip 里 server/ 和 images/ 是同级）
 *   - <上一级>/miniapp/src/static/images ← 本机开发时图的原始位置
 * 想放别处就用环境变量 IMAGES_DIR 指定。
 */
const imagesDir = (() => {
  if (config.runtime.imagesDir) return resolve(config.runtime.imagesDir)
  for (const dir of [join(here, '..', 'images'), join(here, '..', 'miniapp', 'src', 'static', 'images')]) {
    if (existsSync(dir)) return dir
  }
  return join(here, '..', 'images')
})()
// immutable：这些图文件名固定、内容不变，让微信/浏览器长期缓存，别每次演示都重下
app.use('/images', express.static(imagesDir, { maxAge: '30d', immutable: true }))

/* ============ 健康检查 ============ */
/*
 * 根路径探活。微信云托管默认拿 GET / 判断容器是否健康，返回 404 会被判定为
 * 启动失败、然后无限重启 —— 而日志里看不出任何错误，属于纯浪费时间的坑。
 * 保持极轻：不碰数据库，只证明进程活着在监听。
 */
app.get('/', (_req, res) => res.json({ ok: true, service: 'ai-fashion-server' }))

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
  // 配置体检要在连库【之前】打，否则一旦连不上，人只看得到驱动层那句
  // getaddrinfo / ECONNREFUSED，看不出是自己哪一格填串了。
  for (const note of CONFIG_NOTES) console.warn(`⚠️ 配置检查：${note}`)
  const dbHost = DB_TARGET
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
    const reason = [err.code, err.message].filter(Boolean).join(' ') || '(驱动没给原因)'
    console.error(`\n❌ MySQL 连接失败 (${dbHost}/${DB_NAME}): ${reason}`)
    if (!config.db.hostConfigured) {
      // 云托管上最常见的死法：环境变量面板漏了 MYSQL_HOST，于是回落到上面那个
      // localhost，而容器里当然没有 MySQL —— 表现成「镜像构建成功，部署时反复重启」
      // （Back-off restarting failed container）。所以这里要把「兜底值」这件事说出来，
      // 否则日志里那个 localhost 看着像是配错了地址。
      console.error('   ⚠️ MYSQL_HOST 没有设置，上面的 localhost 是代码兜底值，不是你配的地址。')
      console.error(
        '   · 云托管：服务设置 → 环境变量，补 MYSQL_HOST（MySQL 实例的【内网】地址）和 MYSQL_PASSWORD，然后重新部署',
      )
      console.error('   · 本机：检查 server/.env\n')
    } else {
      console.error(
        '   排查：1) 数据库实例在不在运行  2) MYSQL_PORT / MYSQL_PASSWORD 对不对  3) 容器到数据库网络通不通\n',
      )
    }
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
