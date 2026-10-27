import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

const file = process.argv[2]
if (!file) throw new Error('Usage: node scripts/summarize-performance.mjs <server-log.jsonl>')
const groups = new Map()
const seen = new Set()
for await (const line of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) {
  let record
  try {
    record = JSON.parse(line)
  } catch {
    continue
  }
  if (record.type !== 'frontend_performance' || !Array.isArray(record.events)) continue
  for (const e of record.events) {
    if (seen.has(e.id) || !Number.isFinite(e.value)) continue
    seen.add(e.id)
    const key = [e.release, e.platform, e.name, e.endpoint || e.page, e.method || '', e.sampleRate].join(' | ')
    const group = groups.get(key) || { values: [], failed: 0, abandoned: 0, total: 0 }
    group.total++
    if (e.outcome === 'abandoned') group.abandoned++
    else if (!e.ok) group.failed++
    else group.values.push(e.value)
    groups.set(key, group)
  }
}
console.table(
  [...groups].map(([group, { values, failed, abandoned, total }]) => {
    values.sort((a, b) => a - b)
    const percentile = (p) => (values.length ? values[Math.ceil(values.length * p) - 1] : null)
    return {
      group,
      samples: total,
      successSamples: values.length,
      abandoned,
      failureRate: total > abandoned ? `${((100 * failed) / (total - abandoned)).toFixed(2)}%` : 'n/a',
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
    }
  }),
)
