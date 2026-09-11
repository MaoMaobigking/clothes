/**
 * `createLineBuffer` 的单元测试。
 *
 * 用 Node 内置的 `node:test`，**不引入任何测试框架依赖** ——
 * 后端到现在为止只有 scripts/check*.mjs 那批需要连数据库的冒烟脚本，
 * 为了一个纯函数装一整套 vitest 不划算。`node --test` 是运行时自带的。
 *
 * 跑：`npm run test -w ai-fashion-server`
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createLineBuffer } from '../sseLines.mjs'

const enc = new TextEncoder()

/** 把文本按字节切成若干片并逐片喂进去，收集所有行（模拟真实网络分片） */
function feedBytes(text, ...cuts) {
  const bytes = enc.encode(text)
  const decoder = new TextDecoder()
  const lines = createLineBuffer()
  const out = []
  let prev = 0
  for (const c of [...cuts, bytes.length]) {
    out.push(...lines.push(decoder.decode(bytes.slice(prev, c), { stream: true })))
    prev = c
  }
  out.push(...lines.flush())
  return out
}

describe('createLineBuffer · 基本切分', () => {
  it('一片里多行，全部返回', () => {
    const lines = createLineBuffer()
    assert.deepEqual(lines.push('a\nb\nc\n'), ['a', 'b', 'c'])
  })

  it('没有换行符收尾的残段留在 pending，不提前吐出', () => {
    const lines = createLineBuffer()
    assert.deepEqual(lines.push('a\nb'), ['a'])
    assert.equal(lines.pending, 'b')
  })

  it('flush 取出最后那行', () => {
    const lines = createLineBuffer()
    lines.push('a\nb')
    assert.deepEqual(lines.flush(), ['b'])
    assert.equal(lines.pending, '')
  })

  it('flush 在没有残留时返回空数组', () => {
    const lines = createLineBuffer()
    lines.push('a\n')
    assert.deepEqual(lines.flush(), [])
  })

  it('空行本身是有意义的（SSE 的事件分隔符），不能被吞掉', () => {
    const lines = createLineBuffer()
    assert.deepEqual(lines.push('a\n\nb\n'), ['a', '', 'b'])
  })
})

describe('createLineBuffer · 跨分片（这就是它存在的理由）', () => {
  it('一行被切成两半，拼回来才吐', () => {
    const lines = createLineBuffer()
    assert.deepEqual(lines.push('data: {"cho'), [])
    assert.deepEqual(lines.push('ices":[]}\n'), ['data: {"choices":[]}'])
  })

  it('原来的写法会把这一行丢掉 —— 两半都不是合法 JSON', () => {
    // 反证：证明这个 bug 真实存在，而不是我臆想的
    const half1 = 'data: {"cho'
    const half2 = 'ices":[]}\n'
    for (const half of [half1, half2]) {
      const naive = half.split('\n').filter((l) => l.startsWith('data: '))
      for (const line of naive) {
        assert.throws(() => JSON.parse(line.slice(6).trim()))
      }
    }
  })

  it('CRLF 结束符', () => {
    const lines = createLineBuffer()
    assert.deepEqual(lines.push('a\r\nb\r\n'), ['a', 'b'])
  })

  it('分片正好切在 CR 和 LF 之间，不能劈成两行', () => {
    const lines = createLineBuffer()
    // SSE 里多出一个空行 = 多出一个事件分隔符，含义完全变了
    assert.deepEqual(lines.push('a\r'), [])
    assert.deepEqual(lines.push('\nb\r\n'), ['a', 'b'])
  })
})

describe('createLineBuffer · 按真实 OpenAI 报文逐字节切', () => {
  const wire =
    'data: {"choices":[{"delta":{"content":"约会"}}]}\n\n' +
    'data: {"choices":[{"delta":{"content":"可以穿浅色"}}]}\n\n' +
    'data: [DONE]\n\n'

  /** 把行还原成正文，走和 stream.mjs 里一样的判定 */
  function textOf(lines) {
    let text = ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue
      text += JSON.parse(data).choices?.[0]?.delta?.content || ''
    }
    return text
  }

  it('一次喂完', () => {
    assert.equal(textOf(feedBytes(wire)), '约会可以穿浅色')
  })

  it('在每一个字节位置各切一刀，没有一刀会掉字或抛异常', () => {
    const total = enc.encode(wire).length
    for (let cut = 1; cut < total; cut++) {
      assert.equal(textOf(feedBytes(wire, cut)), '约会可以穿浅色', `切在第 ${cut} 字节`)
    }
  })

  it('中文被从字节中间切开也不乱码（decoder 的 stream:true 那一层）', () => {
    // 「约」的 3 个字节里切一刀
    const idx = enc.encode('data: {"choices":[{"delta":{"content":"').length + 1
    assert.equal(textOf(feedBytes(wire, idx)), '约会可以穿浅色')
  })
})
