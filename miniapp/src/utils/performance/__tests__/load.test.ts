import { afterEach, expect, it, vi } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPerfQueue, type PerfEvent } from '../core'

afterEach(() => vi.useRealTimers())
it('measures fixed workloads and rejects silent loss on a healthy connection', async () => {
  vi.useFakeTimers()
  const results = []
  for (const scenario of [
    { name: 'low', count: 60, interval: 1000, outageUntil: 0 },
    { name: 'sustained', count: 600, interval: 100, outageUntil: 0 },
    { name: 'outage', count: 60, interval: 1000, outageUntil: 20000 },
    { name: 'instant-overflow', count: 500, interval: 0, outageUntil: 0 },
  ]) {
    vi.setSystemTime(0)
    const delivered: { id: string; lagMs: number }[] = []
    const attempts: { at: number; count: number; bytes: number; ok: boolean }[] = []
    let active = 0,
      maxActive = 0,
      peakQueue = 0
    const queue = createPerfQueue(async (events) => {
      active++
      maxActive = Math.max(maxActive, active)
      const at = Date.now()
      await new Promise((done) => setTimeout(done, 50))
      const ok = at >= scenario.outageUntil
      attempts.push({ at, count: events.length, bytes: Buffer.byteLength(JSON.stringify({ events })), ok })
      active--
      if (!ok) throw new Error('simulated offline')
      delivered.push(...events.map((e) => ({ id: e.id, lagMs: Date.now() - e.timestamp })))
    })
    const timer = setInterval(() => void queue.flush(), 10000)
    for (let i = 0; i < scenario.count; i++) {
      if (scenario.interval) await vi.advanceTimersByTimeAsync(scenario.interval)
      queue.push({
        id: `${scenario.name}-${i}`,
        name: 'api_request',
        value: 100,
        timestamp: Date.now(),
        page: 'pages/home/home',
        platform: 'h5',
        release: 'load-test',
        sessionId: 'test',
        sampleRate: 1,
        ok: true,
        outcome: 'success',
        endpoint: '/api/mall/products',
        method: 'GET',
      } as PerfEvent)
      peakQueue = Math.max(peakQueue, queue.size)
    }
    clearInterval(timer)
    const backlogAtEnd = queue.size
    await vi.advanceTimersByTimeAsync(100)
    for (let i = 0; i < 10 && queue.size; i++) {
      const work = queue.flush()
      await vi.advanceTimersByTimeAsync(100)
      await work
    }
    const lags = delivered.map((e) => e.lagMs).sort((a, b) => a - b)
    results.push({
      ...scenario,
      produced: scenario.count,
      delivered: delivered.length,
      dropped: scenario.count - delivered.length - queue.size,
      pending: queue.size,
      peakQueue,
      backlogAtEnd,
      maxActive,
      requests: attempts.length,
      bytes: attempts.reduce((sum, a) => sum + a.bytes, 0),
      deliveryRate: delivered.length / scenario.count,
      p50LagMs: lags[Math.ceil(lags.length * 0.5) - 1],
      p95LagMs: lags[Math.ceil(lags.length * 0.95) - 1],
      attempts,
      arrivals: delivered,
    })
    expect(maxActive).toBeLessThanOrEqual(1)
    expect(attempts.every((a) => a.count <= 20)).toBe(true)
    expect(new Set(delivered.map((e) => e.id)).size).toBe(delivered.length)
    expect(peakQueue).toBeLessThanOrEqual(100)
    expect(queue.size).toBe(0)
  }
  if (process.env.PERF_CYCLE_PHASE) {
    const dir = resolve(process.cwd(), '../docs/perf-cycle-20261020')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      resolve(dir, `queue-${process.env.PERF_CYCLE_PHASE || 'current'}.json`),
      JSON.stringify(
        {
          kind: 'virtual-clock workload; wall-clock performance is not measured',
          sendLatencyMs: 50,
          results,
        },
        null,
        2,
      ),
    )
  }
  console.table(
    results.map(({ name, produced, delivered, dropped, requests, p95LagMs, peakQueue }) => ({
      name,
      produced,
      delivered,
      dropped,
      requests,
      p95LagMs,
      peakQueue,
    })),
  )
  expect(results.find((r) => r.name === 'sustained')!.deliveryRate).toBeGreaterThanOrEqual(0.99)
})
