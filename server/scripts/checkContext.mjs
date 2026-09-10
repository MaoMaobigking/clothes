/**
 * 验收：上下文控制三层 + append-only + 偏好记忆
 *
 * 跑：npm run check:context
 *
 * 对应《AI Agent 3周补齐计划》第 2 周 12–14 天。三件事：
 *   1. 上下文压进预算（对应官方 clear_tool_uses / compact 的手写等价物）
 *   2. agent 循环只追加不改写（2026-08-31 起改写历史在新账号上会被 400）
 *   3. remember_preference 跨会话记忆（对应官方 memory tool）
 *
 * ⚠️ 断言针对**行为**不针对**数值**（踩坑记录 §2.5）。
 * ⚠️ 后半段会真调模型，花真钱（DeepSeek 很便宜）。
 */
import { getAiRuntime, aiChatWithTools, withAiLog } from '../services/ai/index.mjs'
import { fitContext, clearOldToolResults, slideWindow, estimateTokens, totalTokens } from '../services/ai/context.mjs'
import { rememberPreference, getLatestProfile } from '../services/profileService.mjs'
import { updatePreferences } from '../repositories/profileRepo.mjs'
import { getAll, closeDb } from '../db/mysql.mjs'

let failed = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` —— ${detail}` : ''}`)
  if (!ok) failed++
}

/** 造一段带工具调用的长对话 */
function buildLongConversation(turns) {
  const messages = []
  for (let i = 0; i < turns; i++) {
    messages.push({ role: 'user', content: `第 ${i} 轮：帮我看看今天穿什么，我想要偏通勤一点的搭配。` })
    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: [
        { id: `call_${i}`, type: 'function', function: { name: 'get_weather', arguments: '{"city":"北京"}' } },
      ],
    })
    messages.push({
      role: 'tool',
      tool_call_id: `call_${i}`,
      content: `北京天气（实时）：☁️ 阴天，气温 20°C，当前秋季。这是第 ${i} 轮的工具结果，内容比较长，用来模拟真实的工具返回体积。`,
    })
    messages.push({ role: 'assistant', content: `第 ${i} 轮的回答：建议白衬衫配西裤，外搭一件针织开衫。` })
  }
  return messages
}

/* ============ 一、纯逻辑 ============ */

function checkEstimator() {
  console.log('\n── token 估算 ──')
  // 中文约 1 token/字，英文约 1 token/4 字符
  const cn = estimateTokens('今天天气很好')
  const en = estimateTokens('the weather is nice today')
  check('中文按字计', cn >= 5 && cn <= 8, `"今天天气很好" ≈ ${cn}`)
  check('英文按 ~4 字符计', en >= 4 && en <= 9, `25 字符 ≈ ${en}`)
  check('空值不炸', estimateTokens(null) === 0 && estimateTokens(undefined) === 0)
}

function checkClearToolResults() {
  console.log('\n── 第 2 层：清旧工具结果（对应 clear_tool_uses_20250919）──')
  const messages = buildLongConversation(6)
  const before = totalTokens(messages)
  const cleared = clearOldToolResults(messages, 2)
  const after = totalTokens(cleared)

  check('token 变少了', after < before, `${before} → ${after}`)

  // 关键：不能破坏 assistant.tool_calls 与 tool 消息的配对，否则 provider 会 400
  const toolCallIds = new Set()
  for (const m of cleared) {
    if (m.role === 'assistant' && Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) toolCallIds.add(tc.id)
    }
  }
  const orphans = cleared.filter((m) => m.role === 'tool' && !toolCallIds.has(m.tool_call_id))
  check('没有产生孤儿 tool 消息（配对没被破坏）', orphans.length === 0, `孤儿 ${orphans.length} 条`)
  check('消息条数不变（留骨架、清内容，不是直接删）', cleared.length === messages.length)

  const lastTool = [...cleared].reverse().find((m) => m.role === 'tool')
  check('最近几轮的工具结果保留了原文', !lastTool.content.includes('已清理'), lastTool.content.slice(0, 20) + '…')

  // 不改原数组
  check(
    '不修改入参数组',
    messages.some((m) => m.role === 'tool' && !m.content.includes('已清理')),
  )
}

function checkSlideWindow() {
  console.log('\n── 第 3 层：滑动窗口 ──')
  const messages = buildLongConversation(10)
  const { kept, dropped } = slideWindow(messages, 300)

  check('确实丢掉了最旧的部分', dropped.length > 0, `丢 ${dropped.length} / 共 ${messages.length}`)
  check('保留的部分在预算附近', totalTokens(kept) <= 300 || kept.length <= 6, `保留 ${totalTokens(kept)} tok`)
  check('窗口不以孤儿 tool 消息开头', kept[0]?.role !== 'tool', `首条是 ${kept[0]?.role}`)
  check('至少保留了最后一轮', kept[kept.length - 1] === messages[messages.length - 1])
}

async function checkFitContext() {
  console.log('\n── 四层合起来 ──')
  const messages = buildLongConversation(30)
  const snapshot = JSON.stringify(messages)

  // 不传 summarize：只走前三层，不花钱
  const { messages: fitted, stats } = await fitContext(messages, { budget: 1000 })

  check('总 token 压下来了', stats.finalTokens < stats.originalTokens, `${stats.originalTokens} → ${stats.finalTokens}`)
  check('压到预算以内', stats.finalTokens <= 1000 || fitted.length <= 6, `${stats.finalTokens} tok`)
  check('清工具结果这层生效了', stats.toolResultsCleared === true)
  check('⭐ 不修改入参数组（append-only 的前提）', JSON.stringify(messages) === snapshot)

  // 超大数组走硬上限
  const huge = buildLongConversation(100) // 400 条
  const { stats: hugeStats } = await fitContext(huge, { budget: 1000 })
  check('超大请求触发硬上限', hugeStats.hardCapped === true, `${hugeStats.originalCount} 条 → 截断`)
}

/* ============ 二、append-only：真调模型 ============ */

async function checkAppendOnly() {
  console.log('\n── ⭐ agent 循环不改写调用方的数组 ──')
  const messages = [{ role: 'user', content: '北京今天天气怎么样？' }]
  const snapshot = JSON.stringify(messages)

  await withAiLog({ scene: 'check_context_appendonly' }, () =>
    aiChatWithTools(messages, null, { garments: [], profile: {} }),
  )

  check(
    '⭐ aiChatWithTools 没有改写传进去的 messages',
    JSON.stringify(messages) === snapshot && messages.length === 1,
    `调用后仍是 ${messages.length} 条（旧版会被 push 成 3~4 条）`,
  )
}

/* ============ 三、偏好记忆 ============ */

async function checkPreferenceMemory() {
  console.log('\n── remember_preference（对应 memory_20250818）──')

  const rows = await getAll('SELECT user_id FROM body_profiles ORDER BY id DESC LIMIT 1')
  if (!rows.length) {
    console.log('⚠️  库里没有任何画像行，跳过。先跑 npm run seed:demo 造演示账号。')
    return
  }
  const userId = rows[0].user_id

  const before = await getLatestProfile(userId)
  const key = `检查用_${Date.now()}`
  const res = await rememberPreference(userId, key, '不穿亮色，尤其是荧光色')

  check('写入成功', res.ok === true, JSON.stringify(res))
  const after = await getLatestProfile(userId)
  check('偏好读得回来', after.preferences?.[key] === '不穿亮色，尤其是荧光色')

  // ⭐ 最关键的一条：模型能写的字段和用户能写的字段是两套权限
  check(
    '⭐ 只动了 preferences，身形数据一个字节没变',
    after.height === before.height &&
      after.weight === before.weight &&
      after.gender === before.gender &&
      JSON.stringify(after.styles) === JSON.stringify(before.styles),
    `height=${after.height} weight=${after.weight} styles=${JSON.stringify(after.styles)}`,
  )

  // 截断
  const longRes = await rememberPreference(userId, 'x'.repeat(100), 'y'.repeat(500))
  check(
    'key / value 都被截断（防 prompt injection 撑爆 JSON 列）',
    longRes.key.length <= 32 && longRes.value.length <= 200,
    `key ${longRes.key.length} / value ${longRes.value.length}`,
  )

  check('空内容被拒', (await rememberPreference(userId, '', '')).ok === false)

  // 不存在的用户 → 没有画像行 → 明确拒绝，不隐式建行
  const ghost = await rememberPreference(999999, 'k', 'v')
  check('没有画像行时明确拒绝（不隐式建行）', ghost.ok === false && ghost.reason === 'NO_PROFILE')

  // 还原：这个脚本写的是真实用户的画像，跑完要把 preferences 恢复原状，
  // 否则每跑一次就往人家档案里塞两条测试数据。
  await updatePreferences(userId, before.preferences || {})
  const restored = await getLatestProfile(userId)
  check('测试数据已还原', !(key in (restored.preferences || {})))
}

/* ============ 主流程 ============ */

async function main() {
  const runtime = getAiRuntime()
  console.log(`provider=${runtime.provider} model=${runtime.model} hasKey=${runtime.hasKey}`)

  checkEstimator()
  checkClearToolResults()
  checkSlideWindow()
  await checkFitContext()
  await checkPreferenceMemory()

  if (!runtime.hasKey) {
    console.log('\n⚠️  没配 AI_API_KEY，跳过 append-only 的真调模型验证。')
  } else {
    await checkAppendOnly()
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
