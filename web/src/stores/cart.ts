// ① 从 Vue 里拿工具：computed = 计算属性，ref = 响应式变量
import { computed, ref } from 'vue'

// ② 从 Pinia 里拿 defineStore —— 定义仓库的"模具"
import { defineStore } from 'pinia'

// ③ 定义一个叫 'cart' 的仓库
//    第二个参数 () => { ... } 是工厂函数，返回你要暴露的东西
export const useCartStore = defineStore('cart', () => {
  // ── 状态（state）：存数据 ──
  const ids = ref<string[]>([])        // 收藏的商品 id 列表，初始为空数组
  // ref 包裹 = "这个值变了，用到它的地方自动更新"

  // ── 计算属性（getter）：从状态算出新数据 ──
  const count = computed(() => ids.value.length)  // 收藏了多少件

  // ── 方法（action）：修改状态 ──
  function has(id: string) {           // 查某个 id 是否已收藏
    return ids.value.includes(id)
  }

  function add(id: string) {           // 添加收藏
    if (!ids.value.includes(id)) ids.value.push(id)
  }

  function remove(id: string) {        // 取消收藏
    const i = ids.value.indexOf(id)
    if (i >= 0) ids.value.splice(i, 1)
  }

  function toggle(id: string) {        // 点一下收藏/再点取消
    if (has(id)) remove(id)
    else add(id)
  }

  function clear() {                   // 清空
    ids.value = []
  }

  // ④ 把要对外用的东西 return 出去
  return { ids, count, has, add, remove, toggle, clear }
})