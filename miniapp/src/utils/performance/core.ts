export interface PerfEvent {
  id: string
  name: string
  value: number
  timestamp: number
  page: string
  platform: string
  release: string
  sessionId: string
  sampleRate: number
  ok: boolean
  outcome?: 'success' | 'error' | 'abandoned' | 'timeout'
  endpoint?: string
  method?: string
  status?: number
  traceId?: string
}

export function routeKey(value: string): string {
  return value
    .split(/[?#]/)[0]
    .replace(/https?:\/\/[^/]+/i, '')
    .split('/')
    .map((part) => (/^\d+$/.test(part) || /^[a-f\d-]{16,}$/i.test(part) ? ':id' : part))
    .join('/')
    .slice(0, 160)
}

/** Bounded, lossy queue: full batches flush immediately, sparse traffic uses the caller's timer. */
export function createPerfQueue(send: (events: PerfEvent[]) => Promise<void>) {
  const pending: PerfEvent[] = []
  let sending = false
  async function flush() {
    if (sending || !pending.length) return
    sending = true
    const batch = pending.splice(0, 20)
    try {
      await send(batch)
    } catch {
      /* Drop failed batch; never replay business operations or retry indefinitely. */
    } finally {
      sending = false
      // Records may arrive while the previous batch is in flight. Drain full batches
      // sequentially so a healthy transport can keep up without concurrent requests.
      if (pending.length >= 20) void flush()
    }
  }
  return {
    push(event: PerfEvent) {
      if (pending.length >= 100) pending.shift()
      pending.push(event)
      if (pending.length >= 20) void flush()
    },
    get size() {
      return pending.length
    },
    flush,
  }
}
