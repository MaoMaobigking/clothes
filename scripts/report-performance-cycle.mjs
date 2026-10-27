import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const dir = resolve('docs/perf-cycle-20261020')
const read = (name) => JSON.parse(readFileSync(resolve(dir, name), 'utf8'))
const before = read('browser-before.json'),
  after = read('browser-after.json'),
  extra = read('browser-after-extra.json')
const qb = read('queue-before.json'),
  qa = read('queue-after.json'),
  overhead = read('overhead.json'),
  receiver = read('receiver.json')
const round = (n) => Math.round(n * 100) / 100
const percentile = (values, p) => {
  const v = [...values].sort((a, b) => a - b)
  return v.length ? round(v[Math.ceil(v.length * p) - 1]) : null
}
function metric(data, mode, name) {
  const values = data.all
    .filter((r) => r.mode === mode)
    .flatMap((r) => r.records.flatMap((b) => b.events))
    .filter((e) => e.name === name && e.ok)
    .map((e) => e.value)
  return { n: values.length, p50: percentile(values, 0.5), p95: percentile(values, 0.95) }
}
const metricNames = [
  ['home', 'fcp'],
  ['home', 'page_ready'],
  ['home', 'home_data_ready'],
  ['home', 'recommendations_ready'],
  ['tryon', 'tryon_submit'],
  ['tryon', 'tryon_wait'],
  ['tryon', 'tryon_image_load'],
  ['tryon', 'tryon_result_loaded'],
]
const metrics = metricNames.map(([mode, name]) => ({
  mode,
  name,
  before: metric(before, mode, name),
  after: metric(after, mode, name),
}))
const queue = qb.results.map((b) => {
  const a = qa.results.find((r) => r.name === b.name)
  return { name: b.name, before: b, after: a }
})
const off = overhead.rows.filter((r) => !r.enabled),
  on = overhead.rows.filter((r) => r.enabled)
const paired = on.map((r) => ({ pair: r.pair, deltaFcpMs: r.fcp - off.find((v) => v.pair === r.pair).fcp }))
const overheadSummary = {
  offFcpP50: percentile(
    off.map((r) => r.fcp),
    0.5,
  ),
  onFcpP50: percentile(
    on.map((r) => r.fcp),
    0.5,
  ),
  offFcpP95: percentile(
    off.map((r) => r.fcp),
    0.95,
  ),
  onFcpP95: percentile(
    on.map((r) => r.fcp),
    0.95,
  ),
  pairedDeltaMedian: percentile(
    paired.map((r) => r.deltaFcpMs),
    0.5,
  ),
  pairedDeltaMin: Math.min(...paired.map((r) => r.deltaFcpMs)),
  pairedDeltaMax: Math.max(...paired.map((r) => r.deltaFcpMs)),
  onTelemetryBytesMedian: percentile(
    on.map((r) => r.telemetryBytes),
    0.5,
  ),
  offEvents: off.reduce((s, r) => s + r.events, 0),
  onEvents: on.reduce((s, r) => s + r.events, 0),
}
const maxError = (data) => round(Math.max(...data.all.flatMap((r) => r.timingErrorsMs || [])))
const steady = read('overhead-steady.json')
const steadyOn = steady.rows.filter((r) => r.enabled)
const steadyOff = steady.rows.filter((r) => !r.enabled)
const steadyDelta = steadyOn.map((r) => r.fcp - steadyOff.find((v) => v.pair === r.pair).fcp)
const steadySummary = {
  pairs: steadyOn.length,
  warmupPairs: steady.warmupPairs,
  onP50: percentile(
    steadyOn.map((r) => r.fcp),
    0.5,
  ),
  offP50: percentile(
    steadyOff.map((r) => r.fcp),
    0.5,
  ),
  onP95: percentile(
    steadyOn.map((r) => r.fcp),
    0.95,
  ),
  offP95: percentile(
    steadyOff.map((r) => r.fcp),
    0.95,
  ),
  pairedMedian: percentile(steadyDelta, 0.5),
  min: Math.min(...steadyDelta),
  max: Math.max(...steadyDelta),
}
const summary = {
  browser: {
    before: { passed: before.all.filter((r) => r.passed).length, total: before.all.length },
    after: { passed: after.all.filter((r) => r.passed).length, total: after.all.length },
    extra: { passed: extra.all.filter((r) => r.passed).length, total: extra.all.length },
  },
  apiTimingMaxErrorMs: { before: maxError(before), after: maxError(after) },
  metrics,
  overhead: overheadSummary,
  overheadSteady: steadySummary,
  receiver: receiver.summary,
}
writeFileSync(resolve(dir, 'summary.json'), JSON.stringify(summary, null, 2))
const q = queue.find((r) => r.name === 'sustained')
const units = queue
  .map(
    (r) =>
      `| ${r.name} | ${r.before.produced} | ${r.before.delivered} → ${r.after.delivered} | ${r.before.dropped} → ${r.after.dropped} | ${r.before.requests} → ${r.after.requests} | ${r.before.p95LagMs} → ${r.after.p95LagMs} |`,
  )
  .join('\n')
const business = metrics
  .map(
    (r) =>
      `| ${r.name} | ${r.before.n} / ${r.after.n} | ${r.before.p50} → ${r.after.p50} | ${r.before.p95} → ${r.after.p95} |`,
  )
  .join('\n')
const statuses = after.all
  .map(
    (r) =>
      `| ${r.name} | ${r.passed ? '通过' : '失败'} | ${r.mode === 'abandoned' ? '离开页面记 abandoned，不再记用户等到结果' : r.mode === 'receiver-down' ? '503 时商品仍显示，记录允许丢弃' : r.mode === 'upload' ? '真实浏览器文件选择与 multipart 上传' : r.mode === 'tryon' ? '双击仅提交一次；五阶段计时及同一 traceId' : r.mode === 'home' ? '首页指标与独立 Resource Timing 对照' : '固定业务数据或指定失败分支'} |`,
  )
  .join('\n')
const report = `# 性能埋点六步测试与优化报告

日期：2026-10-20。结论：本地六步流程已完成，发现并修复 2 个问题；最终 22/22 主浏览器场景通过，另有图片超时场景与 10 组初始及 20 组暖机后开启/关闭对照通过。**这些数据是受控测试数据，不是线上用户表现。微信真机、真实模型耗时和生产采集尚未验证。**

## 1. 数据支撑

先保存版本、源文件 SHA-256（[baseline-manifest.json](baseline-manifest.json)），再运行未优化版本。预设验收写在 [PLAN.md](PLAN.md)，没有为了让优化结果漂亮而修改输入延迟。

- 浏览器：${before.browser}，390×844，deviceScaleFactor=1；每个场景使用新的浏览器上下文，拦截所有外部请求，只访问本机。
- 主对照：每版本 10 次首页、5 次成功试衣和 7 个故障/边界场景，共 22 次。固定商品接口 120ms、推荐接口 200ms、试衣提交 150ms、每轮查询 100ms、结果图片 300ms；试衣第一次查询 RUNNING、第二次 SUCCEEDED，保留真实 2.5 秒轮询间隔。
- 队列：实际队列代码 + 虚拟时钟；发送固定耗时 50ms。虚拟时钟数据用于确定性验证吞吐/丢失，不冒充真实 CPU 或网络速度。每秒 10 条是压力场景，不代表已观测到典型用户具有此速率；队列峰值不含正在发送的批次。
- 初始浏览器采集脚本曾把挂载后的 req.path 记成 /，导致接收端故障断言误报。已改为捕获 originalUrl；初始文件保留为 browser-before-initial.json。正式 before 数据使用修正后的同一脚本。

基线问题：健康连接持续 10 条/秒时，600 条只收到 201 条；离开试衣页后，缓存页面未卸载，仍把后台结果记为用户成功等到图片。

## 2. 如何收集数据

前端源头使用 page_ready、首页数据、api_request、file_upload 及试衣 5 段埋点。浏览器实际操作包括选衣、双击试衣、离开页面、选择文件上传；不是在控制台手工捏造上报事件。

独立校验来源是浏览器 Resource Timing 与本机服务固定等待。首页 API 耗时和独立浏览器计时的最大偏差：优化前 **${maxError(before)}ms**，优化后 **${maxError(after)}ms**，满足预设 150ms 容差。

原始证据：[浏览器 before](browser-before.json)、[浏览器 after](browser-after.json)、[额外图片超时](browser-after-extra.json)、[队列 before](queue-before.json)、[队列 after](queue-after.json)。图片超时场景使用 Playwright 虚拟时钟推进 31 秒验证 30 秒截止，不能作为真实 31 秒性能样本。

## 3. 上报数据

真实链路：浏览器内存队列 → 本机 HTTP POST → 实际 createPerformanceRouter 校验 → JSON 日志。[优化前日志](events-before.jsonl) / [优化后日志](events-after.jsonl)。接收日志包含随机会话/操作标记，不包含 token、图片地址或请求正文；测试对此做了断言。

- 优化后满 20 条即发送；未满时 10 秒合批；最多缓存 100 条，单次并发 1。
- 接收端 100 批 × 20 条 = **${receiver.summary.acceptedEvents} 条全部接收**。本机往返 P50 ${round(receiver.summary.p50Ms)}ms、P95 ${round(receiver.summary.p95Ms)}ms，原始数据见 [receiver.json](receiver.json)。使用内存日志接收器，未包含生产日志持久化、公网或多实例竞争成本。
- 自动化验证了 400/429/500/503、网络失败、云函数 5 秒本地超时、32KB 限制、20 条批次限制、120 批/分钟限流。迟到的云函数结果不会触发未处理异常。
- 采样使用确定性的 100 个随机数网格，配置 10% 时恰好选中 10 个；这是阈值逻辑测试，不是声称线上每 100 人必有 10 人采样。

## 4. 衡量数据

耗时单位均为 ms。分位数用 nearest-rank；只对成功样本计算。失败率分母是成功 + 失败；abandoned 单列。故障场景是人为注入，不能拿它们的失败比例当作线上失败率。

| 负载 | 产生条数 | 送达：前 → 后 | 丢弃：前 → 后 | 请求数：前 → 后 | 上报等待 P95：前 → 后 |
| --- | ---: | ---: | ---: | ---: | ---: |
${units}

low：每秒 1 条，共 60 秒；sustained：每秒 10 条，共 60 秒；outage：每秒 1 条，前 20 秒模拟不可用；instant-overflow：同一时刻推入 500 条，故意超过有界队列容量。所有负载末尾执行相同排空步骤，表中送达包含排空后的记录。

## 5. 过程优化

只针对复现的问题修改：

1. **队列吞吐不足**：原实现每 10 秒只能发 20 条，处理能力约 2 条/秒，小于 10 条/秒的输入。改为积满 20 条即发，发送期间积累的完整批次依次排空。最大并发仍为 1、队列上限仍为 100，失败批次仍不重试。
2. **页面隐藏不等于卸载**：保留 onUnmounted，并新增 uni-app onHide 结束等待、记 abandoned。已中止的操作不再启动图片等待计时；原业务任务仍照常完成，不取消模型任务，也不改变上传/请求结果。

原因排除过程、原始失败命令见 [diagnosis.md](diagnosis.md)。队列基线源代码保留在 [baseline-code/core.ts.txt](baseline-code/core.ts.txt)。没有修改模拟 API 延迟、缩短业务轮询或改变模型参数来制造收益。

## 6. 观察数据对比

### 明确改善与代价

- 持续负载送达率：**${round(q.before.deliveryRate * 100)}% → ${round(q.after.deliveryRate * 100)}%**；丢失 **${q.before.dropped} → ${q.after.dropped}** 条。
- 上报等待 P95：**${q.before.p95LagMs} → ${q.after.p95LagMs}ms**；队列峰值 **${q.before.peakQueue} → ${q.after.peakQueue}** 条。
- 代价：发送 **${q.before.requests} → ${q.after.requests}** 次，JSON 请求正文 **${q.before.bytes} → ${q.after.bytes} 字节**。更多数据被成功发送，流量自然增加；此字节数不含 HTTP/TLS 头部。
- 低流量仍为 ${queue[0].after.requests} 次发送，送达率 100%，没有因优化变成逐条上报。
- 主浏览器验收：**${summary.browser.before.passed}/${summary.browser.before.total} → ${summary.browser.after.passed}/${summary.browser.after.total}**；原失败的离开页面场景已通过。

### 业务耗时没有被包装成优化收益

| 指标 | 成功样本：前 / 后 | P50：前 → 后 | P95：前 → 后 |
| --- | ---: | ---: | ---: |
${business}

这轮修的是监控可靠性，不是模型速度。以上小样本业务耗时差异含调度与浏览器噪声，不能据此宣称试衣或首屏提升了百分之多少。5 次试衣的 P95 实际就是最慢一次。

### 开启埋点的额外开销

用优化后代码构建 enabled / disabled 两份产物，交替 AB/BA 顺序测试 10 对新浏览器上下文，固定同一页面和接口延迟。见 [overhead.json](overhead.json)。

- FCP P50：关闭 ${overheadSummary.offFcpP50}ms，开启 ${overheadSummary.onFcpP50}ms；P95：关闭 ${overheadSummary.offFcpP95}ms，开启 ${overheadSummary.onFcpP95}ms。
- 每对“开启减关闭”的 FCP 差值中位数 ${overheadSummary.pairedDeltaMedian}ms，范围 ${overheadSummary.pairedDeltaMin} 到 ${overheadSummary.pairedDeltaMax}ms。样本小且有噪声，不能证明零开销，也不能把负数解释成开启埋点使页面变快。
- 关闭时收到事件 ${overheadSummary.offEvents} 条；开启时共 ${overheadSummary.onEvents} 条，每次页面的上报 JSON 正文字节数中位数 ${overheadSummary.onTelemetryBytesMedian} B。

首次对照中开启组存在较慢的冷启动样本，因此额外做了 2 对暖机 + 20 对正式交替测量，**保留初始结果，未用新结果覆盖旧结果**。补充数据见 [overhead-steady.json](overhead-steady.json)：开启/关闭 FCP P50 为 ${steadySummary.onP50}/${steadySummary.offP50}ms，P95 为 ${steadySummary.onP95}/${steadySummary.offP95}ms；配对差值中位数 ${steadySummary.pairedMedian}ms，范围 ${steadySummary.min} 到 ${steadySummary.max}ms。本机暖机条件下未观测到稳定首屏回退，不能外推为低端真机零成本。

### 最终场景验收

| 场景 | 结果 | 验收内容 |
| --- | --- | --- |
${statuses}

额外图片超时场景：${extra.all[0].passed ? '通过' : '失败'}。前端测试 17 项、后端 HTTP 测试 3 项通过；类型检查、H5 和微信小程序构建通过。本轮修改文件 ESLint 无错误/警告，git diff --check 通过。

### 仍然存在的边界

- 同时产生 500 条仍丢弃 ${queue.find((r) => r.name === 'instant-overflow').after.dropped} 条；断网测试仍按约定丢弃 ${queue.find((r) => r.name === 'outage').after.dropped} 条。后台关闭/退出前送达不能保证，本版不持久化重试。不能称为零丢失监控。
- 全实例 120 批/分钟的保护阈值未做多实例生产容量验证；持续高流量或更多用户仍可能收到 429。
- 本轮未测微信真机、真实云函数往返、真实 AI 模型、生产日志持久化，也没有进行线上发布或开启正式采集。
- 当前没有 LCP/INP/CLS 在线采集、SSE 和独立云存储上传的完整覆盖；page_ready 不是首屏所有内容可见时间，图片 load 不代表淡入动画结束。

## 复现入口

在源码根目录运行（构建变量与上报说明见 ../performance-instrumentation.md）：

- 队列：PERF_CYCLE_PHASE=after 配合 npm --prefix miniapp run test -- src/utils/performance/__tests__（PowerShell 用 $env:PERF_CYCLE_PHASE='after' 设置）。
- 后端：node --test server/services/performance/__tests__/performance.test.mjs
- 浏览器：node scripts/performance-cycle.mjs after .tmp/perf-cycle-after/h5
- 对照：node scripts/performance-overhead.mjs（先准备 .tmp/perf-cycle-after/h5 和 .tmp/perf-cycle-off/h5 两份构建）。
- 额外超时：设置 PERF_EXTRA_SCENARIO=image-timeout，再运行 performance-cycle，phase 使用 after-extra；完成后移除该环境变量。
- 暖机对照：设置 PERF_OVERHEAD_PAIRS=20、PERF_OVERHEAD_WARMUP=2、PERF_OVERHEAD_OUTPUT=overhead-steady.json，再运行 performance-overhead；结束后移除这三个环境变量。
- 接收：node scripts/performance-receiver-benchmark.mjs
- 统计：node scripts/summarize-performance.mjs docs/perf-cycle-20261020/events-after.jsonl
- 报告：node scripts/report-performance-cycle.mjs

原始 before 产物保存在 .tmp/perf-cycle-before/h5；不要用优化后的产物覆盖它后再标作 before。
`
writeFileSync(resolve(dir, 'REPORT.md'), report)
console.log(JSON.stringify(summary, null, 2))
