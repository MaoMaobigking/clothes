/**
 * 流式 Markdown：渲染前补全未闭合结构 + 转成 `<rich-text>` 节点。
 *
 * 两件事在一个文件里，因为它们是同一条流水线的两段：
 *
 *     模型吐出的半截文本 → safeStreamingMarkdown（补全）→ markdownToNodes（转节点）→ <rich-text>
 *
 * ── 为什么必须补全 ──
 * 流式输出时，任何一个瞬间拿到的 Markdown 都是**截断的半成品**：
 *
 *     渲染到第 3 帧：  这套搭配很适合你：\n\n```js
 *     渲染到第 5 帧：  这套搭配很适合你：\n\n```js\nconst a =
 *     渲染到第 9 帧：  这套搭配很适合你：\n\n```js\nconst a = 1\n```
 *
 * 第 3、5 帧那个 ``` 是**没闭合的代码围栏**。解析器遇到未闭合围栏会把
 * 「后面所有内容」都当成代码块 —— 用户看到正文突然整段变成灰底等宽字，
 * 等最后一帧来了又唰地变回去。加粗、行内代码同理：`**很适合` 在下一帧
 * 才变成 `**很适合你**`，中间这几帧**整段文字在闪**。
 *
 * 补全只作用在副本上，不改原文；下一帧真正的收尾来了，补的那个自然被替换掉。
 *
 * ── 为什么是 rich-text 而不是 v-html ──
 * `v-html` 在小程序端**根本不存在**（没有 DOM）。`<rich-text>` 是 uni-app 里
 * 唯一两端都能渲染富文本的口子。
 *
 * 而且这里传的是**节点对象数组**不是 HTML 字符串 —— 这不只是风格问题：
 * 模型输出是不可信内容，拼成 HTML 字符串再交给渲染器，就得自己做转义，
 * 漏一处就是注入。构造节点对象则**根本没有「解析 HTML」这一步**，
 * 文本永远是文本。
 *
 * ── 边界 ──
 * 这不是完整的 Markdown 实现，是「聊天回答里实际会出现的那些」：
 * 标题、粗体、斜体、删除线、行内代码、代码块、有序/无序列表、引用、分隔线。
 * **不支持**表格、图片、链接跳转（rich-text 里的 a 在小程序端点不动，
 * 渲染成普通文本反而不误导）、嵌套列表。
 */

/* ============ 第一段：补全未闭合结构 ============ */

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
      /*
       * 标记刚到、内容还没到时不补 —— 此刻补会得到 `****` 这种空配对，
       * 比原样显示 `**` 更难看，而且下一帧内容一到就没了。
       * 空配对也匹配不上渲染规则（内容部分要求至少一个非空白字符）。
       */
      if (count % 2 === 1 && !seg.text.endsWith(marker)) suffix = marker + suffix
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

/* ============ 第二段：转成 rich-text 节点 ============ */

/**
 * `<rich-text>` 的节点。形状由 uni-app / 微信定义，这里只用到其中一小部分。
 *
 * 只有 `type: 'text'` 和「元素节点」两种。元素节点的 `name` 必须是
 * rich-text 白名单里的标签，写别的会被整个丢掉（不是报错，是静默消失）。
 */
export type RichNode =
  { type: 'text'; text: string } | { name: string; attrs?: Record<string, string>; children?: RichNode[] }

const textNode = (text: string): RichNode => ({ type: 'text', text })

/**
 * 节点的内联样式。
 *
 * ── 为什么是内联而不是写在 CSS 里 ──
 * `<rich-text>` 的内容**够不到 scoped CSS**：H5 上这些节点是运行时创建的，
 * 拿不到 `data-v-xxx` 属性；小程序上它干脆是个原生组件，页面 wxss 进不去。
 * 所以样式只能跟着节点走。丑，但这是两端都成立的唯一写法。
 *
 * 只调「在聊天气泡里默认值不合适」的那几个：浏览器给 h2/p/ul 的外边距
 * 是按文档排版定的，塞进一个气泡里会把气泡撑得很空。
 */
const NODE_STYLE: Record<string, string> = {
  p: 'margin:0 0 8px',
  h1: 'font-size:1.25em;font-weight:600;margin:10px 0 6px',
  h2: 'font-size:1.15em;font-weight:600;margin:10px 0 6px',
  h3: 'font-size:1.05em;font-weight:600;margin:8px 0 4px',
  h4: 'font-weight:600;margin:8px 0 4px',
  h5: 'font-weight:600;margin:8px 0 4px',
  h6: 'font-weight:600;margin:8px 0 4px',
  ul: 'margin:4px 0 8px;padding-left:20px',
  ol: 'margin:4px 0 8px;padding-left:20px',
  li: 'margin:2px 0',
  code: 'font-family:monospace;background:rgba(0,0,0,0.06);padding:1px 4px;border-radius:3px',
  pre: 'margin:6px 0;padding:8px 10px;background:rgba(0,0,0,0.06);border-radius:6px;overflow-x:auto',
  blockquote: 'margin:6px 0;padding-left:10px;border-left:3px solid rgba(0,0,0,0.15);opacity:0.85',
  hr: 'margin:8px 0;border:none;border-top:1px solid rgba(0,0,0,0.12)',
}

const el = (name: string, children: RichNode[], attrs?: Record<string, string>): RichNode => {
  const style = NODE_STYLE[name]
  const merged = { ...(style ? { style } : {}), ...attrs }
  return {
    name,
    ...(Object.keys(merged).length ? { attrs: merged } : {}),
    children,
  }
}

/**
 * 行内标记 → 节点。
 *
 * 处理顺序就是优先级：**行内代码必须排在最前**，否则 `` `a**b` `` 里的
 * 星号会先被当成加粗吃掉 —— 代码里的符号是内容不是语法。
 *
 * 内容部分统一写成 `\S(?:[^x\n]*\S)?`，即**首尾都不能是空白**。
 * 这是 CommonMark 的 flanking 规则，少了它「算式 2 * 3 * 4」里的
 * `* 3 *` 会被当成斜体 —— 乘号变斜体是这类实现最常见的翻车点。
 */
const INLINE_RULES: { re: RegExp; tag: string }[] = [
  { re: /`([^`\n]+)`/, tag: 'code' },
  { re: /\*\*\*(\S(?:[^*\n]*\S)?)\*\*\*/, tag: 'strong-em' },
  { re: /\*\*(\S(?:[^*\n]*\S)?)\*\*/, tag: 'strong' },
  { re: /~~(\S(?:[^~\n]*\S)?)~~/, tag: 'del' },
  { re: /(?<![\w*])\*(\S(?:[^*\n]*\S)?)\*(?![\w*])/, tag: 'em' },
  { re: /(?<![\w_])_(\S(?:[^_\n]*\S)?)_(?![\w_])/, tag: 'em' },
]

/**
 * 把一行文本切成行内节点。
 *
 * 递归下降：每次找最早匹配的一条规则，左边当纯文本、中间递归、右边继续找。
 * 不用一个大正则一次性 replace —— 那样嵌套（`**粗里有 `码` **`）会错位。
 */
function parseInline(text: string): RichNode[] {
  if (!text) return []

  let best: { index: number; m: RegExpExecArray; tag: string } | null = null
  for (const { re, tag } of INLINE_RULES) {
    const m = re.exec(text)
    if (m && (best === null || m.index < best.index)) best = { index: m.index, m, tag }
  }
  if (!best) return [textNode(text)]

  const { m, tag } = best
  const before = text.slice(0, m.index)
  const after = text.slice(m.index + m[0].length)
  const inner = m[1]

  const middle: RichNode =
    tag === 'strong-em'
      ? el('strong', [el('em', parseInline(inner))])
      : tag === 'code'
        ? // 代码里的内容不再往下解析 —— 里面的 * 和 _ 是字面量
          el('code', [textNode(inner)])
        : el(tag, parseInline(inner))

  return [...parseInline(before), middle, ...parseInline(after)]
}

const HEADING_RE = /^ {0,3}(#{1,6})\s+(.*)$/
const UL_RE = /^ {0,3}[-*+]\s+(.*)$/
const OL_RE = /^ {0,3}(\d+)[.)]\s+(.*)$/
const QUOTE_RE = /^ {0,3}>\s?(.*)$/
const HR_RE = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/

/**
 * Markdown → rich-text 节点数组。
 *
 * **不负责补全** —— 调用方应当先过一遍 `safeStreamingMarkdown`，
 * 或者直接用下面的 `renderStreamingMarkdown`。
 */
export function markdownToNodes(md: string): RichNode[] {
  if (!md) return []

  const lines = md.split('\n')
  const out: RichNode[] = []
  let i = 0

  /** 连续的同类列表项要收进同一个 ul/ol，否则每项都自成一列，间距会很怪 */
  const takeList = (ordered: boolean): RichNode => {
    const items: RichNode[] = []
    const re = ordered ? OL_RE : UL_RE
    while (i < lines.length) {
      const m = re.exec(lines[i])
      if (!m) break
      items.push(el('li', parseInline(ordered ? m[2] : m[1])))
      i++
    }
    return el(ordered ? 'ol' : 'ul', items)
  }

  while (i < lines.length) {
    const line = lines[i]

    // 代码块：围栏之间的内容整段不解析
    const fence = FENCE_RE.exec(line)
    if (fence) {
      const marker = fence[1]
      i++
      const body: string[] = []
      while (i < lines.length) {
        const close = FENCE_RE.exec(lines[i])
        if (close && close[1][0] === marker[0] && close[1].length >= marker.length) {
          i++
          break
        }
        body.push(lines[i])
        i++
      }
      out.push(el('pre', [el('code', [textNode(body.join('\n'))])]))
      continue
    }

    if (HR_RE.test(line)) {
      out.push(el('hr', []))
      i++
      continue
    }

    const h = HEADING_RE.exec(line)
    if (h) {
      out.push(el(`h${h[1].length}`, parseInline(h[2])))
      i++
      continue
    }

    if (UL_RE.test(line)) {
      out.push(takeList(false))
      continue
    }
    if (OL_RE.test(line)) {
      out.push(takeList(true))
      continue
    }

    const q = QUOTE_RE.exec(line)
    if (q) {
      const body: string[] = [q[1]]
      i++
      while (i < lines.length) {
        const next = QUOTE_RE.exec(lines[i])
        if (!next) break
        body.push(next[1])
        i++
      }
      out.push(el('blockquote', parseInline(body.join(' '))))
      continue
    }

    // 空行：跳过，段落之间的间距交给 CSS，不靠空 <p> 撑
    if (line.trim() === '') {
      i++
      continue
    }

    // 普通段落：连续的非空、非结构行合成一段
    const para: string[] = [line]
    i++
    while (i < lines.length) {
      const next = lines[i]
      if (
        next.trim() === '' ||
        FENCE_RE.test(next) ||
        HEADING_RE.test(next) ||
        UL_RE.test(next) ||
        OL_RE.test(next) ||
        QUOTE_RE.test(next) ||
        HR_RE.test(next)
      ) {
        break
      }
      para.push(next)
      i++
    }
    out.push(el('p', parseInline(para.join('\n'))))
  }

  return out
}

/**
 * 流式渲染的入口：补全 → 转节点。一步到位，调用方不用记顺序。
 *
 * @example
 * renderStreamingMarkdown('**重点是')
 * // → [{ name:'p', children:[{ name:'strong', children:[{type:'text',text:'重点是'}] }] }]
 */
export function renderStreamingMarkdown(text: string): RichNode[] {
  return markdownToNodes(safeStreamingMarkdown(text))
}
