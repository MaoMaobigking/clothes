/**
 * 模型调用的 token 用量收集。
 *
 * ────────────────────────────────────────────────────────────────
 * 为什么不是改返回形状
 *
 * 最直觉的做法是把底层调用的返回值从 `string` 改成 `{ text, usage }`。
 * 否掉了，两个理由：
 *
 * 1. **一次逻辑调用底下可能有多次 HTTP 往返。**
 *    `aiChatWithTools` 的循环最多跑 5 轮（每轮一次 POST）；
 *    `generateReport` 走三级兜底时也可能连打两次。
 *    返回值只能带最后一次的数字，而「这次对话一共花了多少钱」问的是**总和**。
 *    累加器天然能回答，返回值不能。
 *
 * 2. **中间层返回的是业务对象，不是文本。**
 *    `generateReport` 返回报告对象、`generateSceneOutfits` 返回搭配数组。
 *    把它们包成 `{ data, usage }` 会污染七处调用方，
 *    而这一层本来就不该认识 token 这种计费概念（同 observability.mjs 顶部那条：
 *    「底层不该认识 userId，认识了就没法给不带身份的脚本复用」）。
 *
 * 所以用 AsyncLocalStorage：`withAiLog` 开一个收集器，
 * 期间任何深度的模型调用都能把用量报上来，**函数签名一个都不用改**。
 *
 * 不在收集器里调用（比如 `scripts/checkAi.mjs` 直接调 `aiChatStream`）时，
 * `getStore()` 返回 undefined，`reportUsage` 静默跳过 —— 观测是旁路，不能反过来要求调用方配合。
 * ────────────────────────────────────────────────────────────────
 */
import { AsyncLocalStorage } from 'node:async_hooks'

const usageStore = new AsyncLocalStorage()

function newAccumulator() {
  return {
    promptTokens: 0,
    completionTokens: 0,
    /** 命中缓存的输入 token（便宜的那部分）。DeepSeek 叫 prompt_cache_hit_tokens，Anthropic 叫 cache_read_input_tokens */
    cacheHitTokens: 0,
    /** 写入缓存的输入 token（比普通输入略贵）。只有 Anthropic 报这个 */
    cacheWriteTokens: 0,
    /** 这次逻辑调用底下真实发生了几次模型往返 —— tool-calling 循环会 > 1 */
    calls: 0,
    /** 有没有任何一次真的报了用量。全程 false 说明 provider 没吐 usage，别把 0 当成"这次不花钱" */
    reported: false,
  }
}

/**
 * 开一个用量作用域。
 *
 * 返回的 `usage` 就是 AsyncLocalStorage 里那个累加器**本身**（原地累加，不是快照），
 * 所以调用方拿到它之后随时读都是最新值 —— 包括 `run(fn)` 抛异常之后。
 * 这一点是刻意的：tool-calling 第 3 轮才挂的话，前 2 轮的 token 是真花了的，
 * 失败路径必须还能读到，否则失败调用的成本会凭空消失。
 *
 * @returns {{ usage: ReturnType<typeof newAccumulator>, run: <T>(fn: () => Promise<T>) => Promise<T> }}
 */
export function createUsageScope() {
  const acc = newAccumulator()
  return {
    usage: acc,
    run: (fn) => usageStore.run(acc, fn),
  }
}

/**
 * 底层调用把一次 HTTP 往返的用量报上来。
 *
 * 吃 provider 的原始 usage 对象（两套命名都认），归一后累加。
 * 不在收集器里就静默跳过。
 *
 * @param {object} raw provider 响应里的 usage 字段
 */
export function reportUsage(raw) {
  const acc = usageStore.getStore()
  if (!acc) return

  const u = normalizeUsage(raw)
  acc.calls += 1
  if (!u) return

  acc.promptTokens += u.promptTokens
  acc.completionTokens += u.completionTokens
  acc.cacheHitTokens += u.cacheHitTokens
  acc.cacheWriteTokens += u.cacheWriteTokens
  acc.reported = true
}

/**
 * 两套 provider 的 usage 命名归一。
 *
 * OpenAI 兼容（含 DeepSeek）:
 *   prompt_tokens / completion_tokens
 *   prompt_cache_hit_tokens / prompt_cache_miss_tokens   ← DeepSeek 的上下文硬盘缓存，OpenAI 没有
 * Anthropic:
 *   input_tokens / output_tokens
 *   cache_read_input_tokens / cache_creation_input_tokens
 *
 * ⚠️ 缓存字段是**按 provider 可选**的，读不到就是 0 —— 不代表没有缓存，
 * 只代表这家没报。别拿 cacheHitTokens=0 反推"缓存没生效"。
 *
 * @returns {{promptTokens:number, completionTokens:number, cacheHitTokens:number, cacheWriteTokens:number} | null}
 */
export function normalizeUsage(raw) {
  if (!raw || typeof raw !== 'object') return null

  const prompt = num(raw.prompt_tokens) ?? num(raw.input_tokens)
  const completion = num(raw.completion_tokens) ?? num(raw.output_tokens)
  // 两个都读不到说明这不是一个 usage 对象，别记一行全 0 的假数据
  if (prompt === undefined && completion === undefined) return null

  return {
    promptTokens: prompt ?? 0,
    completionTokens: completion ?? 0,
    cacheHitTokens: num(raw.prompt_cache_hit_tokens) ?? num(raw.cache_read_input_tokens) ?? 0,
    cacheWriteTokens: num(raw.cache_creation_input_tokens) ?? 0,
  }
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}
