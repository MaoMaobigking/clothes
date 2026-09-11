/**
 * 流式 Markdown 的「补全未闭合结构」—— 纯函数，不渲染、不碰 DOM。
 *
 * ⚠️ **本模块目前没有调用点，是提前备好的地基，不是正在生效的功能。**
 * 原因：聊天气泡现在是**纯文本渲染**（`white-space: pre-wrap` 直接输出 content），
 * 全项目没有任何 Markdown 渲染器（无 marked / markdown-it，也没用 `<rich-text>`）。
 * 没有渲染这一步，也就没有「渲染前预处理」这个插入点。
 * 要接上它，得先给气泡做一个跨端的 Markdown 渲染器（小程序侧只能走 `<rich-text>`），
 * 那是独立的一块工作量。**在那之前，不要对外说「做了流式 Markdown 容错」。**
 *
 * ── 问题（接上渲染器之后才会遇到） ──
 * 流式输出时，任何一个瞬间拿到的 Markdown 都是**截断的半成品**：
 *
 *     渲染到第 3 帧：  这套搭配很适合你：\n\n```js
 *     渲染到第 5 帧：  这套搭配很适合你：\n\n```js\nconst a =
 *     渲染到第 9 帧：  这套搭配很适合你：\n\n```js\nconst a = 1\n```
 *
 * 第 3、5 帧那个 ``` 是**没闭合的代码围栏**。绝大多数 Markdown 解析器遇到
 * 未闭合围栏会把「后面所有内容」都当成代码块的一部分 —— 于是用户看到的是：
 * 正文突然整段变成灰底等宽字，等最后一帧来了又唰地变回去。
 *
 * 加粗、行内代码、链接同理：`**很适合` 会在下一帧变成 `**很适合你**`，
 * 中间这几帧要么不加粗要么把后面的正文全吃进去，**整段文字在闪**。
 *
 * ── 做法 ──
 * 渲染前先补全：给未闭合的结构补上收尾标记，**只补在副本上，不改原文**。
 * 下一帧真正的收尾来了，补的那个自然被替换掉。
 *
 * ── 为什么不用「渲染完再说」 ──
 * 那就等于放弃流式了：用户要盯着转圈等全文，逐字输出的意义没了。
 *
 * ── 边界 ──
 * 这不是一个 Markdown 解析器，是**渲染前的一道预处理**。
 * 它只认最常见、也最容易出问题的那几种结构，不做嵌套校验、不做 AST。
 * 表格、引用块、列表本身不需要补 —— 它们是行级结构，截断了最多少半行，
 * 不会像围栏那样「污染后面的全部内容」。
 */

/** 代码围栏：``` 或 ~~~ 开头的行（允许前置最多 3 个空格，规范如此） */
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/

/**
 * 补全未闭合的代码围栏。
 *
 * 围栏是**最危险**的一种：没闭合就会把后面所有内容吞成代码。
 * 判断方式是数行首的围栏标记，奇数个就说明有一个没关上。
 *
 * 注意闭合标记要用**和开启时相同的字符与长度**：
 * ``` 开的不能用 ~~~ 关，四个反引号开的要四个反引号关（规范允许更长，不允许更短）。
 */
export function closeUnclosedFence(text: string): string {
  const lines = text.split('\n')
  let openMarker: string | null = null

  for (const line of lines) {
    const m = FENCE_RE.exec(line)
    if (!m) continue
    const marker = m[1]
    if (openMarker === null) {
      openMarker = marker
    } else if (marker[0] === openMarker[0] && marker.length >= openMarker.length) {
      // 同种字符、且不短于开启标记 —— 这才算闭合
      openMarker = null
    }
  }

  if (openMarker === null) return text
  /*
   * 补一个换行再补围栏：最后一行可能停在代码中间（`const a =`），
   * 直接接 ``` 会变成 `const a =```，那一行代码就毁了。
   */
  return `${text}${text.endsWith('\n') ? '' : '\n'}${openMarker}`
}

/**
 * 成对的行内标记。顺序重要：**先长后短**。
 *
 * 先数 `*` 的话，`**粗体**` 里的每个 `**` 会被当成两个 `*`，
 * 于是永远「配对」，真正的未闭合反而查不出来。
 */
const INLINE_PAIRS = ['```', '***', '**', '~~', '`', '*', '_'] as const

/**
 * 补全未闭合的行内标记（加粗、斜体、删除线、行内代码）。
 *
 * 只在**代码围栏之外**处理 —— 代码块里的 `*` 是内容不是语法，
 * 给它补一个配对会把代码改错。
 */
export function closeUnclosedInline(text: string): string {
  // 把围栏内的内容整段挖掉再数，避免代码里的星号干扰计数
  const segments = splitByFence(text)
  let suffix = ''

  for (const seg of segments) {
    if (seg.inFence) continue
    let rest = seg.text
    // 逐种标记数出现次数；奇数个就补一个
    for (const marker of INLINE_PAIRS) {
      const count = countOccurrences(rest, marker)
      if (count % 2 === 1) suffix = marker + suffix
      // 数完一种就把它从副本里去掉，免得 ** 被后面的 * 重复统计
      rest = rest.split(marker).join('')
    }
  }

  return suffix ? text + suffix : text
}

/** 把文本按代码围栏切成「围栏内 / 围栏外」的片段 */
function splitByFence(text: string): { text: string; inFence: boolean }[] {
  const out: { text: string; inFence: boolean }[] = []
  let openMarker: string | null = null
  let buf: string[] = []

  const flush = (inFence: boolean) => {
    if (buf.length) out.push({ text: buf.join('\n'), inFence })
    buf = []
  }

  for (const line of text.split('\n')) {
    const m = FENCE_RE.exec(line)
    if (m) {
      const marker = m[1]
      if (openMarker === null) {
        flush(false)
        openMarker = marker
        continue
      }
      if (marker[0] === openMarker[0] && marker.length >= openMarker.length) {
        flush(true)
        openMarker = null
        continue
      }
    }
    buf.push(line)
  }
  flush(openMarker !== null)
  return out
}

function countOccurrences(text: string, marker: string): number {
  if (!marker) return 0
  return text.split(marker).length - 1
}

/**
 * 流式 Markdown 的渲染前预处理：先补围栏，再补行内标记。
 *
 * 顺序不能反 —— 补行内标记时要先知道哪些区域是代码块，而那取决于围栏补没补。
 *
 * @example
 * safeStreamingMarkdown('看这段：\n```js\nconst a =')
 * // → '看这段：\n```js\nconst a =\n```'
 */
export function safeStreamingMarkdown(text: string): string {
  if (!text) return ''
  return closeUnclosedInline(closeUnclosedFence(text))
}
