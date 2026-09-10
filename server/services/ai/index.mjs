/**
 * AI 服务层的统一出口。
 *
 * 原来这一层是单个 995 行的 services/aiService.mjs，六件事挤在一起：
 * provider 适配 / JSON Schema / 底层调用 / 流式 / tool-calling / 业务用例。
 * 拆开之后每块各自成文件，这里只负责把公开接口原样再导出 —— 对外的符号和拆分前完全一致。
 * （2026-09-10 重数：实际导出 23 个符号，旧注释写的 14 是错的。）
 *
 * 依赖方向是单向的，不存在循环引用：
 *   provider ← client ← usecases
 *   provider ← stream
 *   provider ← tools ← toolCore
 *   schemas  ← client / usecases
 *   usage    ← client / stream / tools / observability   （用量收集，不反向依赖任何人）
 *   aiRepo   ← chat / observability   （这两层认识 userId，底层调用函数不认识）
 *
 * usage.mjs 刻意不从这里导出：它是 withAiLog 的内部管道，
 * 对外只需要 withAiLog 这一个入口，多导出两个符号只会让人以为该手动调。
 *
 * ⚠️ ESM 不支持目录导入，引用方必须写全 `services/ai/index.mjs`，
 * 少写 `/index.mjs` 会直接 ERR_MODULE_NOT_FOUND（好在不会静默失败）。
 */

export { getAiRuntime } from './provider.mjs'
export { STYLE_REPORT_SCHEMA, SCENE_OUTFIT_SCHEMA, parseJson } from './schemas.mjs'
export { aiComplete, callOpenAI, callAnthropic } from './client.mjs'
export { generateReport, generateSceneOutfits, aiChat } from './usecases.mjs'
export { aiChatStream } from './stream.mjs'
export { TOOLS, executeTool, aiChatWithTools } from './tools.mjs'
export {
  ensureSession,
  appendMessage,
  listSessions,
  getHistory,
  removeSession,
  saveReport,
  listReports,
  getReport,
} from './chat.mjs'
export { withAiLog } from './observability.mjs'
