import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

/**
 * 本地心愿单（商城 mock 商品专用）
 *
 * 这就是原来的 stores/cart.ts：一个纯内存的 id 数组。购物车统一到服务端
 * 之后（规格 §4.5 §13），它不能再冒充购物车 —— 首页和商城页的 MALL_PRODUCTS
 * 来自 miniapp/src/data/mock.ts，服务端 accessories / scene_catalog 里都没有
 * 对应记录，塞进真实购物车只会拿到 404。
 *
 * 所以拆成两个 store：
 *   - stores/cart.ts     服务端购物车，落库、跨设备、可结算
 *   - 本文件             商城演示商品的收藏心号，仅本地、仅当次会话
 *
 * 等商城页改成读真实目录（accessories / scene_catalog）后，
 * 这个 store 应该整体删掉，收藏行为并回真实数据。
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
