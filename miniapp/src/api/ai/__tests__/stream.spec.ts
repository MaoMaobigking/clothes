import { describe, expect, it, vi } from 'vitest'
import { readChatStream } from '../stream'

const enc = new TextEncoder()

/**
 * 造一条假的响应流。
 *
 * `pieces` 逐片下发（字符串会先编码成字节，也可以直接给 Uint8Array 来精确控制刀口）；
 * `tail` 不为空时，发完所有分片后用它返回的错误终止这条流 —— 用来模拟 abort 和网络中断。
 */
function streamOf(pieces: (string | Uint8Array)[], tail?: () => Error): ReadableStream<Uint8Array> {
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i < pieces.length) {
        const p = pieces[i++]
        controller.enqueue(typeof p === 'string' ? enc.encode(p) : p)
        return
      }
      if (tail) controller.error(tail())
      else controller.close()
    },
  })
}

/** 服务端真实报文（server/routes/ai.mjs 的三段式） */
const OPEN = 'data: {"sessionId":12,"delta":"","done":false}\n\n'
const D1 = 'data: {"delta":"约会","done":false}\n\n'
const D2 = 'data: {"delta":"可以穿浅色","done":false}\n\n'
const DONE = 'data: {"sessionId":12,"delta":"","done":true,"fullText":"约会可以穿浅色"}\n\n'

function collect() {
  const deltas: string[] = []
  return { deltas, onDelta: (d: string) => deltas.push(d) }
}

describe('readChatStream · 正常完成', () => {
  it('逐片回调增量，最终返回服务端的 fullText', async () => {
    const { deltas, onDelta } = collect()
    const result = await readChatStream(streamOf([OPEN, D1, D2, DONE]), { onDelta })

    expect(deltas).toEqual(['约会', '可以穿浅色'])
    expect(result).toEqual({ text: '约会可以穿浅色', sessionId: 12, aborted: false })
  })

  it('开场事件里的 sessionId 只回调一次，后续同号不重复通知', async () => {
    const onSession = vi.fn()
    await readChatStream(streamOf([OPEN, D1, DONE]), { onDelta: () => {}, onSession })
    expect(onSession).toHaveBeenCalledTimes(1)
    expect(onSession).toHaveBeenCalledWith(12)
  })

  it('续聊时带着已有 sessionId 进来，服务端回同一个号就不再回调', async () => {
    const onSession = vi.fn()
    const result = await readChatStream(streamOf([OPEN, DONE]), { onDelta: () => {}, onSession }, { sessionId: 12 })
    expect(onSession).not.toHaveBeenCalled()
    expect(result.sessionId).toBe(12)
  })

  it('空 delta（开场和收尾那两条）不触发回调', async () => {
    const { deltas, onDelta } = collect()
    await readChatStream(streamOf([OPEN, DONE]), { onDelta })
    expect(deltas).toEqual([])
  })
})

describe('readChatStream · 畸形分片', () => {
  it('把整条报文按字节乱切，拼出来的正文一字不差', async () => {
    const bytes = enc.encode(OPEN + D1 + D2 + DONE)
    // 刀口专挑难受的位置：JSON 中间、中文中间、两个换行之间
    const cuts = [17, 46, 63, 71, 108, 140, 175]
    const pieces: Uint8Array[] = []
    let prev = 0
    for (const c of [...cuts, bytes.length]) {
      pieces.push(bytes.slice(prev, c))
      prev = c
    }

    const { deltas, onDelta } = collect()
    const result = await readChatStream(streamOf(pieces), { onDelta })
    expect(deltas.join('')).toBe('约会可以穿浅色')
    expect(result.text).toBe('约会可以穿浅色')
  })

  it('在每一个字节位置切一刀，没有一刀会让正文出错', async () => {
    const bytes = enc.encode(OPEN + D1 + D2 + DONE)
    for (let cut = 1; cut < bytes.length; cut++) {
      const result = await readChatStream(streamOf([bytes.slice(0, cut), bytes.slice(cut)]), { onDelta: () => {} })
      expect(result.text, `切在第 ${cut} 字节`).toBe('约会可以穿浅色')
    }
  })
})

describe('readChatStream · 中途停止', () => {
  it('abort 之后不抛异常，带着已生成的部分正常返回', async () => {
    const ac = new AbortController()
    const { deltas, onDelta } = collect()

    const result = await readChatStream(
      streamOf([OPEN, D1], () => {
        // 模拟用户点停止：连接被掐断，reader.read() 抛出
        ac.abort()
        return new Error('The operation was aborted.')
      }),
      { onDelta },
      { signal: ac.signal },
    )

    expect(deltas).toEqual(['约会'])
    // 已经吐出来的字是有效内容，不该因为「停止」被当成失败清掉
    expect(result).toEqual({ text: '约会', sessionId: 12, aborted: true })
  })

  it('一个字都没来就停止，返回空文本而不是报错', async () => {
    const ac = new AbortController()
    const result = await readChatStream(
      streamOf([], () => {
        ac.abort()
        return new Error('aborted')
      }),
      { onDelta: () => {} },
      { signal: ac.signal },
    )
    expect(result).toEqual({ text: '', sessionId: undefined, aborted: true })
  })
})

describe('readChatStream · 工具调用过程事件（批次 3）', () => {
  const START =
    'data: {"step":{"type":"tool_start","round":1,"name":"list_wardrobe","args":{"limit":20}},"done":false}\n\n'
  const END =
    'data: {"step":{"type":"tool_end","round":1,"name":"list_wardrobe","summary":"共 18 件"},"done":false}\n\n'

  it('step 事件走 onStep，不混进正文', async () => {
    const steps: unknown[] = []
    const { deltas, onDelta } = collect()
    const result = await readChatStream(streamOf([OPEN, START, END, D1, DONE]), {
      onDelta,
      onStep: (s) => steps.push(s),
    })

    expect(steps).toEqual([
      { type: 'tool_start', round: 1, name: 'list_wardrobe', args: { limit: 20 } },
      { type: 'tool_end', round: 1, name: 'list_wardrobe', summary: '共 18 件' },
    ])
    // 过程事件不能污染正文
    expect(deltas).toEqual(['约会'])
    expect(result.text).toBe('约会可以穿浅色')
  })

  it('没传 onStep 时 step 事件被安静忽略，不报错', async () => {
    const result = await readChatStream(streamOf([OPEN, START, END, DONE]), { onDelta: () => {} })
    expect(result.aborted).toBe(false)
  })

  it('step 事件被切成畸形分片也能完整还原', async () => {
    const bytes = enc.encode(OPEN + START + END + DONE)
    const steps: { name?: string }[] = []
    // 刀口落在 step 的 JSON 中间
    await readChatStream(streamOf([bytes.slice(0, 90), bytes.slice(90, 160), bytes.slice(160)]), {
      onDelta: () => {},
      onStep: (s) => steps.push(s),
    })
    expect(steps.map((s) => s.name)).toEqual(['list_wardrobe', 'list_wardrobe'])
  })
})

describe('readChatStream · 异常', () => {
  it('没 abort 的流错误照常抛出，不能被当成「用户停止」吞掉', async () => {
    const ac = new AbortController()
    await expect(
      readChatStream(
        streamOf([OPEN, D1], () => new Error('网络断了')),
        { onDelta: () => {} },
        { signal: ac.signal },
      ),
    ).rejects.toThrow('网络断了')
  })

  it('服务端在 data 里报错（头已发出，只能这么报）→ 抛出该错误', async () => {
    await expect(
      readChatStream(streamOf([OPEN, 'data: {"error":"模型调用失败"}\n\n']), { onDelta: () => {} }),
    ).rejects.toThrow('模型调用失败')
  })

  it('非 JSON 的事件被跳过，不影响后面的正常事件', async () => {
    const { deltas, onDelta } = collect()
    const result = await readChatStream(streamOf([OPEN, 'data: 这不是 JSON\n\n', D1, DONE]), { onDelta })
    expect(deltas).toEqual(['约会'])
    expect(result.text).toBe('约会可以穿浅色')
  })

  it('流正常结束却没收到 done（服务端被掐断）→ 已生成的部分照样算数', async () => {
    const result = await readChatStream(streamOf([OPEN, D1, D2]), { onDelta: () => {} })
    expect(result).toEqual({ text: '约会可以穿浅色', sessionId: 12, aborted: false })
  })

  it('收到 done 后立刻返回，不再读后面的内容', async () => {
    const { deltas, onDelta } = collect()
    await readChatStream(streamOf([OPEN, D1, DONE, 'data: {"delta":"多余的"}\n\n']), { onDelta })
    expect(deltas).toEqual(['约会'])
  })
})
