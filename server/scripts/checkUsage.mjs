/**
 * 验收：AI 调用的 token 用量真的落到 ai_logs 了吗
 *
 * 跑：npm run check:usage
 *
 * 背景：`ai_logs` 表和 `prompt_tokens` / `completion_tokens` 两列早就在，
 * 但底层调用从不透出 provider 的 usage，所以那两列长期固定是 0 ——
 * 「我做了 token 成本统计」这句话当时是不能说的（见 docs/后端踩坑/能力矩阵与待办.md）。
 * 这个脚本就是那句话的验收条件。
 *
 * ⚠️ 断言针对**行为**不针对**数值**：只断言「token > 0」「往返次数 ≥ N」，
 * 不断言具体数字。踩过的坑见 docs/后端踩坑/AI与RAG.md §2.5 ——
 * 旧的 checkAi 断言写死了 mock 里的 `25°C`，天气接真 API 之后必然假失败。
 *
 * ⚠️ 会真的调模型，花真钱（DeepSeek 很便宜，一轮几分之一分钱）。
 */
import { getAiRuntime, aiChat, aiChatStream, aiChatWithTools, withAiLog } from '../services/ai/index.mjs'
import { normalizeUsage, createUsageScope, reportUsage } from '../services/ai/telemetry/usage.mjs'
import { getAll, closeDb } from '../db/mysql.mjs'

let failed = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` —— ${detail}` : ''}`)
  if (!ok) failed++
}

/* ============ 一、纯逻辑：不用网络也能验的部分 ============ */

function checkNormalizer() {
  console.log('\n── 用量归一化 ──')

  const openai = normalizeUsage({
    prompt_tokens: 100,
    completion_tokens: 20,
    prompt_cache_hit_tokens: 64,
  })
  check(
    'OpenAI/DeepSeek 命名可归一',
    openai?.promptTokens === 100 && openai?.completionTokens === 20 && openai?.cacheHitTokens === 64,
    JSON.stringify(openai),
  )

  const anthropic = normalizeUsage({
    input_tokens: 200,
    output_tokens: 30,
    cache_read_input_tokens: 128,
    cache_creation_input_tokens: 8,
  })
  check(
    'Anthropic 命名可归一',
    anthropic?.promptTokens === 200 &&
      anthropic?.completionTokens === 30 &&
      anthropic?.cacheHitTokens === 128 &&
      anthropic?.cacheWriteTokens === 8,
    JSON.stringify(anthropic),
  )

  // 关键：不是 usage 对象时必须返 null，而不是一行全 0 的假数据
  check('非 usage 对象返回 null（不记假 0）', normalizeUsage({ foo: 1 }) === null && normalizeUsage(null) === null)
}

async function checkAccumulator() {
  console.log('\n── 累加器（tool-calling 多轮的关键）──')

  const scope = createUsageScope()
  await scope.run(async () => {
    reportUsage({ prompt_tokens: 10, completion_tokens: 1 })
    reportUsage({ prompt_tokens: 20, completion_tokens: 2 })
    reportUsage({ prompt_tokens: 30, completion_tokens: 3 })
  })
  check(
    '三次上报累加成总和，不是覆盖成最后一次',
    scope.usage.promptTokens === 60 && scope.usage.completionTokens === 6 && scope.usage.calls === 3,
    `prompt=${scope.usage.promptTokens} completion=${scope.usage.completionTokens} calls=${scope.usage.calls}`,
  )

  // 失败路径：抛异常之前已经花掉的 token 不能凭空消失
  const failScope = createUsageScope()
  await failScope
    .run(async () => {
      reportUsage({ prompt_tokens: 50, completion_tokens: 5 })
      throw new Error('第二轮挂了')
    })
    .catch(() => {})
  check(
    '抛异常后仍能读到已花掉的 token',
    failScope.usage.promptTokens === 50 && failScope.usage.calls === 1,
    `prompt=${failScope.usage.promptTokens}`,
  )

  // 作用域外上报必须静默跳过，不能抛
  let threw = false
  try {
    reportUsage({ prompt_tokens: 1, completion_tokens: 1 })
  } catch {
    threw = true
  }
  check('作用域外上报静默跳过（观测是旁路，不反过来要求调用方配合）', !threw)
}

/* ============ 二、真调模型：验证端到端落库 ============ */

/** 取这条 scene 最新的一行日志 */
async function latestLog(scene) {
  const rows = await getAll(
    `SELECT prompt_tokens, completion_tokens, cache_hit_tokens, cache_write_tokens,
            model_calls, latency_ms, ok
       FROM ai_logs WHERE scene = ? ORDER BY id DESC LIMIT 1`,
    [scene],
  )
  return rows[0] || null
}

async function checkNonStream() {
  console.log('\n── 普通对话（单次往返）──')
  const scene = 'check_usage_chat'
  await withAiLog({ scene }, () => aiChat([{ role: 'user', content: '用一句话说说秋天怎么穿。' }]))

  const log = await latestLog(scene)
  check('日志已落库', Boolean(log))
  if (!log) return
  check('prompt_tokens > 0', log.prompt_tokens > 0, `= ${log.prompt_tokens}`)
  check('completion_tokens > 0', log.completion_tokens > 0, `= ${log.completion_tokens}`)
  check('model_calls === 1', log.model_calls === 1, `= ${log.model_calls}`)
  console.log(`   （缓存命中 ${log.cache_hit_tokens} tok，延迟 ${log.latency_ms}ms）`)
}

async function checkStream() {
  console.log('\n── SSE 流式（要 provider 支持 stream_options）──')
  const scene = 'check_usage_stream'
  let chunks = 0
  await withAiLog({ scene }, () =>
    aiChatStream([{ role: 'user', content: '用一句话说说冬天怎么穿。' }], null, () => {
      chunks++
    }),
  )

  check('真的是分片推送（不是整段）', chunks > 1, `收到 ${chunks} 个分片`)
  const log = await latestLog(scene)
  check('日志已落库', Boolean(log))
  if (!log) return
  const got = log.prompt_tokens > 0 && log.completion_tokens > 0
  check(
    '流式也记到 token',
    got,
    got
      ? `prompt=${log.prompt_tokens} completion=${log.completion_tokens}`
      : '为 0 —— 说明该 provider 拒绝了 stream_options（看上面的 warn 日志），是已知边界不是 bug',
  )
}

async function checkTools() {
  console.log('\n── tool-calling（多轮往返，累加器的存在理由）──')
  const scene = 'check_usage_tools'
  await withAiLog({ scene }, () =>
    aiChatWithTools([{ role: 'user', content: '北京今天天气怎么样？' }], null, { garments: [], profile: {} }),
  )

  const log = await latestLog(scene)
  check('日志已落库', Boolean(log))
  if (!log) return
  check('prompt_tokens > 0', log.prompt_tokens > 0, `= ${log.prompt_tokens}`)
  check(
    'model_calls >= 2（工具被调用意味着至少两轮）',
    log.model_calls >= 2,
    `= ${log.model_calls}${log.model_calls < 2 ? '（模型这次没调工具，重跑一次通常就有了）' : ''}`,
  )
}

/* ============ 主流程 ============ */

async function main() {
  const runtime = getAiRuntime()
  console.log(`provider=${runtime.provider} model=${runtime.model} hasKey=${runtime.hasKey}`)

  checkNormalizer()
  await checkAccumulator()

  if (!runtime.hasKey) {
    console.log('\n⚠️  没配 AI_API_KEY，跳过真调模型的三项。纯逻辑部分已验完。')
  } else {
    await checkNonStream()
    await checkStream()
    await checkTools()
  }

  console.log(`\n${failed === 0 ? '✅ 全部通过' : `❌ ${failed} 项失败`}`)
  await closeDb()
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(async (err) => {
  console.error('❌ 脚本自身出错:', err)
  await closeDb().catch(() => {})
  process.exit(1)
})
