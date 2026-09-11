import { describe, expect, it } from 'vitest'
import { createSseParser } from '../sse'

const enc = new TextEncoder()

/** 把一段文本按**字节**切成若干片，模拟网络分片 */
function sliceBytes(text: string, ...cuts: number[]): Uint8Array[] {
  const bytes = enc.encode(text)
  const out: Uint8Array[] = []
  let prev = 0
  for (const c of [...cuts, bytes.length]) {
    out.push(bytes.slice(prev, c))
    prev = c
  }
  return out
}

/** 喂完所有分片，收集全部事件 */
function feed(chunks: (Uint8Array | string)[]) {
  const p = createSseParser()
  const events = chunks.flatMap((c) => p.push(c))
  return { events, pending: p.pending }
}

describe('createSseParser · 消息边界（分片与事件不对齐）', () => {
  it('一个分片里挤了两条完整事件 → 一次返回两条', () => {
    const { events } = feed(['data: a\n\ndata: b\n\n'])
    expect(events.map((e) => e.data)).toEqual(['a', 'b'])
  })

  it('一条事件被切成两半 → 前半片返回 0 条，后半片才凑齐', () => {
    const p = createSseParser()
    expect(p.push('data: {"delta":"你')).toEqual([])
    expect(p.push('好"}\n\n').map((e) => e.data)).toEqual(['{"delta":"你好"}'])
  })

  it('残片留在 pending 里，不会被当成事件吐出去', () => {
    const { events, pending } = feed(['data: 只来了一半'])
    expect(events).toEqual([])
    expect(pending).toBe('data: 只来了一半')
  })

  it('「两条半」：一片里两条完整 + 半条，半条要等下一片', () => {
    const p = createSseParser()
    expect(p.push('data: a\n\ndata: b\n\ndata: c').map((e) => e.data)).toEqual(['a', 'b'])
    expect(p.push('\n\n').map((e) => e.data)).toEqual(['c'])
  })

  it('分片恰好落在两个换行之间（最容易漏的那一刀）', () => {
    const p = createSseParser()
    expect(p.push('data: a\n')).toEqual([])
    expect(p.push('\ndata: b\n\n').map((e) => e.data)).toEqual(['a', 'b'])
  })

  it('逐字节喂完整条流，结果和一次喂完全一致', () => {
    const raw = 'event: tick\ndata: {"delta":"一字一字地来"}\nid: 7\n\ndata: 第二条\n\n'
    const perByte = feed(sliceBytes(raw, ...raw.split('').map((_, i) => i + 1)))
    const atOnce = feed([raw])
    expect(perByte.events).toEqual(atOnce.events)
    expect(perByte.events.map((e) => e.data)).toEqual(['{"delta":"一字一字地来"}', '第二条'])
  })
})

describe('createSseParser · 字节边界（UTF-8 多字节字符被切开）', () => {
  it('中文被从字节中间切开也不乱码', () => {
    // 「你好」= 6 字节，切在第 1 个字的第 2 个字节处
    const chunks = sliceBytes('data: 你好\n\n', 7)
    expect(feed(chunks).events.map((e) => e.data)).toEqual(['你好'])
  })

  it('emoji（4 字节）被切开也不乱码', () => {
    const chunks = sliceBytes('data: 🎉\n\n', 8)
    expect(feed(chunks).events.map((e) => e.data)).toEqual(['🎉'])
  })

  it('在每一个字节位置切一刀，没有任何一刀会产生替换字符', () => {
    const raw = 'data: 穿搭建议🎽来了\n\n'
    const total = enc.encode(raw).length
    for (let cut = 1; cut < total; cut++) {
      const { events } = feed(sliceBytes(raw, cut))
      expect(
        events.map((e) => e.data),
        `切在第 ${cut} 字节`,
      ).toEqual(['穿搭建议🎽来了'])
    }
  })

  it('同一个 parser 必须复用同一个 decoder —— 每片新建就会乱码', () => {
    // 这条是上面那条的反证：分别 decode 两半，得到的就是坏字符
    const [a, b] = sliceBytes('你好', 1)
    const naive = new TextDecoder().decode(a) + new TextDecoder().decode(b)
    expect(naive).not.toBe('你好')
  })
})

describe('createSseParser · 行结束符', () => {
  it('认 CRLF', () => {
    expect(feed(['data: a\r\n\r\n']).events.map((e) => e.data)).toEqual(['a'])
  })

  it('认单独的 CR', () => {
    // 末尾那个 CR 先被扣住（可能是 CRLF 的前半），下一片来了才能定性
    expect(feed(['data: a\r\r', 'x']).events.map((e) => e.data)).toEqual(['a'])
  })

  it('末尾的孤立 CR 无论下一片是 LF 还是别的，结果都一样 —— 这就是扣住它的理由', () => {
    const crlf = createSseParser()
    crlf.push('data: a\r\r')
    // 下一片是 LF：说明刚才那个 CR 是 CRLF 的前半，两者合起来算**一个**行结束符
    expect(crlf.push('\n').map((e) => e.data)).toEqual(['a'])

    const cr = createSseParser()
    cr.push('data: a\r\r')
    // 下一片不是 LF：说明刚才那个 CR 自己就是行结束符
    expect(cr.push('x').map((e) => e.data)).toEqual(['a'])
    // 两条路径给出同一个答案。当场切的话，CRLF 那条会多劈出一个空行
  })

  it('分片切在 CR 和 LF 中间时不能把一行劈成两行', () => {
    const p = createSseParser()
    // "data: a\r" 结尾的 CR 必须被扣住：它是 CRLF 的前半截
    expect(p.push('data: a\r')).toEqual([])
    expect(p.push('\n\r\n').map((e) => e.data)).toEqual(['a'])
  })

  it('切在 CR/LF 之间的多行 data 不会凭空多出换行', () => {
    const p = createSseParser()
    p.push('data: 第一行\r')
    const events = p.push('\ndata: 第二行\r\n\r\n')
    expect(events.map((e) => e.data)).toEqual(['第一行\n第二行'])
  })
})

describe('createSseParser · 字段解析', () => {
  it('多行 data 用 \\n 连接', () => {
    expect(feed(['data: 上\ndata: 下\n\n']).events[0].data).toBe('上\n下')
  })

  it('只去掉冒号后的一个空格，缩进要原样保留', () => {
    expect(feed(['data:   三个空格\n\n']).events[0].data).toBe('  三个空格')
  })

  it('没有冒号的行按空值处理（`data` 等价于 `data:`）', () => {
    expect(feed(['data\n\n']).events[0].data).toBe('')
  })

  it('冒号开头的心跳注释被整行丢掉，不产生事件', () => {
    const { events } = feed([': keep-alive\n\n:\n\ndata: 正文\n\n'])
    expect(events.map((e) => e.data)).toEqual(['正文'])
  })

  it('读出 event 名', () => {
    expect(feed(['event: done\ndata: {}\n\n']).events[0].event).toBe('done')
  })

  it('event 名不跨事件残留', () => {
    const { events } = feed(['event: tick\ndata: a\n\ndata: b\n\n'])
    expect(events[0].event).toBe('tick')
    expect(events[1].event).toBeUndefined()
  })

  it('id 跨事件保留（规范如此，断线重连要靠它）', () => {
    const { events } = feed(['id: 1\ndata: a\n\ndata: b\n\n'])
    expect(events.map((e) => e.id)).toEqual(['1', '1'])
  })

  it('只有 id、没有 data 的块不派发事件', () => {
    expect(feed(['id: 9\n\n']).events).toEqual([])
  })

  it('连续空行不会派发空事件', () => {
    expect(feed(['\n\n\n\n']).events).toEqual([])
  })

  it('retry 只认纯数字，非法值不变成 NaN', () => {
    expect(feed(['retry: 3000\ndata: a\n\n']).events[0].retry).toBe(3000)
    expect(feed(['retry: soon\ndata: a\n\n']).events[0].retry).toBeUndefined()
  })

  it('未知字段按规范忽略，不影响同一块里的 data', () => {
    expect(feed(['foo: bar\ndata: a\n\n']).events[0].data).toBe('a')
  })
})

describe('createSseParser · 按本项目服务端的真实报文', () => {
  // server/routes/ai.mjs：先推 sessionId，再逐 delta，最后 done + fullText
  const wire =
    'data: {"sessionId":12,"delta":"","done":false}\n\n' +
    'data: {"delta":"约会","done":false}\n\n' +
    'data: {"delta":"可以穿","done":false}\n\n' +
    'data: {"sessionId":12,"delta":"","done":true,"fullText":"约会可以穿"}\n\n'

  it('整条报文解析出 4 条事件，JSON 全部可解', () => {
    const { events, pending } = feed([wire])
    expect(events).toHaveLength(4)
    expect(events.map((e) => JSON.parse(e.data).delta)).toEqual(['', '约会', '可以穿', ''])
    expect(pending).toBe('')
  })

  it('把报文切成畸形分片，拼出来的正文仍然一字不差', () => {
    // 刀口专挑难受的位置：JSON 中间、中文中间、两个换行之间
    const chunks = sliceBytes(wire, 20, 61, 75, 90, 130, 160)
    const { events, pending } = feed(chunks)
    const text = events.map((e) => JSON.parse(e.data).delta as string).join('')
    expect(text).toBe('约会可以穿')
    expect(pending).toBe('')
  })
})
