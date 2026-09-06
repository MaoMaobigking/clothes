/**
 * SSE 流式输出（规格 3.2）。
 *
 * 两套协议的分片格式不一样：OpenAI 是 `data: {...}` 逐行，
 * Anthropic 是带 event 名的 content_block_delta。对上层统一成 onChunk(文本片段)。
 */
import { API_KEY, MODEL, API_STYLE, CHAT_COMPLETIONS_URL, ANTHROPIC_MESSAGES_URL } from './provider.mjs'
/**
 * 流式 AI 对话（SSE）
 * @param {string[]} messages - [{role, content}]
 * @param {string} [system] - 系统 prompt
 * @param {function} onChunk - 每收到一个 token 回调 (delta: string)
 * @param {AbortSignal} [signal] - 取消信号
 * @returns {Promise<string>} 完整回复文本
 */
export async function aiChatStream(messages, system, onChunk, signal) {
  const sys =
    system ||
    '你是「灵犀」——一个亲切专业的中文穿搭顾问。回答简洁口语化，多给具体、可执行的单品和搭配建议，必要时分点。不要超过 200 字。'

  if (API_STYLE === 'anthropic') {
    return streamAnthropic(sys, messages, onChunk, signal)
  }
  return streamOpenAI(sys, messages, onChunk, signal)
}

/** OpenAI 流式 */
async function streamOpenAI(system, messages, onChunk, signal) {
  const r = await fetch(CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.8,
      stream: true,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
    signal,
  })
  if (!r.ok) throw new Error(`OpenAI 流式接口 ${r.status}: ${await r.text()}`)

  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content || ''
        if (delta) {
          fullText += delta
          onChunk(delta)
        }
      } catch {
        /* 忽略解析错误的行 */
      }
    }
  }
  return fullText
}

/** Anthropic 流式 */
async function streamAnthropic(system, messages, onChunk, signal) {
  const r = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system,
      messages,
      stream: true,
    }),
    signal,
  })
  if (!r.ok) throw new Error(`Anthropic 流式接口 ${r.status}: ${await r.text()}`)

  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      try {
        const json = JSON.parse(data)
        if (json.type === 'content_block_delta' && json.delta?.text) {
          fullText += json.delta.text
          onChunk(json.delta.text)
        }
      } catch {
        /* ignore */
      }
    }
  }
  return fullText
}
