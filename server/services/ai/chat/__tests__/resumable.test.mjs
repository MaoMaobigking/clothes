import test from 'node:test'
import assert from 'node:assert/strict'
import { createReplayStore } from '../resumable.mjs'
const id = 'request-1234567890'
test('同一请求重连只回放，不创建新任务，且按用户隔离', () => {
  const store = createReplayStore()
  const { job, fresh } = store.acquire(1, id, { text: '搭配' })
  assert.equal(fresh, true)
  job.emit({ delta: '外套' })
  const again = store.acquire(1, id, { text: '搭配' }, true)
  assert.equal(again.fresh, false)
  assert.equal(again.job, job)
  assert.deepEqual(job.events, [{ delta: '外套', sequence: 1 }])
  assert.throws(() => store.acquire(2, id, { text: '搭配' }, true), { status: 409 })
  assert.throws(() => store.acquire(1, id, { text: '不同问题' }), { status: 409 })
})
test('取消与超长响应终止任务；拒绝未知续接，避免重复副作用', () => {
  const store = createReplayStore({ maxEvents: 1 })
  const { job } = store.acquire(1, id, {})
  job.emit({ delta: 'a' })
  job.emit({ delta: 'b' })
  assert.equal(job.finished, true)
  assert.equal(job.controller.signal.aborted, true)
  assert.throws(() => store.acquire(1, id + 'other', {}, true), { status: 409 })
  const second = store.acquire(2, id, {}).job
  store.cancel(1, id)
  assert.equal(second.finished, false)
  store.cancel(2, id)
  assert.equal(second.finished, true)
})
