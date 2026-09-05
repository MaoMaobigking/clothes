/**
 * DeepSeek 联通性验收
 *
 * 用法：cd server && npm run check:ai
 * 不依赖 MySQL 和 HTTP 服务，直接调用 AI 服务层。
 */
import { getAiRuntime, aiChat, aiChatStream, aiChatWithTools, generateReport } from '../services/aiService.mjs'

const runtime = getAiRuntime()
let failed = 0

function check(label, ok, extra = '') {
  console.log(`${ok ? '   ✅' : '   ❌'} ${label}${extra ? ` -- ${extra}` : ''}`)
  if (!ok) failed++
}

console.log('\n【1】运行时配置')
console.log(`   provider=${runtime.provider} model=${runtime.model}`)
console.log(`   baseUrl=${runtime.baseUrl} hasKey=${runtime.hasKey}`)
check('已配置 DeepSeek provider', runtime.provider === 'deepseek')
check('已配置 API Key', runtime.hasKey)
check('DeepSeek 使用 json_object 模式', !runtime.supportsJsonSchema)

const hardTimeout = setTimeout(() => {
  console.error('\n❌ AI 联通性检查超时，请检查网络和 DeepSeek 接口地址。')
  process.exit(1)
}, 60_000)
hardTimeout.unref()

try {
  console.log('\n【2】普通对话')
  const reply = await aiChat([{ role: 'user', content: '用一句话推荐一套夏季通勤穿搭。' }])
  check('DeepSeek 返回非空回复', typeof reply === 'string' && reply.trim().length > 0, reply.slice(0, 40))

  console.log('\n【3】结构化风格报告')
  const report = await generateReport({
    styles: ['简约通勤'],
    skin: '偏白',
    face: '圆脸',
    body: { height: 165, weight: 52 },
    preferences: { favoriteColors: '蓝色', budget: '日常' },
  })
  check(
    '风格报告来自 AI',
    report.source === 'ai' && !report.aiError,
    report.aiError ? `aiError=${report.aiError}` : `summary=${report.summary}`,
  )
  check(
    '报告结构完整',
    Array.isArray(report.radar) &&
      Array.isArray(report.recommendations) &&
      Array.isArray(report.palette) &&
      Array.isArray(report.tips),
  )

  console.log('\n【4】SSE 流式输出')
  let chunks = 0
  const streamReply = await aiChatStream([{ role: 'user', content: '请分三点介绍夏季配饰搭配。' }], null, () => {
    chunks++
  })
  check('流式接口收到多个分片', chunks > 1, `${chunks} 个分片`)
  check('流式完整内容非空', streamReply.trim().length > 0, streamReply.slice(0, 40))

  console.log('\n【5】Function Calling')
  const toolReply = await aiChatWithTools(
    [{ role: 'user', content: '北京今天天气怎么样？请先调用 get_weather 工具查询。' }],
    null,
    { garments: [], profile: { styles: ['简约'] } },
  )
  check('工具结果被模型正确消费', toolReply.includes('25°C'), toolReply.slice(0, 50))
} catch (err) {
  check('AI 调用未抛出异常', false, err.message)
}

clearTimeout(hardTimeout)
console.log(failed === 0 ? '\n🎉 DeepSeek 联通性检查全部通过\n' : `\n❌ ${failed} 项未通过\n`)
process.exitCode = failed === 0 ? 0 : 1
