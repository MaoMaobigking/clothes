import test from 'node:test'
import assert from 'node:assert/strict'
import { readToolRound } from '../streamRound.mjs'
const enc = new TextEncoder()
const event = (data) => enc.encode(`data: ${JSON.stringify(data)}\n\n`)
test('文本在流关闭前输出，工具 JSON 跨分片完整拼接', async () => {
  let controller
  const body = new ReadableStream({
    start(c) {
      controller = c
    },
  })
  const seen = []
  let notify
  const first = new Promise((resolve) => {
    notify = resolve
  })
  const pending = readToolRound(new Response(body), (delta) => {
    seen.push(delta)
    notify()
  })
  controller.enqueue(event({ choices: [{ delta: { content: '先查衣橱' } }] }))
  await first
  assert.deepEqual(seen, ['先查衣橱'])
  controller.enqueue(
    event({
      choices: [
        { delta: { tool_calls: [{ index: 0, id: 'a', function: { name: 'get_weather', arguments: '{"city":' } }] } },
      ],
    }),
  )
  controller.enqueue(
    event({
      choices: [
        { delta: { tool_calls: [{ index: 0, function: { arguments: '"杭州"}' } }] }, finish_reason: 'tool_calls' },
      ],
    }),
  )
  controller.close()
  assert.equal((await pending).tool_calls[0].function.arguments, '{"city":"杭州"}')
})
test('Anthropic 工具块与流式文本、usage 均被保留', async () => {
  const frames = [
    { type: 'message_start', message: { usage: { input_tokens: 5 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'a', name: 'get_weather' } },
    { type: 'content_block_delta', index: 0, delta: { partial_json: '{"city":"上海"}' } },
    { type: 'content_block_delta', index: 1, delta: { text: '建议穿外套' } },
    { type: 'message_delta', usage: { output_tokens: 9 } },
    { type: 'message_stop' },
  ]
  const response = new Response(
    new ReadableStream({
      start(c) {
        for (const f of frames) c.enqueue(event(f))
        c.close()
      },
    }),
  )
  const seen = []
  const result = await readToolRound(response, (text) => seen.push(text), true)
  assert.deepEqual(seen, ['建议穿外套'])
  assert.equal(result.tool_calls[0].function.name, 'get_weather')
  assert.deepEqual(result.usage, { input_tokens: 5, output_tokens: 9 })
})
test('不完整的模型流失败，不能执行残缺工具调用', async () => {
  await assert.rejects(readToolRound(new Response(event({ choices: [{ delta: { content: '部分' } }] }))), /中断/)
})
