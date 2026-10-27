import { Router, json } from 'express'

const names = new Set([
  'page_ready',
  'recommendations_ready',
  'home_data_ready',
  'fcp',
  'api_request',
  'file_upload',
  'tryon_submit',
  'tryon_wait',
  'tryon_generate',
  'tryon_image_load',
  'tryon_result_loaded',
])
const id = /^[a-zA-Z0-9_.:-]{1,80}$/
const route = /^(?:\/?(?:pages|pages-sub)\/[a-zA-Z0-9_/-]+|document|)$/

export function normalizeEvent(e) {
  if (
    !e ||
    !names.has(e.name) ||
    !Number.isFinite(e.value) ||
    e.value < 0 ||
    e.value > 3600000 ||
    typeof e.ok !== 'boolean' ||
    !Number.isFinite(e.timestamp) ||
    Math.abs(Date.now() - e.timestamp) > 86400000 ||
    typeof e.id !== 'string' ||
    !id.test(e.id) ||
    typeof e.sessionId !== 'string' ||
    !id.test(e.sessionId) ||
    typeof e.page !== 'string' ||
    e.page.length > 160 ||
    !route.test(e.page) ||
    !['h5', 'mp-weixin'].includes(e.platform) ||
    typeof e.release !== 'string' ||
    !id.test(e.release) ||
    !Number.isFinite(e.sampleRate) ||
    e.sampleRate <= 0 ||
    e.sampleRate > 1
  )
    return null
  const result = Object.fromEntries(
    ['id', 'name', 'value', 'timestamp', 'page', 'platform', 'release', 'sessionId', 'sampleRate', 'ok'].map((key) => [
      key,
      e[key],
    ]),
  )
  if (e.outcome !== undefined) {
    if (!['success', 'error', 'abandoned', 'timeout'].includes(e.outcome) || (e.outcome === 'success') !== e.ok)
      return null
    result.outcome = e.outcome
  }
  if (e.endpoint !== undefined) {
    if (typeof e.endpoint !== 'string' || e.endpoint.length > 160 || !/^\/api\/[a-zA-Z0-9_/:.-]+$/.test(e.endpoint))
      return null
    result.endpoint = e.endpoint
  }
  if (e.method !== undefined) {
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(e.method)) return null
    result.method = e.method
  }
  if (e.status !== undefined) {
    if (!Number.isInteger(e.status) || e.status < 0 || e.status > 599) return null
    result.status = e.status
  }
  if (e.traceId !== undefined) {
    if (typeof e.traceId !== 'string' || !id.test(e.traceId)) return null
    result.traceId = e.traceId
  }
  return result
}

/** Anonymous endpoint permits login-page metrics; strictly bounded, no request bodies logged. */
export function createPerformanceRouter({ write = (record) => console.log(JSON.stringify(record)) } = {}) {
  const router = Router()
  let windowStart = Date.now()
  let batches = 0
  router.post(
    '/',
    (req, res, next) => {
      if (Date.now() - windowStart >= 60000) {
        windowStart = Date.now()
        batches = 0
      }
      if (++batches > 120) return res.status(429).end()
      next()
    },
    json({ limit: '32kb' }),
    (req, res) => {
      const events = req.body?.events
      if (!Array.isArray(events) || events.length < 1 || events.length > 20) return res.status(400).end()
      const normalized = events.map(normalizeEvent)
      if (normalized.some((event) => !event)) return res.status(400).end()
      try {
        write({ type: 'frontend_performance', receivedAt: Date.now(), events: normalized })
      } catch {
        return res.status(503).end()
      }
      res.status(204).end()
    },
  )
  return router
}
