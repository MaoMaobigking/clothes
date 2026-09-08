/**
 * 手写 tool-calling 循环（规格 3.3）。
 *
 * 工具的 schema 和执行逻辑已上移到 ./toolCore.mjs —— 原来这里和 mcp/server.mjs 各写了一份，
 * 改一个字段容易忘另一边。本文件现在只做两件事：
 *   1. 把中性的 TOOL_SPECS 适配成 OpenAI 的 tools 格式；
 *   2. 跑手写的 tool-calling 循环。
 *
 * executeTool 的数据仍然全部由调用方经 context 传入（context.garments / context.profile），
 * 这一层不 import 任何 repository —— 保持无依赖，也就不会引入循环引用。
 */
import { API_KEY, MODEL, CHAT_COMPLETIONS_URL } from './provider.mjs'
import { TOOL_SPECS, toOpenAiTools, runTool } from './toolCore.mjs'

/**
 * 工具定义（OpenAI Chat Completions 格式）。
 * GET /api/chat/tools 直接把这个数组吐给前端，形状不能改。
 */
export const TOOLS = toOpenAiTools(TOOL_SPECS)

/**
 * 工具执行器
 *
 * 这里刻意把异常吞成文本：tool-calling 是个多轮循环，单个工具挂掉不该打断整条 SSE，
 * 把错误当成工具结果喂回模型，它可以换个说法重试或者向用户解释。
 * MCP 侧不做这层包装 —— 那边由 SDK 转成协议里的 isError 字段。
 *
 * @param {string} name 工具名
 * @param {object} args 参数
 * @param {object} context 上下文（context.garments / context.profile，由调用方准备）
 * @returns {Promise<string>} 工具执行结果的文本描述
 */
export async function executeTool(name, args, context = {}) {
  try {
    return await runTool(name, args, context)
  } catch (err) {
    return `工具执行失败: ${err.message}`
  }
}

/**
 * 手写 tool-calling 循环
 *
 * 流程：
 * 1. 用户消息 + tools 定义 → 调模型
 * 2. 模型返回 tool_calls? → 执行工具 → 结果喂回模型
 * 3. 模型返回 text? → 流式输出给用户 → 结束
 *
 * @param {string[]} messages - [{role, content}]
 * @param {function} onChunk - 流式回调
 * @param {object} context - 工具执行上下文 { garments, profile }
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>} 完整回复文本
 */
export async function aiChatWithTools(messages, onChunk, context = {}, signal) {
  const system =
    '你是「灵犀」——一个亲切专业的中文穿搭顾问。你可以使用工具来查询用户的衣橱、天气和画像信息，从而给出更精准的建议。'

  // 最多循环 5 轮（防止无限循环）
  for (let round = 0; round < 5; round++) {
    const body = {
      model: MODEL,
      temperature: 0.8,
      messages: [{ role: 'system', content: system }, ...messages.map(normalizeOpenAiMessage)],
      tools: TOOLS,
      tool_choice: 'auto',
    }

    const r = await fetch(CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(body),
      signal,
    })
    if (!r.ok) throw new Error(`OpenAI 接口 ${r.status}: ${await r.text()}`)
    const data = await r.json()
    const msg = data.choices?.[0]?.message
    if (!msg) throw new Error('模型返回为空')

    // 检查是否有 tool_calls
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      // 记录 assistant 的 tool_calls 消息
      messages.push({ role: 'assistant', content: null, tool_calls: msg.tool_calls })

      // 执行每个工具并添加结果
      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name
        let args = {}
        try {
          args = JSON.parse(tc.function.arguments)
        } catch {
          /* ignore */
        }
        const result = await executeTool(toolName, args, context)
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        })
      }
      // 继续循环，把工具结果喂回模型
      continue
    }

    // 普通文本回复 → 返回
    const content = msg.content || ''
    if (onChunk) onChunk(content)
    return content
  }

  throw new Error('工具调用超出最大轮次')
}

function normalizeOpenAiMessage(message) {
  const role = ['system', 'user', 'assistant', 'tool'].includes(message?.role) ? message.role : 'user'
  const normalized = {
    role,
    content: String(message?.content ?? ''),
  }

  if (role === 'assistant' && Array.isArray(message.tool_calls)) {
    normalized.tool_calls = message.tool_calls
  }
  if (role === 'tool' && message.tool_call_id) {
    normalized.tool_call_id = message.tool_call_id
  }

  return normalized
}
