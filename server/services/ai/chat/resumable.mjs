import { createHash } from 'node:crypto'

/** Bounded replay window. A missing resumed job fails explicitly rather than repeating writes. */
export function createReplayStore({ ttlMs = 300000, maxJobs = 32, maxEvents = 4096, maxBytes = 512_000 } = {}) {
  const jobs = new Map()
  function prune() {
    for (const [key, job] of jobs) if (job.finished && Date.now() - job.updated > ttlMs) jobs.delete(key)
  }
  function acquire(userId, requestId, body, resume = false) {
    prune()
    if (!/^[a-zA-Z0-9_-]{16,80}$/.test(requestId || ''))
      throw Object.assign(new Error('请求编号不合法'), { status: 400 })
    const key = `${userId}:${requestId}`
    const fingerprint = createHash('sha256').update(JSON.stringify(body)).digest('hex')
    const existing = jobs.get(key)
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw Object.assign(new Error('请求编号已用于其他内容'), { status: 409 })
      return { job: existing, fresh: false }
    }
    if (resume) throw Object.assign(new Error('续接窗口已失效，请查看会话记录后重新发送'), { status: 409 })
    if (jobs.size >= maxJobs || [...jobs.values()].filter((j) => j.userId === userId && !j.finished).length >= 2) {
      throw Object.assign(new Error('正在处理其他请求，请稍后再试'), { status: 429 })
    }
    const job = {
      userId,
      fingerprint,
      events: [],
      bytes: 0,
      listeners: new Set(),
      finished: false,
      updated: Date.now(),
      controller: new AbortController(),
    }
    job.emit = (payload) => {
      if (job.finished) return
      let event = { ...payload, sequence: job.events.length + 1 }
      const bytes = Buffer.byteLength(JSON.stringify(event))
      if (job.events.length >= maxEvents || job.bytes + bytes > maxBytes) {
        event = { sequence: event.sequence, error: '响应过长，已停止生成' }
        job.controller.abort()
      }
      job.bytes += bytes
      job.events.push(event)
      job.updated = Date.now()
      if (event.done || event.error) job.finished = true
      for (const listener of job.listeners) listener(event)
    }
    jobs.set(key, job)
    return { job, fresh: true }
  }
  return {
    acquire,
    cancel(userId, id) {
      const job = jobs.get(`${userId}:${id}`)
      if (job && !job.finished) {
        job.controller.abort()
        job.emit({ error: '已停止生成' })
      }
    },
  }
}

export function attachReplay(res, job, after = 0) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  const send = (event) => {
    if (res.destroyed || res.writableEnded) return
    res.write(`data: ${JSON.stringify(event)}\n\n`)
    if (event.done || event.error) res.end()
  }
  for (const event of job.events) if (event.sequence > after) send(event)
  if (job.finished) {
    res.end()
    return
  }
  job.listeners.add(send)
  const heartbeat = setInterval(() => {
    if (!res.destroyed) res.write(': heartbeat\n\n')
  }, 15000)
  res.on('close', () => {
    clearInterval(heartbeat)
    job.listeners.delete(send)
  })
}
