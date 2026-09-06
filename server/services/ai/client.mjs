/**
 * 大模型调用底座：结构化输出、纯文本补全、以及两套协议的原始调用。
 *
 * 三级降级：能用 json_schema 就用；不行退 json_object + prompt 约束；
 * 再不行走普通调用 + 手写 JSON 提取 + Schema 校验（fallbackJsonCall）。
 * 这一层不认识业务，只认识「system + prompt + schema」。
 */
import {
  API_KEY,
  MODEL,
  API_STYLE,
  SUPPORTS_JSON_SCHEMA,
  CHAT_COMPLETIONS_URL,
  ANTHROPIC_MESSAGES_URL,
} from './provider.mjs'
import { parseJson } from './schemas.mjs'
/**
 * 带 JSON Schema 的结构化调用
 * @param {object} opts
 * @param {string} opts.system
 * @param {string} opts.prompt
 * @param {object} opts.jsonSchema - OpenAI 格式的 json_schema 定义
 * @returns {Promise<any>} 解析后的 JSON 对象
 */
export async function structuredComplete({ system, prompt, jsonSchema }) {
  if (API_STYLE === 'anthropic') {
    return structuredAnthropic(system, prompt, jsonSchema)
  }
  return structuredOpenAI(system, prompt, jsonSchema)
}

/** OpenAI 兼容：按 provider 能力使用 json_schema 或 json_object */
async function structuredOpenAI(system, prompt, jsonSchema) {
  const useJsonSchema = SUPPORTS_JSON_SCHEMA
  const userPrompt = useJsonSchema ? prompt : buildJsonOutputPrompt(prompt, jsonSchema)
  const body = {
    model: MODEL,
    temperature: 0.7,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ],
    response_format: useJsonSchema ? { type: 'json_schema', json_schema: jsonSchema } : { type: 'json_object' },
  }
  const r = await fetch(CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const errText = await r.text()
    // 部分代理只支持普通 JSON 输出，遇到 response_format 拒绝时走 prompt 兜底
    if (r.status === 400 && structuredFormatRejected(errText)) {
      console.warn('[aiService] Provider 拒绝当前 structured output，回退到 prompt 约束 + 手动解析')
      return fallbackJsonCall(system, prompt, jsonSchema)
    }
    throw new Error(`OpenAI 接口 ${r.status}: ${errText}`)
  }
  const data = await r.json()
  const content = data.choices?.[0]?.message?.content ?? ''
  return parseJson(content, jsonSchema)
}

function buildJsonOutputPrompt(prompt, jsonSchema) {
  const schemaText = JSON.stringify(jsonSchema.schema, null, 2)
  return `${prompt}

输出要求：只返回一个 JSON 对象，必须使用合法 JSON 语法，不要输出 Markdown 代码块或任何解释。
JSON 对象字段结构请严格参考：
${schemaText}`
}

function structuredFormatRejected(errorText) {
  return /response_format|json_schema|json schema/i.test(errorText)
}

/** Anthropic: 使用 tool_use 模拟 structured output */
async function structuredAnthropic(system, prompt, jsonSchema) {
  // Anthropic 原生 structured output 需要新版 API，这里用 tool_use 模拟
  const body = {
    model: MODEL,
    max_tokens: 2000,
    system,
    messages: [{ role: 'user', content: prompt }],
    tools: [
      {
        name: jsonSchema.name,
        description: `返回符合 schema 的 JSON: ${JSON.stringify(jsonSchema.schema)}`,
        input_schema: jsonSchema.schema,
      },
    ],
    tool_choice: { type: 'tool', name: jsonSchema.name },
  }
  const r = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`Anthropic 接口 ${r.status}: ${await r.text()}`)
  const data = await r.json()

  // 从 tool_use 块提取 JSON
  for (const block of data.content || []) {
    if (block.type === 'tool_use' && block.name === jsonSchema.name) {
      return block.input
    }
  }
  // 回退：从文本中提取
  const text = data.content?.find((c) => c.type === 'text')?.text || ''
  return parseJson(text, jsonSchema)
}

/** 兜底：普通调用 + 手动 JSON 提取 + Schema 校验 */
async function fallbackJsonCall(system, prompt, jsonSchema) {
  const text = await aiCompleteText(system, buildJsonOutputPrompt(prompt, jsonSchema))
  return parseJson(text, jsonSchema)
}

/** 普通文本补全（无 structured output） */
export async function aiCompleteText(system, prompt) {
  const text = await aiComplete({
    system,
    messages: [{ role: 'user', content: prompt }],
  })
  return text
}

export function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label}超时（${ms}ms）`)
      err.code = 'AI_TIMEOUT'
      reject(err)
    }, ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export async function aiComplete({ system, messages }) {
  return API_STYLE === 'anthropic' ? callAnthropic(system, messages) : callOpenAI(system, messages)
}

export async function callOpenAI(system, messages) {
  const r = await fetch(CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.8,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  })
  if (!r.ok) throw new Error(`OpenAI兼容接口 ${r.status}: ${await r.text()}`)
  const data = await r.json()
  return data.choices?.[0]?.message?.content ?? ''
}

export async function callAnthropic(system, messages) {
  const r = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1200, system, messages }),
  })
  if (!r.ok) throw new Error(`Anthropic接口 ${r.status}: ${await r.text()}`)
  const data = await r.json()
  return data.content?.[0]?.text ?? ''
}
