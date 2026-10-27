import type { App } from 'vue'
import { createPerfQueue, routeKey, type PerfEvent } from './core'

type Fields = Partial<Pick<PerfEvent, 'page' | 'endpoint' | 'method' | 'status' | 'traceId' | 'outcome'>>
const env = import.meta.env
const configuredRate = Number(env.VITE_PERF_SAMPLE_RATE ?? 0.1)
const sampleRate = Number.isFinite(configuredRate) ? Math.max(0, Math.min(1, configuredRate)) : 0.1
const enabled = env.VITE_PERF_ENABLED === 'true' && Math.random() < sampleRate
const sessionId = newTraceId()
let platform = 'unknown'
// #ifdef H5
platform = 'h5'
// #endif
// #ifdef MP-WEIXIN
platform = 'mp-weixin'
// #endif
let sequence = 0
let currentPage = ''
let installed = false
let timer: ReturnType<typeof setInterval> | undefined
let queue: ReturnType<typeof createPerfQueue> | undefined

export function newTraceId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function perfNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()
}

export function recordPerf(name: string, value: number, ok = true, fields: Fields = {}) {
  if (!enabled || !queue || !Number.isFinite(value) || value < 0) return
  try {
    queue.push({
      outcome: ok ? 'success' : 'error',
      ...fields,
      id: `${sessionId}-${++sequence}`,
      name,
      value: Math.round(value * 1000) / 1000,
      timestamp: Date.now(),
      page: fields.page ?? currentPage,
      platform,
      release: String(env.VITE_APP_RELEASE || 'dev').slice(0, 64),
      sessionId,
      sampleRate,
      ok,
    })
  } catch {
    /* Instrumentation must not change business behavior. */
  }
}

export function startSpan(name: string, fields: Fields = {}) {
  const start = perfNow()
  const page = currentPage
  let ended = false
  return (ok = true, extra: Fields = {}) => {
    if (ended) return
    ended = true
    recordPerf(name, perfNow() - start, ok, { page, ...fields, ...extra })
  }
}

export async function measurePerf<T>(name: string, run: () => Promise<T>, fields: Fields = {}): Promise<T> {
  const end = startSpan(name, fields)
  try {
    const result = await run()
    end()
    return result
  } catch (error) {
    end(false, { status: Number((error as { statusCode?: number })?.statusCode) || 0 })
    throw error
  }
}

export function flushPerf() {
  return queue?.flush()
}
export function pausePerf() {
  if (timer) clearInterval(timer)
  timer = undefined
  void flushPerf()
}
export function resumePerf() {
  if (enabled && queue && !timer) timer = setInterval(() => void flushPerf(), 10000)
}

export function installPerformance(app: App, send: (events: PerfEvent[]) => Promise<void>) {
  if (!enabled || installed) return
  installed = true
  queue = createPerfQueue(send)
  resumePerf()
  const starts = new WeakMap<object, { time: number; page: string }>()
  const pageRoute = () => {
    try {
      const pages = getCurrentPages()
      return routeKey(pages[pages.length - 1]?.route || '')
    } catch {
      return ''
    }
  }
  app.mixin({
    onLoad() {
      const page = pageRoute()
      currentPage = page
      starts.set(this, { time: perfNow(), page })
    },
    onShow() {
      currentPage = pageRoute()
    },
    onReady() {
      const start = starts.get(this)
      if (start) recordPerf('page_ready', perfNow() - start.time, true, { page: start.page })
      starts.delete(this)
    },
    onUnload() {
      starts.delete(this)
    },
  })
  // #ifdef H5
  // FCP is a document metric, not an SPA route's business-content-ready metric.
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            recordPerf('fcp', entry.startTime, true, { page: 'document' })
            observer.disconnect()
          }
        }
      })
      observer.observe({ type: 'paint', buffered: true })
    } catch {
      /* Older browsers: skip unsupported metrics. */
    }
  }
  if (typeof document !== 'undefined')
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') pausePerf()
      else resumePerf()
    })
  // #endif
}

export { routeKey }
