import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Garment } from '@/types'
import {
  apiDeleteGarment,
  apiListGarments,
  apiReorderGarments,
  apiToggleFrequentlyWorn,
  apiUpdateGarment,
  apiUploadGarments,
  type WardrobeItem,
} from '@/api/wardrobe'

export const useWardrobeStore = defineStore('wardrobe', () => {
  /**
   * 初始值必须是空数组。
   * 以前这里灌的是 data/mock 里的 GARMENTS，后端没起来时页面上会显示一柜子
   * 根本不属于这个用户的衣服，还能拿去生成搭配 —— 规格 §4.3 明确禁止用假数据
   * 冒充真实衣橱。现在加载失败就是空态 + 错误提示。
   *
   * ============================================================
   *  错误契约（和 stores/cart.ts 保持一致）
   * ============================================================
   *   load()（读）  失败不抛，写 loadError + 清空 items。页面渲染空态 + 错误行。
   *   其余（写）    失败**会抛**，调用方 try/catch 给回音。
   *
   * ── 2026-09-08 删掉的东西 ──
   * 这里原本有一个 `usingApi` 开关，写操作都是
   *   if (usingApi) { 调接口 } else { 改本地数组 }
   * 三个问题：
   *   1. **它已经没有意义。** usingApi 只有 load() 失败时才是 false，
   *      而那条路径同时把 items 清空了 —— 所有 else 分支面对的都是空数组，
   *      要么被 `if (!it) return` 挡掉，要么是空转。全站也没有一处读它。
   *   2. **addItem 会捏造假数据。** 它的 else 分支 push 一件 id 为 `'u'+Date.now()`
   *      的衣服，服务端不认这个 id：拿去生成搭配会失败，下次 load() 它就消失。
   *      这正是本文件开头那段注释明令禁止的事。
   *      而且它的 try 里还挂了一个只写着「fallback」的空 catch —— 接口通着、
   *      只是这一次调用失败时，也会掉进去捏一件。
   *   3. **removeItem 假装删成功。** 接口失败被 catch 吞掉，本地照删不误，
   *      界面上东西没了，重新进页面又回来了。
   *
   * addItem 和 toggleFav 全站零调用，直接删除；其余去掉分支，失败就抛。
   */
  const items = ref<WardrobeItem[]>([])
  const activeCategory = ref('all')
  const loaded = ref(false)
  const loadError = ref('')

  async function load() {
    try {
      items.value = await apiListGarments()
      loadError.value = ''
    } catch (error) {
      items.value = []
      loadError.value =
        error instanceof Error && error.message
          ? `衣橱加载失败：${error.message}`
          : '衣橱加载失败，请检查网络或稍后重试'
    } finally {
      loaded.value = true
    }
  }

  const garments = computed(() => items.value)
  const filtered = computed(() =>
    activeCategory.value === 'all' ? items.value : items.value.filter((g) => g.category === activeCategory.value),
  )
  const favoriteGarments = computed(() => items.value.filter((g) => g.fav))
  const favIds = computed(() => items.value.filter((g) => g.fav).map((g) => g.id))

  function isFav(id: string) {
    return items.value.find((g) => g.id === id)?.fav ?? false
  }

  async function updateItem(id: string, partial: Partial<Garment>) {
    const index = items.value.findIndex((g) => g.id === id)
    if (index < 0) return
    const updated = await apiUpdateGarment(id, partial)
    items.value.splice(index, 1, updated)
    return updated
  }

  async function uploadItems(filePaths: string[]) {
    const uploaded = await apiUploadGarments(filePaths)
    items.value = [...uploaded, ...items.value]
    return uploaded
  }

  async function reorder(ids: string[]) {
    items.value = await apiReorderGarments(ids)
  }

  async function toggleFrequentlyWorn(id: string) {
    const updated = await apiToggleFrequentlyWorn(id)
    const index = items.value.findIndex((g) => g.id === id)
    if (index >= 0) items.value.splice(index, 1, updated)
    return updated
  }

  /** 删除。接口失败就抛，**不**在本地先删掉 —— 那样界面和库里会对不上 */
  async function removeItem(id: string) {
    await apiDeleteGarment(id)
    items.value = items.value.filter((g) => g.id !== id)
  }

  function setCategory(key: string) {
    activeCategory.value = key
  }

  /**
   * 退出登录 / 切换账号时回到初始态。
   * setup 语法的 store 没有内置 $reset，得自己写；不清的话
   * 上一个人的衣橱会留在内存里，下一个人进衣橱页会先看到别人的衣服。
   */
  function reset() {
    items.value = []
    activeCategory.value = 'all'
    loaded.value = false
    loadError.value = ''
  }

  load()

  return {
    items,
    activeCategory,
    loaded,
    loadError,
    garments,
    filtered,
    favoriteGarments,
    favIds,
    isFav,
    updateItem,
    uploadItems,
    reorder,
    toggleFrequentlyWorn,
    removeItem,
    setCategory,
    load,
    reset,
  }
})
