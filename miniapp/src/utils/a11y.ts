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

/**
 * 把可见标签「程序性关联」到 uni-app 输入框内部真正的 `<input>` 上。仅 H5。
 *
 * ── 为什么需要这么脏的一步 ──
 * uni-app 的 `<input>` 是组件，不是原生标签。你写在上面的 `aria-label`
 * 会落到外层 `<uni-input>`，而无障碍树认的是内层那个
 * `<input class="uni-input-input">` —— 它上面什么都没有。
 *
 * 结果就是：**加了 aria-label，Lighthouse 照样报 label 失败**，读屏器照样只念
 * 「编辑框」。这件事光看代码发现不了，是跑了审计才暴露的。
 *
 * 视觉上加 `<text>` 标签解决了「用户看得见」，但**没有解决「程序性关联」** ——
 * 屏幕阅读器不会因为旁边有段文字就把它当成标签，必须有 `<label for>`、
 * `aria-label` 或 `aria-labelledby`。而前两者我们都够不到。
 *
 * 所以在挂载后直接补：按 DOM 顺序把可见标签的文字写到对应输入框的 aria-label 上。
 * 小程序端没有 DOM 也没有读屏器的这套模型，整个函数被条件编译掉。
 *
 * @param labelSelector 可见标签的选择器
 * @param inputSelector uni-app 渲染出来的内层真实 input
 */
export function linkVisibleLabels(labelSelector = '.field-label', inputSelector = '.uni-input-input') {
  // #ifdef H5
  const labels = Array.from(document.querySelectorAll<HTMLElement>(labelSelector))
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(inputSelector))
  /*
   * 按顺序配对。数量对不上就整个跳过 —— 错位地贴标签比不贴更糟：
   * 读屏器会把「密码」念给账号框，用户据此输入，等于主动误导。
   */
  if (labels.length === 0 || labels.length !== inputs.length) return
  labels.forEach((label, i) => {
    const text = (label.textContent || '').trim()
    if (text) inputs[i].setAttribute('aria-label', text)
  })
  // #endif
}
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
