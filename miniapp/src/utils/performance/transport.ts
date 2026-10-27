import { API_BASE_URL } from '../request'
import { USE_CLOUD, cloudRequest } from '../cloud'
import type { PerfEvent } from './core'

/** Bypasses request() to avoid recursive telemetry and authentication redirects. */
export async function sendPerformance(events: PerfEvent[]): Promise<void> {
  const data = { events }
  const url = '/api/telemetry/performance'
  if (USE_CLOUD) {
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        cloudRequest({ url, method: 'POST', data }).then((res) => {
          if (res.statusCode >= 400) throw new Error('Telemetry rejected')
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Telemetry timeout')), 5000)
        }),
      ])
    } finally {
      if (timeout) clearTimeout(timeout)
    }
    return
  }
  await new Promise<void>((resolve, reject) => {
    uni.request({
      url: `${API_BASE_URL}${url}`,
      method: 'POST',
      data,
      timeout: 5000,
      success: (res) => (res.statusCode < 400 ? resolve() : reject(new Error('Telemetry rejected'))),
      fail: reject,
    })
  })
}
