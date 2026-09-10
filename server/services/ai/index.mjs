/**
 * AI 服务层的统一出口。
 *
 *
 * 2026-09-10 再分四层：原来 12 个文件平铺在 ai/ 下，看目录看不出谁是底座谁是上层。
 * 现在按「这块东西是什么」分桶，对外导出面一个符号都没变：
 *
 *   runtime/    怎么调到模型 —— provider（环境与模型解析）/ client（底层调用）/ schemas（结构化契约）
 *   chat/       对话与生成   —— usecases（一次性）/ stream（流式）/ context（上下文裁剪）/ storage（会话与报告落库）
 *   tools/      tool-calling —— index（TOOLS 与 agent 循环）/ handlers（各工具实现，与 MCP 共用同一份）
 *   telemetry/  用量与日志   —— usage（token 累加）/ observability（withAiLog）
 *
 * 依赖方向仍是单向的，不存在循环引用（箭头指向依赖方）：
 *   runtime/provider ← runtime/client ← chat/usecases
 *   runtime/provider ← chat/stream
 *   runtime/provider ← tools/index ← tools/handlers
 *   runtime/schemas  ← runtime/client / chat/usecases
 *   chat/context     ← chat/usecases / chat/stream / tools/index      （上下文裁剪，本身零依赖）
 *   telemetry/usage  ← runtime/client / chat/stream / tools/index / telemetry/observability
 *                                                                     （用量收集，不反向依赖任何人）
 *   aiRepo           ← chat/storage / telemetry/observability          （这两层认识 userId，底层调用函数不认识）
 *
 * 跨出 ai/ 的依赖只有两条，都在 tools/handlers.mjs：
 *   ../../weather.mjs                 get_weather 工具
 *   ../../wardrobe/bodyProfile.mjs    remember_preference 工具
 * 方向是 ai/ → 业务域，不存在业务域反向依赖 ai/。
 *
 * telemetry/usage.mjs 与 chat/context.mjs 刻意不从这里导出：它们是内部管道，
 * 对外只需要 withAiLog 和三个对话函数这几个入口。
 * 同理 tools/handlers.mjs 的 TOOL_SPECS / toMcpTools / runTool 也不进 barrel ——
 * 唯一的外部消费者 mcp/server.mjs 直引该文件，barrel 是门面而不是唯一通道。
 *
 * ⚠️ ESM 不支持目录导入，引用方必须写全 `services/ai/index.mjs`，
 * 少写 `/index.mjs` 会直接 ERR_MODULE_NOT_FOUND（好在不会静默失败）。
 */

export { getAiRuntime } from './runtime/provider.mjs'
export { STYLE_REPORT_SCHEMA, SCENE_OUTFIT_SCHEMA, parseJson } from './runtime/schemas.mjs'
export { aiComplete, callOpenAI, callAnthropic } from './runtime/client.mjs'
export { generateReport, generateSceneOutfits, aiChat } from './chat/usecases.mjs'
export { aiChatStream } from './chat/stream.mjs'
export { TOOLS, executeTool, aiChatWithTools } from './tools/index.mjs'
export {
  ensureSession,
  appendMessage,
  listSessions,
  getHistory,
  removeSession,
  saveReport,
  listReports,
  getReport,
} from './chat/storage.mjs'
export { withAiLog } from './telemetry/observability.mjs'
