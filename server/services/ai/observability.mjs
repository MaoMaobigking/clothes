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
 * ⚠️ 目前记不了 token 数：aiComplete / aiChatStream / aiChatWithTools 都只返回文本，
 * 没有把 provider 响应里的 usage 透出来。所以 prompt_tokens / completion_tokens
 * 这一轮固定是 0，先把 provider / model / 延迟 / 成败 / 场景记上。
 * 要补 token 得先改底层的返回形状，是另一件事，别在这里假装记了。
 */
import { logAiCall } from '../../repositories/aiRepo.mjs'
import { getAiRuntime } from './provider.mjs'

/**
 * 包一次 AI 调用：计时、记成败、原样透传结果和异常。
 *
 * logAiCall 自己吞异常（见它的注释：「监控把业务搞挂了」是常见线上事故），
 * 所以这里不用再 try 一层。但异常必须原样重抛 —— 观测不能改变业务行为。
 *
 * @param {{ userId?: number, scene: string }} meta scene 用来分组统计，如 'chat' / 'chat_stream' / 'style_report'
 * @param {() => Promise<T>} fn 真正的 AI 调用
 * @returns {Promise<T>}
 * @template T
 */
export async function withAiLog(meta, fn) {
  const runtime = getAiRuntime()
  const startedAt = performance.now()
  try {
    const result = await fn()
    await logAiCall({
      userId: meta.userId ?? null,
      scene: meta.scene,
      provider: runtime.provider,
      model: runtime.model,
      latencyMs: Math.round(performance.now() - startedAt),
      ok: true,
    })
    return result
  } catch (err) {
    await logAiCall({
      userId: meta.userId ?? null,
      scene: meta.scene,
      provider: runtime.provider,
      model: runtime.model,
      latencyMs: Math.round(performance.now() - startedAt),
      ok: false,
      errorMsg: err?.message,
    })
    throw err
  }
}
