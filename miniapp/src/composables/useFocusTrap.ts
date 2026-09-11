/*
 * 弹层焦点管理：焦点陷阱 + 焦点归还 + Esc 关闭。
 *
 * ── 为什么这是 a11y 里最该先做的一条 ──
 * 弹层打开后，视觉上背景被遮罩盖住了，但**焦点还在背景里**。
 * 键盘用户按 Tab，焦点会跑到那些看不见的按钮上：屏幕不动、读屏器在念
 * 用户根本看不到的内容，完全不知道自己在哪。这不是「不够好用」，是彻底用不了。
 *
 * 三件事必须成套做，少一件就是半残：
 *   1. 打开时把焦点移进弹层  —— 否则用户要一路 Tab 穿过整个背景才进得来
 *   2. 打开期间 Tab 不许逃逸 —— 到最后一个元素再按 Tab，绕回第一个
 *   3. 关闭时把焦点还给触发它的那个元素 —— 否则焦点掉回 <body>，
 *      用户得从页面最顶上重新 Tab 一遍才能回到原来的位置
 *
 * 第 3 条最容易被漏掉，但它是「连续操作」体验的关键：连开两次同一个弹层，
 * 没有归还的话第二次要重新找入口。
 *
 * ── 只在 H5 生效 ──
 * 小程序没有 DOM、没有键盘焦点模型，也没有 Tab 和 Esc 这两个键，
 * 这一整套在小程序端无从谈起。所以整体用条件编译隔离，
 * 小程序端这个 composable 退化成空实现，不留运行时开销。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Tab 在一圈可聚焦元素里的下一个下标 —— 纯函数，不碰 DOM，可以直接测。
 *
 * `current` 传 -1 表示当前焦点不在这一圈里（比如刚打开弹层，焦点还在外面）。
 *
 * 环绕是焦点陷阱的**全部内容**：正着走到头回到第 0 个，倒着走到头回到最后一个。
 * 少了环绕，Tab 就会把焦点交还给浏览器地址栏，弹层等于没关住。
 */
export function nextFocusIndex(count: number, current: number, backwards: boolean): number {
  if (count <= 0) return -1
  if (current < 0) return backwards ? count - 1 : 0
  return backwards ? (current - 1 + count) % count : (current + 1) % count
}

/**
 * 可聚焦元素选择器。
 *
 * `[tabindex]:not([tabindex="-1"])` 这一条是为自定义控件准备的：
 * uni-app 的 `<view>` 编译出来是普通容器，天生不可聚焦，
 * 必须显式加 tabindex 才进得了 Tab 顺序 —— 这正是本项目要补的那一课。
 * 而 `-1` 要排除掉：那是「可以用代码聚焦、但不进 Tab 顺序」的意思。
 */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export interface UseFocusTrapOptions {
  /** 按 Esc 时调用。传了才有 Esc 行为 */
  onEscape?: () => void
}

export function useFocusTrap(options: UseFocusTrapOptions = {}) {
  /** 绑到弹层面板上的 ref */
  const trapRef = ref<unknown>(null)

  // #ifdef H5
  /** 打开弹层之前焦点在哪 —— 关闭时要还回去 */
  let previouslyFocused: HTMLElement | null = null

  /*
   * uni-app H5 把 <view> 编译成 <uni-view> 组件，模板 ref 拿到的可能是组件实例。
   * 统一收敛成真正的 DOM 元素，免得每个调用点各写一次兜底。
   */
  function resolveEl(): HTMLElement | null {
    const raw = trapRef.value as { $el?: HTMLElement } | HTMLElement | null
    if (!raw) return null
    const el = (raw as { $el?: HTMLElement }).$el ?? raw
    return el instanceof HTMLElement ? el : null
  }

  function focusables(): HTMLElement[] {
    const el = resolveEl()
    if (!el) return []
    return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      // 隐藏元素查得到但聚焦不了，留在列表里会造成「按一次 Tab 没反应」
      (node) => node.offsetWidth > 0 || node.offsetHeight > 0 || node === document.activeElement,
    )
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      /*
       * Esc 无条件关闭，**不看 maskClosable**。
       * 遮罩点击可以禁用（防止填表时误触），但键盘必须留一条出路 ——
       * 否则就是 WCAG 2.1.2 说的键盘陷阱：进得去出不来。
       * 而误按 Esc 远比误触遮罩难发生，两者风险不对等。
       */
      options.onEscape?.()
      return
    }
    if (e.key !== 'Tab') return

    const items = focusables()
    if (items.length === 0) {
      // 弹层里没有任何可聚焦元素：焦点留在面板本身，别让 Tab 把它带走
      e.preventDefault()
      resolveEl()?.focus()
      return
    }

    const current = items.indexOf(document.activeElement as HTMLElement)
    const next = nextFocusIndex(items.length, current, e.shiftKey)
    /*
     * 只在「会绕圈」时接管，其余交给浏览器原生行为。
     * 每次 Tab 都 preventDefault + 手动 focus 也能work，但那样会丢掉
     * 浏览器对 tabindex 正数、iframe、shadow DOM 的处理，得不偿失。
     */
    const willWrap = current === -1 || (e.shiftKey ? current === 0 : current === items.length - 1)
    if (!willWrap) return

    e.preventDefault()
    items[next]?.focus()
  }

  onMounted(() => {
    previouslyFocused = document.activeElement as HTMLElement | null

    // 焦点移进弹层：优先第一个可交互元素，没有就聚焦面板本身（面板带 tabindex="-1"）
    const items = focusables()
    if (items.length > 0) items[0].focus()
    else resolveEl()?.focus()

    document.addEventListener('keydown', onKeydown)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown)
    /*
     * 归还焦点。要判断元素还在不在文档里 —— 触发按钮可能随着某个
     * v-if 一起消失了，对一个已经脱离文档的元素 focus() 是静默失败，
     * 焦点会掉到 <body>，用户得从头 Tab 一遍。
     */
    if (previouslyFocused && document.contains(previouslyFocused)) {
      previouslyFocused.focus()
    }
    previouslyFocused = null
  })
  // #endif

  return { trapRef }
}
