import { ref } from 'vue'
import { isAuthError } from '@/utils/request'

/*
 * 「拉数据 → 转圈 → 出错显示一行字」这套骨架的唯一实现。
 *
 * ── 为什么要有这个 ──
 * 21 个页面各写了一遍下面这段，连注释都是抄的：
 *
 *   loading.value = true
 *   errorText.value = ''
 *   try { ... }
 *   catch (error) {
 *     // 未登录时请求层已跳登录页并提示过一次，这里不再重复报错（规格 §5）
 *     if (!isAuthError(error)) {
 *       errorText.value = error instanceof Error ? error.message : 'xx 加载失败'
 *     }
 *   }
 *   finally { loading.value = false }
 *
 * 真正的问题不是行数，是**这段里藏着一条全站约定**：401 不弹提示，
 * 因为 utils/request.ts 已经把人送去登录页了，页面再报一次就是两条提示。
 * 这条约定靠每个页面自觉抄注释来维持 —— 只要有人新写页面时忘了抄，
 * 未登录就会多弹一次。收进来之后它变成 run() 的行为，忘不掉。
 *
 * ── 出错去哪 ──
 * 默认写进 errorText（配合 <view class="state state-fill error">）。
 * 需要弹提示而不是占一块位置的（比如 scene 的「保存模板」），传 onError：
 *   await task.run(() => saveSceneOutfit(...), { message: '保存失败', onError: showToast })
 *
 * ── initialLoading ──
 * 默认 true。原来 21 个页面里大多写的是 `ref(true)` —— 因为 onMounted / onLoad
 * 是挂载之后才跑的，若初值为 false，首帧会闪一下「空列表」再变成「加载中」。
 * 页面本来就不需要首屏转圈时（比如 scene，进来先显示表单）传 false。
 */
export function useAsyncTask(options: { initialLoading?: boolean; message?: string } = {}) {
  const { initialLoading = true, message: defaultMessage = '加载失败' } = options

  const loading = ref(initialLoading)
  const errorText = ref('')

  /**
   * 跑一个异步任务。成功返回结果，失败返回 undefined（错误已被吸收）。
   *
   * 调用方靠返回值判断成败即可，不用再自己 try：
   *   const data = await run(() => fetchX())
   *   if (!data) return
   *
   * silent: 不动 loading。给「手里已经有数据的静默刷新」用 ——
   * community 页切 tab / 从详情页返回时，如果无条件把 loading 置 true，
   * 模板的 v-if="loading" 会把整页内容换成一行「正在读取…」再换回来，
   * 看起来就是闪屏。那一页为此专门写过 `if (!silent) loading = true`，
   * 收进来的时候必须把这个行为一起带上，否则等于把修好的 bug 放回去。
   */
  async function run<T>(
    task: () => Promise<T>,
    opts: { message?: string; onError?: (message: string) => void; silent?: boolean } = {},
  ): Promise<T | undefined> {
    if (!opts.silent) loading.value = true
    errorText.value = ''
    try {
      return await task()
    } catch (error) {
      // 401 已由请求层跳转 + 提示，页面这里保持沉默（规格 §5）
      if (!isAuthError(error)) {
        const text = error instanceof Error ? error.message : ''
        const shown = text || opts.message || defaultMessage
        if (opts.onError) opts.onError(shown)
        else errorText.value = shown
      }
      return undefined
    } finally {
      if (!opts.silent) loading.value = false
    }
  }

  return { loading, errorText, run }
}
