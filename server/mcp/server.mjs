/**
 * MCP Server — AI 服装穿搭工具暴露
 *
 * 暴露工具：search_garments / get_weather / get_user_profile / generate_style_report
 * 使用 @modelcontextprotocol/sdk 标准协议。
 *
 * 工具的 schema 和执行逻辑在 services/ai/toolCore.mjs（与手写 tool-calling 共用同一份），
 * 本文件只负责三件事：确定身份、按需从库里取数据、把结果包成 MCP 的 content 格式。
 *
 * 启动：npm run mcp        （必须走 --env-file=.env，否则读不到数据库和 MCP_USER_ID）
 * 调试：npm run mcp:debug
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { TOOL_SPECS, toMcpTools, runTool } from '../services/ai/toolCore.mjs'
import { listGarments } from '../services/garmentService.mjs'
import { getLatestProfile } from '../services/profileService.mjs'
import { closeDb } from '../db/mysql.mjs'

// ── 身份 ─────────────────────────────────────────────────────
//
// MCP 是独立的 stdio 进程，没有 HTTP 请求、没有 Authorization 头、没有 JWT 中间件，
// 所以工具层拿不到 userId。这里在 connect 之前就把身份定死：
// 一个 MCP 进程 == 一个用户的会话，和「一台 Claude Desktop 对应一个人」是同一个语义。
//
// 为什么不做成工具参数：模型可以填任意 userId，那就是水平越权。身份必须在协议之外确定。

//待办：生产环境或多用户场景（未来扩展）
//如果这个 MCP 服务未来要同时为网页端的所有在线用户服务，就不能再用 .env 这种静态写死的方式了。
//届时需要改造架构：让网页端在调用 AI、触发 MCP 工具时，把当前登录用户的 token 或 user_id 作为参数动态传给 MCP，让 MCP 动态获取，而不是靠启动时在配置文件里写死。

/*mcp服务自己不知道当前服务于谁所以需要MCP_USER_ID来区分*/
const mcpUserId = Number(process.env.MCP_USER_ID)

if (!process.env.MCP_USER_ID || !Number.isInteger(mcpUserId) || mcpUserId <= 0) {
  // 注意走 stderr：stdout 是 JSON-RPC 的协议通道，往里打日志会让客户端解析失败。
  console.error('❌ 缺少环境变量 MCP_USER_ID（需为正整数）。请在 server/.env 中配置，并用 npm run mcp 启动。')
  // 不给默认值、直接退出：默认成 1 就又变回「userId 写死」，隔离等于没做。
  //强行终止程序
  process.exit(1)
}

// ── 工具定义 ──────────────────────────────────────────────────
//定义 AI 能够调用的工具
const TOOLS = toMcpTools(TOOL_SPECS)

// ── 取数据 ───────────────────────────────────────────────────

/**
 * profileRepo 返回的是扁平形状，而 toolCore / usecases.generateReport 吃的是嵌套形状
 * （styles/skin/face/bmi 在顶层，围度收在 body 下），这里做一次转换。
 * 用户还没做过风格测试时 findLatestProfile 返回 null，转成 {} 交给下游的空值分支处理。
 */
function toNestedProfile(flat) {
  if (!flat) return {}
  return {
    styles: flat.styles || [],
    skin: flat.skin || '',
    face: flat.face || '',
    visualBody: flat.visualBody || '',
    bmi: flat.bmi,
    preferences: flat.preferences || {},
    body: {
      height: flat.height,
      weight: flat.weight,
      bust: flat.bust,
      waist: flat.waist,
      hips: flat.hips,
      shoulder: flat.shoulder,
      thigh: flat.thigh,
      calf: flat.calf,
    },
  }
}

/**
 * 按工具名只取它真正需要的数据 —— get_weather 不该顺带查一遍衣橱。
 * 每次调用都重新查，因为衣橱和画像在 HTTP 侧随时会被改。
 *
 * userId 一律带上：写工具 remember_preference 需要它，而身份必须由本进程给
 * （启动时注入、进程级锁定），不能来自模型填的参数 —— 见本文件顶部「身份」一节。
 */
async function buildContext(name) {
  switch (name) {
    case 'search_garments':
      return { userId: mcpUserId, garments: await listGarments(mcpUserId) }
    case 'get_user_profile':
    case 'generate_style_report':
      return { userId: mcpUserId, profile: toNestedProfile(await getLatestProfile(mcpUserId)) }
    default:
      return { userId: mcpUserId }
  }
}

// ── 启动 MCP Server ──────────────────────────────────────────

/*
 * 为什么还在用低阶的 Server 而不是 McpServer（IDE 会提示 Server 已弃用）——这是有意的，别顺手"修警告"。
 *
 * SDK 1.29.0 实测（2026-09-08）：
 *   McpServer.registerTool 的 inputSchema 只接受 Zod
 *   （类型上是 `AnySchema = z3.ZodTypeAny | z4.$ZodType`），
 *   传裸 JSON Schema 运行时直接抛
 *   "inputSchema must be a Zod schema or raw shape, received an unrecognized object"。
 *
 * 而本项目的工具 schema 要同时喂两个消费者：
 *   - MCP 的 tools/list（inputSchema）
 *   - OpenAI 的 tools[].function.parameters（GET /api/chat/tools 直接吐给前端）
 * 后者只认 JSON Schema。改成 Zod 优先就得靠 z.toJSONSchema() 转回去，
 * 而它会多塞 $schema 和 additionalProperties:false 两个键，得再摸掉才能保证前端契约不变
 * —— 等于为了消一个提示，给单一真源加一层需要人工消毒的转换。
 *
 * Server 的弃用说明原话是 "Only use `Server` for advanced use cases"：
 * 「一份 JSON Schema 同时供 MCP 和非 MCP 两侧」正是这种 case。
 * 等 registerTool 支持 JSON Schema 了再迁。
 */
const server = new Server({ name: 'ai-fashion-mcp', version: '0.1.0' }, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  // runTool 对未知工具会 throw，SDK 会转成协议里的 isError —— 比返回一段
  // "未知工具: xxx" 的 text 好，后者会被模型当成正常结果读进去。
  const context = await buildContext(name)
  const text = await runTool(name, args || {}, context)
  return { content: [{ type: 'text', text }] }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`✅ AI 服装 MCP Server 已启动 (stdio)，服务用户 userId=${mcpUserId}`)
}

// 连接池会持有 socket，不显式关掉，进程收到信号也退不干净。
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await closeDb().catch(() => {})
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('MCP Server 启动失败:', err)
  process.exit(1)
})
