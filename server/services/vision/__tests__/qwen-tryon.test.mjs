import test from 'node:test'
import assert from 'node:assert/strict'
process.env.DASHSCOPE_API_KEY = 'fixture-only'
const { createTask, extractImages } = await import('../bailian.mjs')

test('试衣通过 Qwen 异步接口提交人物与衣物，支持嵌套 OSS 图片', async () => {
  const original = globalThis.fetch
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, ...options, body: JSON.parse(options.body) }
    return new Response(JSON.stringify({ output: { task_id: 'fixture-task', task_status: 'PENDING' } }), {
      status: 200,
    })
  }
  try {
    const result = await createTask('tryon', {
      personImageUrl: 'oss://person',
      bottomGarmentUrl: 'https://example.com/pants.png',
    })
    assert.match(request.url, /\/image-generation\/generation$/)
    assert.equal(request.body.model, 'qwen-image-2.1-turbo')
    assert.equal(request.headers['X-DashScope-Async'], 'enable')
    assert.equal(request.headers['X-DashScope-OssResourceResolve'], 'enable')
    const content = request.body.input.messages[0].content
    assert.deepEqual(
      content.filter((c) => c.image).map((c) => c.image),
      ['oss://person', 'https://example.com/pants.png'],
    )
    assert.match(content.find((c) => c.text).text, /第2张.*下装/)
    assert.equal(request.body.parameters.n, 1)
    assert.equal(result.taskId, 'fixture-task')
  } finally {
    globalThis.fetch = original
  }
})

test('提取 Qwen 异步任务的图片，兼容历史任务结果', () => {
  assert.deepEqual(
    extractImages({ choices: [{ message: { content: [{ image: 'https://example.aliyuncs.com/result.png' }] } }] }),
    ['https://example.aliyuncs.com/result.png'],
  )
  assert.deepEqual(extractImages({ image_url: 'https://example.aliyuncs.com/old.png' }), [
    'https://example.aliyuncs.com/old.png',
  ])
})
