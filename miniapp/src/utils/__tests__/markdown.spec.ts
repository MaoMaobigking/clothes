import { describe, expect, it } from 'vitest'
import {
  closeUnclosedFence,
  closeUnclosedInline,
  markdownToNodes,
  renderStreamingMarkdown,
  safeStreamingMarkdown,
  type RichNode,
} from '../markdown'

describe('closeUnclosedFence · 代码围栏', () => {
  it('未闭合的围栏要补上 —— 不补就会把后面所有正文吞成代码', () => {
    expect(closeUnclosedFence('看这段：\n```js\nconst a =')).toBe('看这段：\n```js\nconst a =\n```')
  })

  it('已经闭合的不动', () => {
    const done = '看这段：\n```js\nconst a = 1\n```'
    expect(closeUnclosedFence(done)).toBe(done)
  })

  it('补的围栏要另起一行 —— 直接接在代码后面会毁掉那一行', () => {
    // 'const a =```' 是错的
    expect(closeUnclosedFence('```\nconst a =')).toBe('```\nconst a =\n```')
  })

  it('原文已经以换行结尾时不再多加一个空行', () => {
    expect(closeUnclosedFence('```js\n')).toBe('```js\n```')
  })

  it('波浪号围栏同样处理，且要用同种字符闭合', () => {
    expect(closeUnclosedFence('~~~\ncode')).toBe('~~~\ncode\n~~~')
  })

  it('``` 开的不能被 ~~~ 关掉（不同字符不算闭合）', () => {
    expect(closeUnclosedFence('```\ncode\n~~~')).toBe('```\ncode\n~~~\n```')
  })

  it('四个反引号开的要四个关，三个不算', () => {
    // 规范：闭合标记不能短于开启标记
    expect(closeUnclosedFence('````\ncode\n```')).toBe('````\ncode\n```\n````')
  })

  it('闭合标记比开启长是允许的', () => {
    const t = '```\ncode\n````'
    expect(closeUnclosedFence(t)).toBe(t)
  })

  it('围栏前最多 3 个空格仍算围栏', () => {
    expect(closeUnclosedFence('   ```\ncode')).toBe('   ```\ncode\n```')
  })

  it('两段都闭合的代码块不受影响', () => {
    const t = '```\na\n```\n中间\n```\nb\n```'
    expect(closeUnclosedFence(t)).toBe(t)
  })

  it('第二段没闭合时只补一个', () => {
    expect(closeUnclosedFence('```\na\n```\n中间\n```\nb')).toBe('```\na\n```\n中间\n```\nb\n```')
  })
})

describe('closeUnclosedInline · 行内标记', () => {
  it.each([
    ['加粗', '这套**很适合', '这套**很适合**'],
    ['斜体', '这套*很适合', '这套*很适合*'],
    ['删除线', '这套~~很适合', '这套~~很适合~~'],
    ['行内代码', '用 `npm run', '用 `npm run`'],
    ['下划线斜体', '这套_很适合', '这套_很适合_'],
  ])('%s未闭合时补上', (_label, input, expected) => {
    expect(closeUnclosedInline(input)).toBe(expected)
  })

  it('已闭合的不动', () => {
    expect(closeUnclosedInline('这套**很适合**你')).toBe('这套**很适合**你')
  })

  it('先数长标记再数短的 —— 否则 ** 会被当成两个 *，永远「配对」', () => {
    // 这一条是实现里最容易写错的地方：顺序反了，下面这句会被判成已闭合
    expect(closeUnclosedInline('**粗体**加上*斜体')).toBe('**粗体**加上*斜体*')
  })

  it('代码围栏里的星号是内容不是语法，不给它补配对', () => {
    const t = '```\nconst a = 2 * 3\n```'
    expect(closeUnclosedInline(t)).toBe(t)
  })

  it('围栏里的单个反引号也不算未闭合', () => {
    const t = '```\necho `date`\n```'
    expect(closeUnclosedInline(t)).toBe(t)
  })

  it('多个不同标记同时未闭合，都要补', () => {
    const out = closeUnclosedInline('**粗和`码')
    expect(out.endsWith('`**')).toBe(true)
  })
})

describe('safeStreamingMarkdown · 端到端', () => {
  it('空串返回空串，不炸', () => {
    expect(safeStreamingMarkdown('')).toBe('')
  })

  it('纯文本原样返回', () => {
    expect(safeStreamingMarkdown('今天适合穿浅色')).toBe('今天适合穿浅色')
  })

  it('围栏和行内同时未闭合，两样都补', () => {
    const out = safeStreamingMarkdown('**注意：\n```js\nconst a =')
    expect(out).toContain('```')
    expect(out.split('```').length - 1).toBe(2) // 开和闭各一个
  })

  /*
   * 这一条是整个模块存在的理由：
   * 模拟真实的逐字流式，检查**每一帧**渲染前的文本都是结构完整的。
   * 少了预处理，中间会有大量帧带着未闭合的围栏 —— 那就是「整段闪烁」。
   */
  it('逐字喂完整段回答，每一帧的围栏都是配平的', () => {
    const full = '这套搭配不错：\n\n```js\nconst outfit = "浅色"\n```\n\n**重点**是配色。'
    for (let i = 1; i <= full.length; i++) {
      const frame = safeStreamingMarkdown(full.slice(0, i))
      const fences = (frame.match(/^ {0,3}`{3,}/gm) || []).length
      expect(fences % 2, `第 ${i} 帧围栏数应为偶数，实际 ${fences}`).toBe(0)
    }
  })

  it('逐字喂完整段回答，最后一帧和原文一致（补全不能留下残留）', () => {
    const full = '**重点**是配色，用 `#fff` 就行。'
    expect(safeStreamingMarkdown(full)).toBe(full)
  })

  it('不修改原文，只返回副本', () => {
    const src = '```js\nconst a ='
    const copy = src
    safeStreamingMarkdown(src)
    expect(src).toBe(copy)
  })
})

/* ============ markdownToNodes / renderStreamingMarkdown ============ */

/** 把节点树拍平成纯文本，用来断言「内容没丢」 */
function flatten(nodes: RichNode[]): string {
  return nodes.map((n) => ('type' in n ? n.text : flatten(n.children ?? []))).join('')
}

/** 收集树里出现过的标签名 */
function tags(nodes: RichNode[]): string[] {
  const out: string[] = []
  const walk = (ns: RichNode[]) => {
    for (const n of ns) {
      if ('name' in n) {
        out.push(n.name)
        walk(n.children ?? [])
      }
    }
  }
  walk(nodes)
  return out
}

describe('markdownToNodes · 块级', () => {
  it('普通段落', () => {
    const nodes = markdownToNodes('今天适合穿浅色')
    expect(tags(nodes)).toEqual(['p'])
    expect(flatten(nodes)).toBe('今天适合穿浅色')
  })

  it('标题按级别出 h1-h6', () => {
    expect(tags(markdownToNodes('## 搭配建议'))).toEqual(['h2'])
    expect(tags(markdownToNodes('###### 六级'))).toEqual(['h6'])
  })

  it('七个 # 不是标题，是普通段落', () => {
    expect(tags(markdownToNodes('####### 不是标题'))).toEqual(['p'])
  })

  it('连续的无序列表项收进同一个 ul', () => {
    const nodes = markdownToNodes('- 白衬衫\n- 直筒裤\n- 乐福鞋')
    expect(tags(nodes)).toEqual(['ul', 'li', 'li', 'li'])
    expect(flatten(nodes)).toBe('白衬衫直筒裤乐福鞋')
  })

  it('有序列表', () => {
    const nodes = markdownToNodes('1. 先选上衣\n2. 再配裤子')
    expect(tags(nodes)).toEqual(['ol', 'li', 'li'])
  })

  it('列表被段落打断后重新开一个 ul', () => {
    const nodes = markdownToNodes('- a\n- b\n\n中间说明\n\n- c')
    expect(tags(nodes)).toEqual(['ul', 'li', 'li', 'p', 'ul', 'li'])
  })

  it('代码块整段不解析，里面的星号是字面量', () => {
    const nodes = markdownToNodes('```js\nconst a = 2 * 3\n```')
    expect(tags(nodes)).toEqual(['pre', 'code'])
    expect(flatten(nodes)).toBe('const a = 2 * 3')
  })

  it('引用合并成一个 blockquote', () => {
    const nodes = markdownToNodes('> 第一行\n> 第二行')
    expect(tags(nodes)).toEqual(['blockquote'])
  })

  it('分隔线', () => {
    expect(tags(markdownToNodes('---'))).toEqual(['hr'])
  })

  it('空行不产生空段落', () => {
    expect(tags(markdownToNodes('a\n\n\n\nb'))).toEqual(['p', 'p'])
  })

  it('空串返回空数组', () => {
    expect(markdownToNodes('')).toEqual([])
  })
})

describe('markdownToNodes · 行内', () => {
  it.each([
    ['加粗', '**重点**', 'strong'],
    ['斜体', '*强调*', 'em'],
    ['下划线斜体', '_强调_', 'em'],
    ['删除线', '~~不要~~', 'del'],
    ['行内代码', '`npm run dev`', 'code'],
  ])('%s', (_label, md, tag) => {
    expect(tags(markdownToNodes(md))).toContain(tag)
  })

  it('粗斜体同时出 strong 和 em', () => {
    const t = tags(markdownToNodes('***都要***'))
    expect(t).toContain('strong')
    expect(t).toContain('em')
  })

  it('行内代码优先级最高 —— 代码里的星号不能被当成加粗', () => {
    const nodes = markdownToNodes('`a**b**c`')
    expect(tags(nodes)).toEqual(['p', 'code'])
    expect(flatten(nodes)).toBe('a**b**c')
  })

  it('加粗里可以嵌行内代码', () => {
    const t = tags(markdownToNodes('**先跑 `npm i`**'))
    expect(t).toContain('strong')
    expect(t).toContain('code')
  })

  it('乘号不会被误判成斜体', () => {
    // 2 * 3 * 4 中间的星号两侧都有空格和数字，不该配对
    const nodes = markdownToNodes('算式 2 * 3 * 4 的结果')
    expect(tags(nodes)).toEqual(['p'])
    expect(flatten(nodes)).toBe('算式 2 * 3 * 4 的结果')
  })

  it('snake_case 里的下划线不会被当成斜体', () => {
    const nodes = markdownToNodes('变量 some_long_name 用法')
    expect(flatten(nodes)).toBe('变量 some_long_name 用法')
    expect(tags(nodes)).toEqual(['p'])
  })

  it('内容一个字都不能丢', () => {
    const md = '**粗**普通*斜*`码`~~删~~尾巴'
    expect(flatten(markdownToNodes(md))).toBe('粗普通斜码删尾巴')
  })
})

describe('markdownToNodes · 安全性', () => {
  it('HTML 被当成纯文本，不构造成节点 —— 传的是节点对象，没有解析 HTML 这一步', () => {
    const nodes = markdownToNodes('<script>alert(1)</script>')
    expect(tags(nodes)).toEqual(['p']) // 只有段落，没有 script
    expect(flatten(nodes)).toBe('<script>alert(1)</script>')
  })

  it('尖括号原样保留在文本里', () => {
    expect(flatten(markdownToNodes('用 <view> 标签'))).toBe('用 <view> 标签')
  })
})

describe('renderStreamingMarkdown · 逐帧不崩、不闪', () => {
  const full = '## 建议\n\n这套**很适合**你：\n\n- 白衬衫\n- 直筒裤\n\n```js\nconst a = 1\n```\n\n就这样。'

  it('逐字渲染每一帧都不抛异常，且都能产出节点', () => {
    for (let i = 1; i <= full.length; i++) {
      const nodes = renderStreamingMarkdown(full.slice(0, i))
      expect(Array.isArray(nodes), `第 ${i} 帧`).toBe(true)
    }
  })

  it('中途帧里未闭合的围栏已被补全 —— 正文不会被吞进代码块', () => {
    // 截在代码块中间：不补全的话「就这样。」之后的内容都会变成代码
    const mid = '这套很适合你：\n\n```js\nconst a ='
    const nodes = renderStreamingMarkdown(mid)
    // 段落仍然是段落，没有被 pre 吞掉
    expect(tags(nodes)).toContain('p')
    expect(tags(nodes)).toContain('pre')
  })

  it('最后一帧的文本内容和直接渲染完整文本一致', () => {
    expect(flatten(renderStreamingMarkdown(full))).toBe(flatten(markdownToNodes(full)))
  })

  it('半截加粗当场就是加粗，不会等到收尾才跳一下', () => {
    const t = tags(renderStreamingMarkdown('这套**很适合'))
    expect(t).toContain('strong')
  })
})
