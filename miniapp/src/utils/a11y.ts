/*
 * 把自定义控件接回键盘。
 *
 * ── 问题 ──
 * uni-app 里按钮几乎都写成 `<view @tap="...">`。鼠标能点，键盘完全够不着：
 * `<view>` 编译出来是普通容器，不在 Tab 顺序里，也不响应回车和空格。
 * 读屏器念到它只会说「一段文字」，用户不知道那是能按的。
 *
 * ── 为什么不直接改成 <button> ──
 * `<button>` 在小程序端是**原生组件**，自带一套改不掉的样式和层级行为
 * （open-type、hover 态、边框、行高），全站 30+ 处按钮的视觉要重对一遍。
 * 补语义和键盘远比换标签便宜。
 *
 * ── 为什么不做成 v-bind 属性包 ──
 * 一开始写的是 `v-bind="buttonA11y(fn)"` 一句话搞定，**小程序端编译直接失败**：
 *     [vite:vue] v-bind="" is not supported.
 * 小程序的 WXML 要在编译期把属性名静态列出来，没有「运行时展开一个对象」这回事。
 * 所以只能退回逐个属性写。role / tabindex / aria-* 是静态属性，两端都能原样下发
 * （小程序忽略它们），真正需要隔离的只有键盘事件这一处 —— 就是下面这个函数。
 */

/** 回车和空格是原生按钮的两个激活键，自定义控件要手动补上 */
export function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ' || key === 'Spacebar'
}

/**
 * 造一个键盘激活处理器，挂到 `@keydown` 上，和 `@tap` 并存。
 *
 * 小程序端 `<view>` 根本不会派发 keydown，所以这个函数在那边永远不被调用 ——
 * 不需要条件编译，它自己就是惰性的。
 *
 * @example
 * const onLoginKey = activateOnKey(submitPassword)
 * // <view role="button" tabindex="0" @keydown="onLoginKey" @tap="submitPassword">
 */
export function activateOnKey(handler: () => void, isDisabled?: () => boolean) {
  return (e: KeyboardEvent) => {
    if (isDisabled?.()) return
    if (!isActivationKey(e?.key)) return
    /*
     * 空格默认是「翻页」。不拦住的话，按空格会激活按钮**并且**把页面滚下去一屏，
     * 用户会以为自己点错了地方。回车没有默认行为，一起拦掉更一致。
     */
    e.preventDefault?.()
    handler()
  }
}
