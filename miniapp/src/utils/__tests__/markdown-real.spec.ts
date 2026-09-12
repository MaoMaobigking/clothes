import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { renderStreamingMarkdown, safeStreamingMarkdown, type RichNode } from '../markdown'

const real: { prompt: string; deltas: string[]; full: string }[] = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures-llm-output.json', import.meta.url)), 'utf8'),
)
const flat = (n: RichNode[]): string => n.map((x) => ('type' in x ? x.text : flat(x.children ?? []))).join('')
const tags = (n: RichNode[]): string[] => n.flatMap((x) => ('name' in x ? [x.name, ...tags(x.children ?? [])] : []))

describe('真实模型输出（DeepSeek 实采）', () => {
  it.each(real.map((r, i) => [i, r] as const))('第 %i 条：按真实 delta 逐帧重放，每帧都不抛异常', (_i, r) => {
    let acc = ''
    for (const d of r.deltas) {
      acc += d
      expect(() => renderStreamingMarkdown(acc)).not.toThrow()
    }
    expect(acc).toBe(r.full)
  })

  it.each(real.map((r, i) => [i, r] as const))('第 %i 条：每帧的代码围栏都是配平的', (_i, r) => {
    let acc = ''
    for (const d of r.deltas) {
      acc += d
      const fences = (safeStreamingMarkdown(acc).match(/^ {0,3}`{3,}/gm) || []).length
      expect(fences % 2).toBe(0)
    }
  })

  it.each(real.map((r, i) => [i, r] as const))('第 %i 条：最终渲染无乱码，且正文字符没丢', (_i, r) => {
    const rendered = flat(renderStreamingMarkdown(r.full))
    expect(rendered).not.toContain('\uFFFD')

    /*
     * 取「去掉围栏行和行首块级标记」之后的可见文字逐字比对。
     * 不能简单地把所有反引号都当标记删掉 —— 围栏那一行的 info string（```markdown）
     * 是语法不是内容，渲染器正确地丢弃了它；我第一版断言把它当成正文，
     * 结果是断言写错而不是渲染出错。同理代码块里的 `# 注释` 不是标题。
     */
    const visible = r.full
      .split('\n')
      .filter((l) => !/^ {0,3}`{3,}/.test(l))
      .join('\n')
      .replace(/\*\*|~~|`/g, '')
      .replace(/^ {0,3}#{1,6}\s+/gm, '')
      .replace(/^ {0,3}(?:[-*+]|\d+[.)])\s+/gm, '')
      .replace(/^ {0,3}>\s?/gm, '')
      .replace(/\s/g, '')

    for (const ch of visible) expect(rendered, `丢了字符 ${ch}`).toContain(ch)
  })

  it('真实输出里确实用到了 Markdown 结构（否则这组测试没有意义）', () => {
    const all = real.flatMap((r) => tags(renderStreamingMarkdown(r.full)))
    console.log('真实输出渲染出的标签:', [...new Set(all)].join(', '))
    expect(all).toContain('strong')
    expect(all.some((t) => t === 'ul' || t === 'ol')).toBe(true)
  })
})
