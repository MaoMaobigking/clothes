/*
 * 原生轻提示的唯一出处。
 *
 * ── 为什么要有这个文件 ──
 * 全站有 8 个页面 + OutfitPoster 各写了一份**逐字相同**的：
 *   function toast(title: string) { uni.showToast({ title, icon: 'none' }) }
 * 一模一样的三行抄了 9 遍。没有任何一处需要不同的行为，
 * 纯粹是「上一个页面这么写，下一个页面复制过来」。
 *
 * ── 和 composables/useToast 的分工 ──
 * 这里是**原生**提示：调 uni.showToast，系统自己画那个黑框，页面不用放元素。
 * useToast 是**页内**提示：页面自己有个 <view class="toast">，靠 ref 控制显隐。
 * 两者不是新旧关系，是两种不同的呈现，各有各的页面在用，别互相替换 ——
 * 换了就是改 UI，不是重构。
 *
 * icon 默认给 'none'：小程序 showToast 的默认值其实是 'success'（一个绿勾），
 * 用来报错会出现「✅ 加载失败」这种画面，所以每个调用点都得显式传 none。
 * 收在这里之后就不会再有人忘。
 */

/** 原生轻提示。报错、成功、普通反馈都走这个，默认不带图标。 */
export function toast(title: string, icon: 'none' | 'success' = 'none') {
  uni.showToast({ title, icon })
}
