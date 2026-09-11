/**
 * SSE 流式输出（规格 3.2）。
 *
 * 两套协议的分片格式不一样：OpenAI 是 `data: {...}` 逐行，
 * Anthropic 是带 event 名的 content_block_delta。对上层统一成 onChunk(文本片段)。
 *
 * 用量上报：流式的 usage 不在分片正文里，两套协议各有各的取法（见下面两个函数的注释）。
 * 两边都在**读完流之后一次性上报**，而不是边读边累加 —— Anthropic 的 message_delta
 * 报的是累计值，边读边加会翻倍。
 */
import { API_KEY, MODEL, API_STYLE, CHAT_COMPLETIONS_URL, ANTHROPIC_MESSAGES_URL } from '../runtime/provider.mjs'
import { reportUsage } from '../telemetry/usage.mjs'
import { createLineBuffer } from './sseLines.mjs'
import { fitContext } from './context.mjs'
import { summarizeTranscript } from './usecases.mjs'
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

  // 上下文压进预算再上行。客户端每次把整个历史发上来，服务端原本一个上限都没有 ——
  // 聊得越久越贵越慢，而且任何人都能构造一个巨大的 messages 数组来烧钱。
  const { messages: fitted } = await fitContext(messages, { summarize: summarizeTranscript })

  if (API_STYLE === 'anthropic') {
    return streamAnthropic(sys, fitted, onChunk, signal)
  }
  return streamOpenAI(sys, fitted, onChunk, signal)
}

/**
 * OpenAI 流式。
 *
 * 用量：流式默认**不返** usage，必须显式要 `stream_options: { include_usage: true }`。
 * 开了之后最后会多来一个分片，`choices` 是空数组、只带 `usage` —— 所以下面取 delta 的那行
 * 对它天然无害（`choices?.[0]` 是 undefined），只需额外认一下 `json.usage`。
 *
 * ⚠️ 部分 OpenAI 兼容代理不认 `stream_options`，会直接 400。
 * 这里照 client.mjs 里 `structuredFormatRejected` 的既有做法：**只在确认是这个参数被拒时**
 * 摘掉它重试一次；是 key 无效之类的 400 照常抛。
 * 无脑重试会把真错误藏起来，而完全不带这个参数则等于永远记不到流式的 token。
 */
async function streamOpenAI(system, messages, onChunk, signal) {
  let r = await postOpenAiStream(system, messages, signal, true)

  if (!r.ok) {
    const errText = await r.text()
    if (r.status === 400 && /stream_options|include_usage/i.test(errText)) {
      console.warn('[aiService] Provider 拒绝 stream_options，本次流式不统计 token')
      r = await postOpenAiStream(system, messages, signal, false)
      if (!r.ok) throw new Error(`OpenAI 流式接口 ${r.status}: ${await r.text()}`)
    } else {
      throw new Error(`OpenAI 流式接口 ${r.status}: ${errText}`)
    }
  }

  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  const lines = createLineBuffer()
  let fullText = ''
  let usage = null

  /** 处理一行。抽出来是为了让流末尾的 flush 走同一条路，不用把逻辑写两遍 */
  const handleLine = (line) => {
    if (!line.startsWith('data: ')) return
    const data = line.slice(6).trim()
    if (data === '[DONE]') return
    try {
      const json = JSON.parse(data)
      // include_usage 的用量分片：choices 为空数组，只有 usage
      if (json.usage) usage = json.usage
      const delta = json.choices?.[0]?.delta?.content || ''
      if (delta) {
        fullText += delta
        onChunk(delta)
      }
    } catch {
      /*
       * 走到这里说明这一行**本身**就不是合法 JSON，不再是「被分片切断」了
       * —— 那种情况已经由 createLineBuffer 兜住。保留 catch 是为了
       * provider 偶尔混进非 JSON 的心跳/注释行时不中断整条流。
       */
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    // decoder 复用同一个实例挡字节边界，lines 挡行边界 —— 两层都要，少一层都会丢内容
    for (const line of lines.push(decoder.decode(value, { stream: true }))) {
      handleLine(line)
    }
  }
  // 最后一行可能没有换行符收尾
  for (const line of lines.flush()) handleLine(line)

  reportUsage(usage)
  return fullText
}

function postOpenAiStream(system, messages, signal, includeUsage) {
  const body = {
    model: MODEL,
    temperature: 0.8,
    stream: true,
    messages: [{ role: 'system', content: system }, ...messages],
  }
  if (includeUsage) body.stream_options = { include_usage: true }

  return fetch(CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(body),
    signal,
  })
}

/**
 * Anthropic 流式。
 *
 * 用量分两个事件给：
 *   - `message_start` → `message.usage.input_tokens`（含缓存读写字段），只来一次
 *   - `message_delta` → `usage.output_tokens`，**报的是累计值**，可能来多次
 * 所以 output 要「取最后一次」而不是累加，最后合成一份再上报。
 */
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
  const lines = createLineBuffer()
  let fullText = ''
  let startUsage = null
  let latestOutput

  const handleLine = (line) => {
    if (!line.startsWith('data: ')) return
    const data = line.slice(6).trim()
    try {
      const json = JSON.parse(data)
      if (json.type === 'content_block_delta' && json.delta?.text) {
        fullText += json.delta.text
        onChunk(json.delta.text)
      } else if (json.type === 'message_start' && json.message?.usage) {
        startUsage = json.message.usage
      } else if (json.type === 'message_delta' && typeof json.usage?.output_tokens === 'number') {
        latestOutput = json.usage.output_tokens
      }
    } catch {
      // 同 streamOpenAI：分片切断已由 createLineBuffer 兜住，这里只兜非 JSON 行
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    for (const line of lines.push(decoder.decode(value, { stream: true }))) {
      handleLine(line)
    }
  }
  for (const line of lines.flush()) handleLine(line)

  if (startUsage) {
    reportUsage({ ...startUsage, output_tokens: latestOutput ?? startUsage.output_tokens })
  }
  return fullText
}
