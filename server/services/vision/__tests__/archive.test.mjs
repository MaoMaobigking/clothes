import test from 'node:test'
import assert from 'node:assert/strict'
import { archiveResult } from '../archive.mjs'
test('结果转存拒绝非 provider 域名、HTTP 和伪造域名', async () => {
  for (const url of ['http://example.aliyuncs.com/a', 'https://localhost/a', 'https://aliyuncs.com.evil.test/a']) {
    await assert.rejects(archiveResult(url), /受信任/)
  }
})
