import { onUnmounted, ref } from 'vue'

/*
 * 页内轻提示（配合 styles/components.css 里的 .toast 用）。
 *
 * ── 为什么要有这个 ──
 * 8 个页面（create / custom·index / custom·category / custom·order /
 * free-match / mall / me / scene）各写了一份同构的三件套：
 *   const toast = ref('')
 *   let toastTimer: ReturnType<typeof setTimeout> | undefined
 *   function showToast(msg) { toast.value = msg; clearTimeout(timer); timer = setTimeout(...) }
 * 差别只在收起时长：1500 / 1600 / 1600 / 1800 / 1800 / 1900 / 1900 七种写法，
 * 而且是随手写的、不是设计定的。这里统一成 1800（七个值的中位数），
 * 除 free-match 从 1500 变长 300ms 外，其余页面的变动都在 200ms 以内。
 * 确实需要不同时长的传参覆盖。
 *
 * ── 顺带修掉的一个真 bug ──
 * 原来 8 份实现**没有一份**在组件卸载时清 timer。提示还亮着就返回上一页的话，
 * 那个 setTimeout 仍会在 1.6 秒后触发，往一个已销毁组件的 ref 上写值。
 * Vue 3 这种写法不会抛错（ref 本身还活着，只是没人再渲染它），
 * 所以一直没被发现 —— 但它是实打实的定时器泄漏，页面来回切就攒一堆。
 * onUnmounted 里清掉。
 *
 * ── 用法（模板零改动）──
 *   const { toast, showToast } = useToast()
 * 返回的 ref 就叫 toast、函数就叫 showToast，和现有 8 个页面的命名一致，
 * 所以 <view v-if="toast" class="toast">{{ toast }}</view> 一个字都不用改。
 */
export function useToast(duration = 1800) {
  const toast = ref('')
  let timer: ReturnType<typeof setTimeout> | undefined

  function showToast(message: string) {
    toast.value = message
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      toast.value = ''
      timer = undefined
    }, duration)
  }

  onUnmounted(() => {
    if (timer) clearTimeout(timer)
  })

  return { toast, showToast }
}
