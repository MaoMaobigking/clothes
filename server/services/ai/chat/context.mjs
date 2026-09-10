/**
 * 对话上下文控制。
 *
 * ────────────────────────────────────────────────────────────────
 * 为什么需要这一层
 *
 * 现在的链路是：**客户端每次把整个 messages 数组发上来，服务端原样转给模型**
 * （见 routes/ai.mjs 的 /chat/stream 与 /chat/tools，都是直接读 req.body.messages）。
 * 也就是说上下文增长完全由客户端驱动，而服务端**一个上限都没有**。
 * 两个后果：聊得越久越贵、越慢；以及任何人都能构造一个巨大的 messages 数组来烧钱。
 *
 * ────────────────────────────────────────────────────────────────
 * 官方原生方案长什么样（本项目为什么手写）
 *
 * 2026 年这件事在 API 层已经有三个原生能力，各管一件事：
 *
 *   | 能力            | 干什么                      | 官方形态                          |
 *   |-----------------|-----------------------------|-----------------------------------|
 *   | Context Editing | **清**旧的工具结果 / 思考块 | `clear_tool_uses_20250919`        |
 *   | Compaction      | **摘**要早期上下文          | `compact_20260112`                |
 *   | Memory Tool     | **存**跨会话的长期记忆      | `memory_20250818`                 |
 *
 * 本项目主链路是 DeepSeek（OpenAI 兼容协议），**这三个都没有**，所以手写等价物：
 * 本文件对应前两个，`../tools/handlers.mjs` 的 `remember_preference` 对应第三个。
 *
 * 手写的取舍：摘要质量不如服务端，也没有官方那套「compaction 块要原样回传」的协议保证；
 * 但换来的是可控（我决定摘什么、留什么）和不绑定某一家的 beta。
 *
 * ────────────────────────────────────────────────────────────────
 * 四层，按「省 token 的性价比」从高到低施加，够了就停
 *
 * 1. 硬上限          —— 防御性的，挡住异常大的请求
 * 2. 裁剪历史工具结果 —— **最划算**，见下面 clearOldToolResults 的注释
 * 3. 滑动窗口        —— 丢最旧的整轮
 * 4. 摘要压缩        —— 最贵（要多打一次模型），只在前三层还不够时才走
 *
 * 顺序是按实测排的，不是拍脑袋：`npm run check:usage` 测出 tool-calling 的
 * prompt token 是普通对话的 20 倍（1055 vs 53），大头就在工具定义和工具结果的重发。
 * 所以先清工具结果，往往一层就够了，根本轮不到摘要。
 * ────────────────────────────────────────────────────────────────
 */

/** 单次请求允许的最大消息条数。超过直接砍，不做任何智能判断 —— 这是防御不是优化 */
const HARD_MAX_MESSAGES = 200

/** 目标 token 预算。超过就逐层压，压到这个数以下为止 */
const DEFAULT_BUDGET = 6000

/** 保留最近几轮的工具结果。更早的工具结果基本没有复用价值 */
const KEEP_TOOL_RESULTS_WITHIN = 2

/** 滑动窗口至少保留多少条消息（太少会把当前问题的上下文也丢掉） */
const MIN_KEPT_MESSAGES = 6

/**
 * 估算一段文本的 token 数。
 *
 * **是估算，不是真值。** 真值要 provider 的 tokenizer，本地拿不到。
 * 经验规则：中日韩字符约 1 token/字，其余（英文、数字、标点）约 1 token/4 字符。
 * 用途只是「决定要不要压缩」这个阈值判断，偏差一两成不影响决策。
 * 真实用量以 ai_logs 里 provider 回报的 usage 为准（见 services/ai/telemetry/usage.mjs）。
 */
export function estimateTokens(text) {
  const s = String(text ?? '')
  let cjk = 0
  for (const ch of s) {
    const code = ch.codePointAt(0)
    // CJK 统一表意文字 + 扩展A + 兼容表意 + 假名 + 谚文
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0x3040 && code <= 0x30ff) ||
      (code >= 0xac00 && code <= 0xd7af)
    ) {
      cjk++
    }
  }
  const rest = s.length - cjk
  return cjk + Math.ceil(rest / 4)
}

/** 一条消息的估算 token（含工具调用参数，它们也是要上行的） */
export function messageTokens(message) {
  let n = estimateTokens(message?.content)
  if (Array.isArray(message?.tool_calls)) {
    for (const tc of message.tool_calls) {
      n += estimateTokens(tc?.function?.name) + estimateTokens(tc?.function?.arguments)
    }
  }
  return n + 4 // 每条消息的角色和分隔符开销，粗略计
}

export function totalTokens(messages) {
  return messages.reduce((sum, m) => sum + messageTokens(m), 0)
}

/**
 * 第 2 层：裁剪历史工具结果（对应官方的 `clear_tool_uses_20250919`）。
 *
 * **为什么这层最划算**：工具结果是「一次性的事实」——「北京今天 20°C」在模型
 * 已经据此答完之后就没有复用价值了，但它会跟着每一轮重新上行。
 * 而工具定义 + 工具结果正是 tool-calling 比普通对话贵 20 倍的原因。
 *
 * 清什么：把旧的 `role:'tool'` 消息内容换成一句占位，并摘掉对应 assistant 消息上的
 * `tool_calls`。**不是直接删** —— OpenAI 协议要求 `tool` 消息必须紧跟在带
 * `tool_calls` 的 assistant 消息之后，直接删会破坏配对，provider 会 400。
 * 所以是「留骨架、清内容」，这也是官方 `clear_tool_uses` 的做法。
 *
 * @param {Array} messages
 * @param {number} keepWithin 最近几条 user 消息以内的工具结果予以保留
 */
export function clearOldToolResults(messages, keepWithin = KEEP_TOOL_RESULTS_WITHIN) {
  // 从后往前数 user 消息，确定「最近 keepWithin 轮」的起点
  let seenUserTurns = 0
  let cutoff = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') {
      seenUserTurns++
      if (seenUserTurns > keepWithin) {
        cutoff = i
        break
      }
    }
  }
  if (cutoff === 0) return messages // 还没有足够多的轮次，不用清

  return messages.map((m, i) => {
    if (i >= cutoff) return m
    if (m?.role === 'tool') {
      return { ...m, content: '[旧的工具结果已清理]' }
    }
    if (m?.role === 'assistant' && Array.isArray(m.tool_calls)) {
      // 保留 tool_calls 的骨架（id/name 要和后面的 tool 消息配对），只清空参数
      return {
        ...m,
        tool_calls: m.tool_calls.map((tc) => ({
          ...tc,
          function: { ...tc.function, arguments: '{}' },
        })),
      }
    }
    return m
  })
}

/**
 * 第 3 层：滑动窗口 —— 从最旧的开始丢，直到进预算。
 *
 * 两条硬约束：
 *   - 至少留 MIN_KEPT_MESSAGES 条，否则会把当前问题的上下文也丢掉
 *   - **不能让窗口以 `tool` 消息开头**，那会变成一条没有对应 `tool_calls` 的孤儿消息，
 *     provider 会 400。所以切完要往后推到第一条 user/assistant
 *
 * @returns {{ kept: Array, dropped: Array }}
 */
export function slideWindow(messages, budget) {
  if (totalTokens(messages) <= budget) return { kept: messages, dropped: [] }

  let start = 0
  while (start < messages.length - MIN_KEPT_MESSAGES && totalTokens(messages.slice(start)) > budget) {
    start++
  }
  // 别让窗口以孤儿 tool 消息开头
  while (start < messages.length && messages[start]?.role === 'tool') start++

  return { kept: messages.slice(start), dropped: messages.slice(0, start) }
}

/**
 * 第 4 层：把被丢掉的部分摘成一段话（对应官方的 `compact_20260112`）。
 *
 * **这一层要多打一次模型，是四层里唯一花钱的**，所以只在前三层压不下来时才调。
 * 调用方传 summarize 函数进来（而不是本文件直接 import client.mjs）——
 * 保持本层无依赖、可单测，也避免 context ← client ← usecases 绕出环。
 *
 * 摘要失败不抛：宁可这轮不带历史摘要，也不能让整条对话挂掉。
 */
export async function summarizeDropped(dropped, summarize) {
  if (!dropped.length || typeof summarize !== 'function') return null
  const transcript = dropped
    .filter((m) => m?.role === 'user' || m?.role === 'assistant')
    .map((m) => `${m.role === 'user' ? '用户' : '顾问'}：${String(m.content || '').slice(0, 200)}`)
    .join('\n')
  if (!transcript.trim()) return null

  try {
    const text = await summarize(transcript)
    return String(text || '').trim() || null
  } catch (err) {
    console.warn('[context] 历史摘要失败，本轮不带摘要:', err.message)
    return null
  }
}

/**
 * 把一轮对话的 messages 压进预算。
 *
 * @param {Array} messages 原始消息（**不会被修改**，返回的是新数组）
 * @param {object} [opts]
 * @param {number} [opts.budget] token 预算
 * @param {(transcript: string) => Promise<string>} [opts.summarize] 传了才启用第 4 层
 * @returns {Promise<{ messages: Array, stats: object }>}
 */
export async function fitContext(messages, opts = {}) {
  const budget = opts.budget ?? DEFAULT_BUDGET
  const before = Array.isArray(messages) ? messages : []
  const stats = {
    originalCount: before.length,
    originalTokens: totalTokens(before),
    hardCapped: false,
    toolResultsCleared: false,
    droppedCount: 0,
    summarized: false,
  }

  // 第 1 层：硬上限
  let work = before
  if (work.length > HARD_MAX_MESSAGES) {
    work = work.slice(-HARD_MAX_MESSAGES)
    stats.hardCapped = true
  }

  // 第 2 层：清旧工具结果（最划算，先来）
  if (totalTokens(work) > budget) {
    const cleared = clearOldToolResults(work)
    if (cleared !== work) {
      work = cleared
      stats.toolResultsCleared = true
    }
  }

  // 第 3 层：滑动窗口
  const { kept, dropped } = slideWindow(work, budget)
  work = kept
  stats.droppedCount = dropped.length

  // 第 4 层：摘要（只在真丢了东西、且调用方给了 summarize 时）
  if (dropped.length && opts.summarize) {
    const summary = await summarizeDropped(dropped, opts.summarize)
    if (summary) {
      // 摘要以 user 身份放在最前面：OpenAI 协议里 system 由调用方统一注入，
      // 这里再塞一条 system 会和上游的 system prompt 打架。
      work = [{ role: 'user', content: `【此前对话的摘要】${summary}` }, ...work]
      stats.summarized = true
    }
  }

  stats.finalCount = work.length
  stats.finalTokens = totalTokens(work)
  return { messages: work, stats }
}
