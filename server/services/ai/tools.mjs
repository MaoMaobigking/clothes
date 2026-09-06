/**
 * 手写 tool-calling 循环（规格 3.3）。
 *
 * executeTool 的数据全部由调用方经 context 传入（context.garments / context.profile），
 * 这一层不 import 任何其它 service —— 保持无依赖，拆分时也就不会引入循环引用。
 */
import { API_KEY, MODEL, CHAT_COMPLETIONS_URL } from './provider.mjs'
/**
 * 工具定义
 */
export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_garments',
      description: '搜索用户的衣橱，根据关键词、分类、颜色等条件查找衣物',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词（可选，如"白色衬衫"）' },
          category: {
            type: 'string',
            enum: ['top', 'pants', 'skirt', 'dress', 'shoes', 'bag', 'hat', 'jewelry', 'accessory'],
          },
          color: { type: 'string', description: '颜色偏好（可选）' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '查询指定城市的天气信息',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名，如"北京"、"上海"、"重庆"' },
        },
        required: ['city'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_profile',
      description: '获取当前用户的身形数据、风格偏好等信息',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
]

/**
 * 工具执行器
 * @param {string} name 工具名
 * @param {object} args 参数
 * @param {object} context 上下文（garmentRepo, weather mock 等）
 * @returns {Promise<string>} 工具执行结果的文本描述
 */
export async function executeTool(name, args, context = {}) {
  switch (name) {
    case 'search_garments': {
      const { query = '', category, color } = args
      let items = context.garments || []
      if (category) items = items.filter((g) => g.category === category)
      if (query) {
        const q = query.toLowerCase()
        items = items.filter(
          (g) => g.name.toLowerCase().includes(q) || (g.tags || []).some((t) => t.toLowerCase().includes(q)),
        )
      }
      if (color) items = items.filter((g) => (g.color || '').includes(color))
      if (items.length === 0) return '衣橱中没有找到匹配的衣物。'
      return (
        '衣橱中找到以下衣物：\n' +
        items
          .slice(0, 8)
          .map((g) => `- ${g.emoji || '👕'} ${g.name}（${g.category}，${g.brand || ''}，¥${g.price}）`)
          .join('\n')
      )
    }
    case 'get_weather': {
      const { city } = args
      // Mock 天气数据（生产环境接入真实天气 API）
      const mockWeather = {
        北京: { temp: 25, condition: '晴', icon: '☀️' },
        上海: { temp: 28, condition: '多云', icon: '⛅' },
        重庆: { temp: 23, condition: '暴雨', icon: '🌧️' },
        广州: { temp: 30, condition: '雷阵雨', icon: '⛈️' },
      }
      const w = mockWeather[city] || { temp: 22, condition: '多云', icon: '☁️' }
      return `${city}天气：${w.icon} ${w.condition}，气温 ${w.temp}°C`
    }
    case 'get_user_profile': {
      const ctx = context.profile || {}
      if (!ctx.styles || ctx.styles.length === 0) return '用户尚未完成风格测试，没有画像数据。'
      return `用户画像：风格偏好 ${ctx.styles.join('、')}，肤色 ${ctx.skin || '未知'}，脸型 ${ctx.face || '未知'}，BMI ${ctx.bmi || '未知'}`
    }
    default:
      return `未知工具: ${name}`
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
