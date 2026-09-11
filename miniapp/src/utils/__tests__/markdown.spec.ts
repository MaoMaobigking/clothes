import { describe, expect, it } from 'vitest'
import { closeUnclosedFence, closeUnclosedInline, safeStreamingMarkdown } from '../markdown'

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
