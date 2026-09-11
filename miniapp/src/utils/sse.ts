/**
 * SSE 分块解析 —— 纯函数，不发请求、不碰 DOM、不认识 Vue。
 *
 * 为什么必须单独有这一层：**网络分片和 SSE 的消息边界根本不对齐。**
 * 传输层按 TCP 包 / HTTP chunk 切，协议层按「空行」切，两者毫无关系。
 * 一个分片里可能躺着两条半消息，也可能只有半条消息的一半。
 * 把 `reader.read()` 拿到的东西直接 JSON.parse，两种错法各出一次：
 *
 *   1. **字节边界断在一个字符中间** → 中文乱码。
 *      UTF-8 里「你」是 3 个字节 E4 BD A0。分片如果切在 E4 和 BD 之间，
 *      对两半分别 decode 会各得到一个替换字符，字没了且不可逆。
 *      修法是 TextDecoder 的 `stream: true`：它自己把残缺字节留到下一片再拼。
 *      —— 这一层错了连报错都没有，只是字变成乱码，最难查。
 *
 *   2. **消息边界断在一条事件中间** → JSON.parse 抛异常。
 *      `data: {"delta":"你好` 是合法的字符串、不是合法的 JSON。
 *      修法是维护缓冲区：按行喂，遇空行才派发，最后那段不完整的留着等下一片。
 *
 * 两层是独立的，各修各的：第 1 层在字节上，第 2 层在字符上。
 * 只做第 2 层，中文照样乱码（因为拼起来的已经是坏字符了）。
 *
 * 实现按 WHATWG HTML 的 server-sent events 解析算法写，而不是「按空行切一刀」——
 * 后者遇到 CRLF 结束符、多行 data、心跳注释行都会出错，而这三样服务端随时会给。
 */

/** 一条解析完成的 SSE 事件 */
export interface SseEvent {
  /** `data:` 字段。多行 data 按规范用 `\n` 连接 */
  data: string
  /** `event:` 字段。服务端没写时为 undefined（规范里等价于 `message`） */
  event?: string
  /** `id:` 字段。规范要求它**跨事件保留**，断线重连时作为 Last-Event-ID 回传 */
  id?: string
  /** `retry:` 字段，服务端建议的重连间隔（ms） */
  retry?: number
}

export interface SseParser {
  /**
   * 喂一个分片，返回这一片**凑齐了的**事件（可能 0 条，也可能多条）。
   * 传 Uint8Array 走流式解码；传 string 表示调用方已经解好码了（测试用）。
   */
  push(chunk: Uint8Array | string): SseEvent[]
  /** 还没凑齐的残片。正常收尾时应为空字符串，排查截断问题时看它 */
  readonly pending: string
}

/** NUL。写成常量是因为源码里直接敲这个字符会被各种工具链吃掉 */
const NUL = String.fromCharCode(0)

export function createSseParser(): SseParser {
  /*
   * 整条流共用**同一个** decoder 实例 —— 跨分片的半个字符就存在它内部。
   * 每次 read 都 new 一个的话 stream:true 等于没开，乱码照旧。
   */
  const decoder = typeof TextDecoder === 'function' ? new TextDecoder('utf-8') : null

  let buffer = ''

  // 下面几个是「当前这条事件」的累积状态，必须跨 push 存活
  let dataLines: string[] = []
  let eventName: string | undefined
  let retry: number | undefined
  /** 规范里 lastEventId 是**流级别**的：一条事件设了 id，后续事件继续沿用 */
  let lastEventId = ''

  function dispatch(out: SseEvent[]) {
    /*
     * 规范：data 缓冲区为空就不派发。
     * 只有 `id:` 的块、只有注释的块、连续空行，都落在这里 —— 它们不是事件。
     * 少了这一条，心跳会被当成一条 data 为空的消息推给业务层。
     */
    if (dataLines.length === 0) {
      eventName = undefined
      return
    }
    out.push({
      data: dataLines.join('\n'),
      ...(eventName !== undefined ? { event: eventName } : {}),
      ...(lastEventId ? { id: lastEventId } : {}),
      ...(retry !== undefined ? { retry } : {}),
    })
    dataLines = []
    eventName = undefined
    retry = undefined
  }

  function handleLine(line: string, out: SseEvent[]) {
    // 空行 = 一条事件结束
    if (line === '') {
      dispatch(out)
      return
    }
    /*
     * 冒号开头是注释。服务端拿它当心跳保活（也用来顶穿代理的缓冲），整行丢掉。
     * 当成 data 处理会往正文里混进空字符串。
     */
    if (line.startsWith(':')) return

    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    /*
     * 规范只允许去掉紧跟冒号的**一个**空格。
     * 写成 trimStart() 是个很隐蔽的坑：缩进的 JSON、Markdown 的列表层级、
     * 代码块里的空格全会被吃掉，而正常内容看不出问题，只有缩进场景才暴露。
     */
    if (value.startsWith(' ')) value = value.slice(1)

    switch (field) {
      case 'data':
        dataLines.push(value)
        break
      case 'event':
        eventName = value
        break
      case 'id':
        // 规范：含 NUL 的 id 直接忽略，不是置空
        if (!value.includes(NUL)) lastEventId = value
        break
      case 'retry':
        // 只认纯数字；`retry: soon` 这种要当没看见，不能变成 NaN 传下去
        if (/^\d+$/.test(value)) retry = Number(value)
        break
      default:
        // 未知字段按规范忽略
        break
    }
  }

  return {
    push(chunk) {
      if (typeof chunk === 'string') {
        buffer += chunk
      } else if (decoder) {
        // stream:true 是第 1 层边界的全部修法：残缺字节留在 decoder 内部等下一片
        buffer += decoder.decode(chunk, { stream: true })
      } else {
        throw new Error('当前环境没有 TextDecoder，无法解码字节分片')
      }

      const out: SseEvent[] = []

      /*
       * 末尾是孤立的 CR 时必须扣住不切：它可能是 CRLF 的前半截，LF 在下一个分片里。
       * 当场判成行结束，这一行会被劈成两行 —— 表现是正文里凭空多一次换行，
       * 而且**只在分片恰好落在这儿时才复现**。
       */
      const limit = buffer.endsWith('\r') ? buffer.length - 1 : buffer.length

      // 三种行结束符都要认：CRLF（服务端常见）、LF、单独的 CR
      const re = /\r\n|\n|\r/g
      let lineStart = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(buffer)) !== null) {
        if (m.index >= limit) break
        handleLine(buffer.slice(lineStart, m.index), out)
        lineStart = m.index + m[0].length
      }

      // 剩下的是没有行结束符的残片（含可能被扣住的那个 CR），留到下一片再拼
      buffer = buffer.slice(lineStart)
      return out
    },

    get pending() {
      return buffer
    },
  }
}
