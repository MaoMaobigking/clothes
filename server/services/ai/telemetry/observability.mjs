/**
 * AI 调用可观测性。
 *
 * `repositories/aiRepo.mjs` 的 logAiCall() 和 ai_logs 表早就写好了，但零调用 ——
 * 「AI 平均延迟」「哪个接口最慢」「今天失败了几次」这些问题一个都答不上来。
 * 这一层就是把它接上。
 *
 * 放在编排层调用（chat.mjs / 路由处理器），不改 aiChat / generateReport 这些
 * 底层函数的签名 —— 底层不该认识 userId，认识了就没法给不带身份的脚本复用。
 *
 * token 用量走 ./usage.mjs 的 AsyncLocalStorage 作用域，同样**不改任何函数签名**。
 * 为什么不是把返回形状改成 `{ text, usage }`，见 usage.mjs 顶部的两条理由
 * （一次逻辑调用底下可能有 5 次往返 / 中间层返回的是业务对象）。
 */
import { logAiCall } from '../../../repositories/aiRepo.mjs'
import { getAiRuntime } from '../runtime/provider.mjs'
import { createUsageScope } from './usage.mjs'

/**
 * 包一次 AI 调用：计时、收 token 用量、记成败，原样透传结果和异常。
 *
 * logAiCall 自己吞异常（见它的注释：「监控把业务搞挂了」是常见线上事故），
 * 所以这里不用再 try 一层。但异常必须原样重抛 —— 观测不能改变业务行为。
 *
 * ⚠️ 失败时也记用量：抛异常之前可能已经成功打过几次模型（tool-calling 第 3 轮才挂的话，
 * 前 2 轮的 token 是真花了的）。`scope.usage` 是原地累加的同一个对象，
 * 所以 catch 分支读到的就是「挂之前已经花掉的」。
 *
 * @param {{ userId?: number, scene: string }} meta scene 用来分组统计，如 'chat' / 'chat_stream' / 'style_report'
 * @param {() => Promise<T>} fn 真正的 AI 调用
 * @returns {Promise<T>}
 * @template T
 */
export async function withAiLog(meta, fn) {
  const runtime = getAiRuntime()
  const startedAt = performance.now()
  const scope = createUsageScope()

  try {
    const result = await scope.run(fn)
    await write(meta, runtime, startedAt, scope.usage, true)
    return result
  } catch (err) {
    await write(meta, runtime, startedAt, scope.usage, false, err?.message)
    throw err
  }
}

async function write(meta, runtime, startedAt, usage, ok, errorMsg) {
  await logAiCall({
    userId: meta.userId ?? null,
    scene: meta.scene,
    provider: runtime.provider,
    model: runtime.model,
    latencyMs: Math.round(performance.now() - startedAt),
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    cacheHitTokens: usage.cacheHitTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
    modelCalls: usage.calls,
    ok,
    errorMsg,
  })
}
