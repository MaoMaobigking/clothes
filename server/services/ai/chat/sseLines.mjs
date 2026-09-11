/**
 * 上游 SSE 响应的按行切分 —— 纯函数，不发请求、不认识 Express。
 *
 * ── 为什么需要它 ──
 * 我们既是 SSE 的**服务端**（对小程序/H5），也是 SSE 的**客户端**（对模型 provider）。
 * 作为客户端读上游流时，和浏览器端遇到的是同一个问题：
 * **网络分片和协议的行边界不对齐。**
 *
 * 原来两处都是这么写的：
 *
 *     const chunk = decoder.decode(value, { stream: true })
 *     for (const line of chunk.split('\n')) { ... JSON.parse ... }
 *
 * `stream: true` 挡住了**字节**边界（UTF-8 半个字符），但**行**边界完全没管：
 * 一条 `data: {"choices":...}` 被切成两片时，两半各自都不是合法 JSON，
 * 于是外层的 `catch {}` 把它们**双双静默丢弃** —— 那个 token 就这么没了。
 *
 * 表现是：偶发掉字。不报错、不断流、日志里什么都没有，
 * 只有在响应比较长、或者网络抖动时才出现，而且不可复现。
 * **`catch {}` 在这里不是容错，是把 bug 藏起来。**
 *
 * ── 为什么不直接用前端那份 utils/sse.ts ──
 * 那份是完整的 SSE 事件解析器（字段、多行 data、注释、id/retry）。
 * 这里只需要「把分片拼成完整的行」——上游给什么字段由各家 provider 决定，
 * OpenAI 和 Anthropic 的判定逻辑本来就不一样，硬套一个事件模型反而绕。
 * 职责小一点，两边各自清楚。
 */

/**
 * 造一个跨分片的行缓冲。
 *
 * 用法：每个分片调一次 `push`，拿到**这一片能凑齐的完整行**；
 * 流结束后调一次 `flush`，拿到最后那行没有换行符收尾的残留。
 *
 * @example
 * const lines = createLineBuffer()
 * lines.push('data: {"a":1}\ndata: {"b')  // → ['data: {"a":1}']
 * lines.push('":2}\n')                     // → ['data: {"b":2}']
 * lines.flush()                            // → []
 */
export function createLineBuffer() {
  let buffer = ''

  return {
    /**
     * 喂一个分片，返回这一片里**已经完整**的行（不含行结束符）。
     * @param {string} text 已经解码好的文本分片
     * @returns {string[]}
     */
    push(text) {
      buffer += text
      const out = []

      /*
       * 末尾是孤立的 \r 时要扣住：它可能是 \r\n 的前半截，\n 在下一个分片里。
       * 当场按行切会把一行劈成两行 —— SSE 里那等于凭空多出一个「空行」，
       * 而空行在协议里是**事件分隔符**，含义完全变了。
       */
      const limit = buffer.endsWith('\r') ? buffer.length - 1 : buffer.length

      let lineStart = 0
      const re = /\r\n|\n|\r/g
      let m
      while ((m = re.exec(buffer)) !== null) {
        if (m.index >= limit) break
        out.push(buffer.slice(lineStart, m.index))
        lineStart = m.index + m[0].length
      }

      // 没有行结束符的残段（含可能被扣住的那个 \r）留到下一片再拼
      buffer = buffer.slice(lineStart)
      return out
    },

    /**
     * 流结束时调用，取出最后一行没有换行符收尾的内容。
     *
     * 规范上 EventSource 会丢弃不完整的尾部事件，但我们这里切的是**行**不是事件：
     * 有的 provider 最后一行 `data: [DONE]` 后面不带换行，丢了就少一行。
     * 交给调用方判断，比在这里替它决定更稳妥。
     * @returns {string[]}
     */
    flush() {
      if (!buffer) return []
      const rest = buffer
      buffer = ''
      return [rest]
    },

    /** 还没凑齐的残段，排查截断问题时看它 */
    get pending() {
      return buffer
    },
  }
}
