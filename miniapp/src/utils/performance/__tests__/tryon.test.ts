import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('@/utils/request', () => ({ request: vi.fn(), publicRequest: vi.fn(), API_BASE_URL: '' }))
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_PERF_ENABLED', 'true')
  vi.stubEnv('VITE_PERF_SAMPLE_RATE', '1')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

async function setup() {
  const perf = await import('../index')
  const send = vi.fn().mockResolvedValue(undefined)
  perf.installPerformance({ mixin: vi.fn() } as any, send)
  const { request } = await import('@/utils/request')
  const { runTryon } = await import('@/api/tryon')
  return { perf, send, request: vi.mocked(request), runTryon }
}
const payload = { personImageUrl: 'https://private/person.jpg', topGarmentUrl: 'https://private/top.jpg' }
it('measures submission, polling and total with the same operation id', async () => {
  const { perf, send, request, runTryon } = await setup()
  try {
    request
      .mockResolvedValueOnce({ task: { taskId: 'task-1' } })
      .mockResolvedValueOnce({ task: { status: 'SUCCEEDED', imageUrl: 'https://private/result.jpg' } })
    await expect(runTryon(payload, undefined, 'trace-one')).resolves.toBe('https://private/result.jpg')
    await perf.flushPerf()
    const events = send.mock.calls[0][0]
    expect(events.map((e: any) => e.name)).toEqual(['tryon_submit', 'tryon_wait', 'tryon_generate'])
    expect(events.every((e: any) => e.ok && e.traceId === 'trace-one')).toBe(true)
    expect(JSON.stringify(events)).not.toContain('private')
  } finally {
    perf.pausePerf()
  }
})
it('records terminal task failure as failed wait and failed overall generation', async () => {
  const { perf, send, request, runTryon } = await setup()
  try {
    request
      .mockResolvedValueOnce({ task: { taskId: 'task-2' } })
      .mockResolvedValueOnce({ task: { status: 'FAILED', errorMessage: 'provider failed' } })
    await expect(runTryon(payload)).rejects.toThrow('provider failed')
    await perf.flushPerf()
    expect(send.mock.calls[0][0].map((e: any) => e.ok)).toEqual([true, false, false])
  } finally {
    perf.pausePerf()
  }
})
it('does not invent a polling stage if submission fails', async () => {
  const { perf, send, request, runTryon } = await setup()
  try {
    const failure = new Error('network failed')
    request.mockRejectedValueOnce(failure)
    await expect(runTryon(payload)).rejects.toBe(failure)
    await perf.flushPerf()
    expect(send.mock.calls[0][0].map((e: any) => [e.name, e.ok])).toEqual([
      ['tryon_submit', false],
      ['tryon_generate', false],
    ])
  } finally {
    perf.pausePerf()
  }
})
