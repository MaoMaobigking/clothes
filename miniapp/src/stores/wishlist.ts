import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

/**
 * 本地心愿单（商城「爱心」专用）
 *
 * 这就是原来的 stores/cart.ts：一个纯内存的 id 数组。购物车统一到服务端
 * 之后（规格 §4.5 §13），它不能再冒充购物车。
 *
 * 现在商城商品已经是服务端 scene_catalog 的真实目录（批次 5，§4.4 §10.6），
 * 加购走 stores/cart.ts 落库；这里只剩「随手标记一下，回头再看」的爱心，
 * 规格里没有商城收藏这一条，所以保持本地即可。
 *
 * 两个 store 的分工：
 *   - stores/cart.ts     服务端购物车，落库、跨设备、可结算
 *   - 本文件             商城爱心，仅本地、仅当次会话
 *
 * 什么时候删掉它：等规格真的要求「商城收藏可跨设备回看」时，
 * 后端补一张收藏表，这里整体并过去。
 */
export const useWishlistStore = defineStore('wishlist', () => {
  const ids = ref<string[]>([])

  const count = computed(() => ids.value.length)

  function has(id: string) {
    return ids.value.includes(id)
  }
  function add(id: string) {
    if (!ids.value.includes(id)) ids.value.push(id)
  }
  function remove(id: string) {
    const i = ids.value.indexOf(id)
    if (i >= 0) ids.value.splice(i, 1)
  }
  function toggle(id: string) {
    has(id) ? remove(id) : add(id)
  }
  function clear() {
    ids.value = []
  }

  return { ids, count, has, add, remove, toggle, clear }
})
