import { describe, expect, it } from 'vitest'
import { FOCUSABLE_SELECTOR, nextFocusIndex } from '../useFocusTrap'

/*
 * 只测纯逻辑：环绕算法和选择器。
 * DOM 绑定那半截（onMounted 聚焦、Esc、归还）依赖真实浏览器焦点模型，
 * 在 happy-dom 里测出来的「焦点」和真机行为对不上，测了反而给人虚假信心 ——
 * 那半截靠手动验收，清单见 docs/阿里前端全栈岗-项目补强清单.md 批次 2。
 */

describe('nextFocusIndex · 正向 Tab', () => {
  it('从中间往后走一格', () => {
    expect(nextFocusIndex(5, 2, false)).toBe(3)
  })

  it('走到最后一个再按 Tab，绕回第 0 个（这就是「陷阱」的全部）', () => {
    expect(nextFocusIndex(5, 4, false)).toBe(0)
  })

  it('焦点原本不在圈内（刚打开弹层）→ 进第 0 个', () => {
    expect(nextFocusIndex(5, -1, false)).toBe(0)
  })
})

describe('nextFocusIndex · 反向 Shift+Tab', () => {
  it('从中间往前走一格', () => {
    expect(nextFocusIndex(5, 2, true)).toBe(1)
  })

  it('在第 0 个按 Shift+Tab，绕到最后一个', () => {
    expect(nextFocusIndex(5, 0, true)).toBe(4)
  })

  it('焦点原本不在圈内 → 进最后一个', () => {
    expect(nextFocusIndex(5, -1, true)).toBe(4)
  })
})

describe('nextFocusIndex · 边界', () => {
  it('一个可聚焦元素时，怎么按都停在它自己身上', () => {
    expect(nextFocusIndex(1, 0, false)).toBe(0)
    expect(nextFocusIndex(1, 0, true)).toBe(0)
  })

  it('没有可聚焦元素时返回 -1，调用方据此把焦点留在面板上', () => {
    expect(nextFocusIndex(0, -1, false)).toBe(-1)
    expect(nextFocusIndex(0, 0, true)).toBe(-1)
  })

  it('正反各走一圈都能回到原点（环绕是闭合的）', () => {
    const count = 4
    let i = 0
    for (let k = 0; k < count; k++) i = nextFocusIndex(count, i, false)
    expect(i).toBe(0)
    for (let k = 0; k < count; k++) i = nextFocusIndex(count, i, true)
    expect(i).toBe(0)
  })
})

describe('FOCUSABLE_SELECTOR', () => {
  it('收录带 tabindex 的自定义控件 —— uni-app 的 <view> 全靠这条才进得了 Tab 顺序', () => {
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex]')
  })

  it('排除 tabindex="-1"：那是「可编程聚焦但不进 Tab 顺序」，不该算一站', () => {
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])')
  })

  it('排除 disabled 控件 —— 留着会让 Tab 停在点不动的东西上', () => {
    for (const tag of ['button', 'input', 'select', 'textarea']) {
      expect(FOCUSABLE_SELECTOR).toContain(`${tag}:not([disabled])`)
    }
  })

  it('每个分句都非空且方括号配对（少一个 ] 会让 querySelectorAll 整条抛，弹层直接白屏）', () => {
    const clauses = FOCUSABLE_SELECTOR.split(',')
    expect(clauses.length).toBeGreaterThan(1)
    for (const c of clauses) {
      expect(c.trim()).not.toBe('')
      expect(c.split('[').length).toBe(c.split(']').length)
      expect(c.split('(').length).toBe(c.split(')').length)
    }
  })
})
