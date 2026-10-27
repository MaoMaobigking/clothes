import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { PerfEvent } from '../core'
vi.mock('@/utils/request', () => ({ API_BASE_URL: 'https://fixture.invalid' }))
const cloudState = vi.hoisted(() => ({ enabled: false }))
vi.mock('@/utils/cloud', () => ({
  get USE_CLOUD() {
    return cloudState.enabled
  },
  cloudRequest: vi.fn(),
}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
  vi.restoreAllMocks()
})
beforeEach(() => {
  vi.resetModules()
  cloudState.enabled = false
})
const events = [{ id: 'test-1', name: 'api_request', value: 1 }] as PerfEvent[]
it('uses an uninstrumented transport, caps timeout, and never adds auth', async () => {
  const request = vi.fn((options) => {
    options.success({ statusCode: 204 })
    return {}
  })
  vi.stubGlobal('uni', { request })
  const { sendPerformance } = await import('../transport')
  await sendPerformance(events)
  const options = request.mock.calls[0][0]
  expect(options.url).toBe('https://fixture.invalid/api/telemetry/performance')
  expect(options.timeout).toBe(5000)
  expect(options.header).toBeUndefined()
  expect(options.data.events).toBe(events)
})
it.each([400, 429, 500, 503])('rejects receiver status %i without retry', async (status) => {
  const request = vi.fn((options) => options.success({ statusCode: status }))
  vi.stubGlobal('uni', { request })
  const { sendPerformance } = await import('../transport')
  await expect(sendPerformance(events)).rejects.toThrow('Telemetry rejected')
  expect(request).toHaveBeenCalledTimes(1)
})
it('propagates transport failure to the lossy queue without UI interaction', async () => {
  const fail = { errMsg: 'request:fail timeout' }
  const request = vi.fn((options) => options.fail(fail))
  vi.stubGlobal('uni', { request })
  const { sendPerformance } = await import('../transport')
  await expect(sendPerformance(events)).rejects.toBe(fail)
})
it('cloud transfer times out locally, and late results do not cause unhandled errors', async () => {
  vi.useFakeTimers()
  const cloud = await import('@/utils/cloud')
  cloudState.enabled = true
  vi.mocked(cloud.cloudRequest).mockImplementation(
    () => new Promise((resolve) => setTimeout(() => resolve({ statusCode: 204, data: {} }), 10000)),
  )
  const { sendPerformance } = await import('../transport')
  const promise = sendPerformance(events)
  const assertion = expect(promise).rejects.toThrow('Telemetry timeout')
  await vi.advanceTimersByTimeAsync(5000)
  await assertion
  await vi.advanceTimersByTimeAsync(5000)
  expect(vi.getTimerCount()).toBe(0)
})
it('samples a deterministic 100-session grid at exactly the configured 10%', async () => {
  vi.useFakeTimers()
  vi.stubEnv('VITE_PERF_ENABLED', 'true')
  vi.stubEnv('VITE_PERF_SAMPLE_RATE', '0.1')
  let selected = 0
  for (let i = 0; i < 100; i++) {
    vi.resetModules()
    vi.spyOn(Math, 'random').mockReturnValue((i + 0.5) / 100)
    const perf = await import('../index')
    const mixin = vi.fn()
    perf.installPerformance({ mixin } as any, async () => {})
    if (mixin.mock.calls.length) selected++
    perf.pausePerf()
    vi.restoreAllMocks()
  }
  expect(selected).toBe(10)
  expect(vi.getTimerCount()).toBe(0)
})
