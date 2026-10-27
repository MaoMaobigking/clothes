import { createLineBuffer } from '../chat/sseLines.mjs'

/** Assemble incremental tool arguments before executing anything; text is forwarded immediately. */
export async function readToolRound(response, onChunk = () => {}, anthropic = false) {
  if (!response.ok) throw new Error(`模型接口 ${response.status}: ${(await response.text()).slice(0, 300)}`)
  if (!response.body) throw new Error('模型未返回响应流')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const lines = createLineBuffer()
  const calls = new Map()
  let content = ''
  let reasoning = ''
  let usage
  let finished = false
  function line(value) {
    if (!value.startsWith('data:')) return
    const data = value.slice(5).trim()
    if (data === '[DONE]') {
      finished = true
      return
    }
    if (!data) return
    const event = JSON.parse(data)
    if (event.error || event.type === 'error') throw new Error(event.error?.message || '模型流错误')
    if (anthropic) {
      if (event.type === 'message_start') usage = event.message?.usage
      if (event.type === 'message_delta') usage = { ...usage, ...event.usage }
      if (event.type === 'message_stop') finished = true
      if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
        const block = event.content_block
        calls.set(event.index, { id: block.id, type: 'function', function: { name: block.name, arguments: '' } })
      }
      if (event.type === 'content_block_delta') {
        if (event.delta?.text) {
          content += event.delta.text
          onChunk(event.delta.text)
        }
        if (event.delta?.partial_json) {
          const call = calls.get(event.index)
          if (!call) throw new Error('工具参数缺少起始事件')
          call.function.arguments += event.delta.partial_json
        }
      }
    } else {
      if (event.usage) usage = event.usage
      const choice = event.choices?.[0]
      if (choice?.finish_reason) finished = true
      const delta = choice?.delta
      if (delta?.content) {
        content += delta.content
        onChunk(delta.content)
      }
      if (delta?.reasoning_content) reasoning += delta.reasoning_content
      for (const part of delta?.tool_calls || []) {
        const call = calls.get(part.index) || { id: '', type: 'function', function: { name: '', arguments: '' } }
        if (part.id) call.id = part.id
        if (part.function?.name) call.function.name += part.function.name
        if (part.function?.arguments) call.function.arguments += part.function.arguments
        calls.set(part.index, call)
      }
    }
  }
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      for (const valueLine of lines.push(decoder.decode(value, { stream: true }))) line(valueLine)
    }
    for (const valueLine of lines.push(decoder.decode())) line(valueLine)
    for (const valueLine of lines.flush()) line(valueLine)
    if (!finished) throw new Error('模型响应中断，请重试')
    const tool_calls = [...calls.values()]
    for (const call of tool_calls) {
      if (!call.id || !call.function.name) throw new Error('模型工具调用不完整')
      call.function.arguments ||= '{}'
      JSON.parse(call.function.arguments)
    }
    return { content, tool_calls, reasoning_content: reasoning, usage }
  } finally {
    await reader.cancel().catch(() => {})
  }
}
