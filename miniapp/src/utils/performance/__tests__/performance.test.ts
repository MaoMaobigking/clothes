import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPerfQueue, routeKey, type PerfEvent } from '../core'

const event = (id: number) => ({ id: String(id), name: 'api_request', value: 10 }) as PerfEvent
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('bounded telemetry transport', () => {
  it('strips query strings and normalizes dynamic ids', () => {
    expect(routeKey('https://example.com/api/orders/123?token=secret#fragment')).toBe('/api/orders/:id')
    expect(routeKey('/api/tryon/123e4567-e89b-12d3-a456-426614174000')).toBe('/api/tryon/:id')
  })
  it('caps queued data during a blocked send and drains full batches sequentially', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let active = 0
    let maxActive = 0
    const send = vi.fn(async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await gate
      active--
    })
    const queue = createPerfQueue(send)
    for (let i = 0; i < 130; i++) queue.push(event(i))
    expect(queue.size).toBe(100)
    await queue.flush()
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toHaveLength(20)
    expect(send.mock.calls[0][0][0].id).toBe('0')
    release()
    await vi.waitFor(() => expect(queue.size).toBe(0))
    expect(maxActive).toBe(1)
    expect(send).toHaveBeenCalledTimes(6)
  })
  it('drops failed batches and continues with new events', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
    const queue = createPerfQueue(send)
    queue.push(event(1))
    await expect(queue.flush()).resolves.toBeUndefined()
    queue.push(event(2))
    await queue.flush()
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[1][0][0].id).toBe('2')
  })
})

describe('instrumentation preserves business behavior', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.stubEnv('VITE_PERF_ENABLED', 'true')
    vi.stubEnv('VITE_PERF_SAMPLE_RATE', '1')
    vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/home' }])
  })
  it('keeps values/errors, records once, and attributes in-flight work to the starting page', async () => {
    const perf = await import('../index')
    const send = vi.fn().mockResolvedValue(undefined)
    let mixin: any
    perf.installPerformance(
      {
        mixin: (hooks: any) => {
          mixin = hooks
        },
      } as any,
      send,
    )
    const page = {}
    mixin.onLoad.call(page)
    const finish = perf.startSpan('tryon_result_loaded')
    vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/mall/mall' }])
    mixin.onShow.call(page)
    finish()
    finish(false)
    const result = { value: 42 }
    await expect(perf.measurePerf('api_request', async () => result)).resolves.toBe(result)
    const error = Object.assign(new Error('private error content'), { statusCode: 503 })
    await expect(
      perf.measurePerf('api_request', async () => {
        throw error
      }),
    ).rejects.toBe(error)
    await perf.flushPerf()
    const batch = send.mock.calls[0][0]
    expect(batch).toHaveLength(3)
    expect(batch[0].page).toBe('pages/home/home')
    expect(batch[0].ok).toBe(true)
    expect(batch[2].status).toBe(503)
    expect(JSON.stringify(batch)).not.toContain('private error content')
    perf.pausePerf()
  })
  it('does not send anything or start a timer when disabled', async () => {
    vi.stubEnv('VITE_PERF_ENABLED', 'false')
    const perf = await import('../index')
    const send = vi.fn()
    perf.installPerformance({ mixin: vi.fn() } as any, send)
    await perf.measurePerf('api_request', async () => 1)
    await perf.flushPerf()
    expect(send).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
