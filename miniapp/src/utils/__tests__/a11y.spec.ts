import { describe, expect, it, vi } from 'vitest'
import { activateOnKey, isActivationKey } from '../a11y'

describe('isActivationKey', () => {
  it('回车和空格是原生按钮的激活键', () => {
    expect(isActivationKey('Enter')).toBe(true)
    expect(isActivationKey(' ')).toBe(true)
  })

  it('认旧版浏览器的 Spacebar 写法', () => {
    // 老 Edge / IE 报的是 'Spacebar' 而不是 ' '，漏掉这条那些浏览器上空格就是死的
    expect(isActivationKey('Spacebar')).toBe(true)
  })

  it('方向键和 Tab 不激活 —— 它们是用来导航的，激活了就没法用键盘浏览了', () => {
    for (const k of ['Tab', 'ArrowDown', 'ArrowUp', 'Escape', 'a', 'Shift']) {
      expect(isActivationKey(k), k).toBe(false)
    }
  })

  it('区分大小写：不能把字母 e 当成 Enter', () => {
    expect(isActivationKey('enter')).toBe(false)
  })
})

/** 造一个最小的键盘事件替身 */
function keyEvent(key: string) {
  return { key, preventDefault: vi.fn() } as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> }
}

describe('activateOnKey', () => {
  it('回车触发处理器', () => {
    const fn = vi.fn()
    activateOnKey(fn)(keyEvent('Enter'))
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('空格触发，并且拦掉默认的翻页行为', () => {
    const fn = vi.fn()
    const e = keyEvent(' ')
    activateOnKey(fn)(e)
    expect(fn).toHaveBeenCalledTimes(1)
    // 不拦的话按钮被激活的同时页面还会滚下去一屏
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('其他键既不触发也不拦截，别妨碍正常的键盘导航', () => {
    const fn = vi.fn()
    const e = keyEvent('Tab')
    activateOnKey(fn)(e)
    expect(fn).not.toHaveBeenCalled()
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it('禁用态下回车也不触发 —— 视觉上灰了，键盘也必须真的按不动', () => {
    const fn = vi.fn()
    activateOnKey(fn, () => true)(keyEvent('Enter'))
    expect(fn).not.toHaveBeenCalled()
  })

  it('禁用判断是每次现取的，不是建处理器那一刻的快照', () => {
    const fn = vi.fn()
    let loading = true
    const handler = activateOnKey(fn, () => loading)
    handler(keyEvent('Enter'))
    expect(fn).not.toHaveBeenCalled()
    loading = false
    handler(keyEvent('Enter'))
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('事件对象缺 key 时不炸（小程序端事件形状完全不同）', () => {
    const fn = vi.fn()
    expect(() => activateOnKey(fn)({} as KeyboardEvent)).not.toThrow()
    expect(fn).not.toHaveBeenCalled()
  })
})
