import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { GARMENTS, type Garment } from '@/data/mock'
import {
  apiAddGarment,
  apiDeleteGarment,
  apiListGarments,
  apiReorderGarments,
  apiToggleFav,
  apiToggleFrequentlyWorn,
  apiUpdateGarment,
  apiUploadGarments,
  type WardrobeItem,
} from '@/api/wardrobe'

const DEFAULT_FAV = ['g1', 'g9', 'g11']

function fallbackItems(): WardrobeItem[] {
  return GARMENTS.map((g) => ({ ...g, fav: DEFAULT_FAV.includes(g.id) }))
}

export const useWardrobeStore = defineStore('wardrobe', () => {
  const items = ref<WardrobeItem[]>(fallbackItems())
  const activeCategory = ref('all')
  const usingApi = ref(false)
  const loaded = ref(false)

  async function load() {
    try {
      items.value = await apiListGarments()
      usingApi.value = true
    } catch {
      usingApi.value = false
    } finally {
      loaded.value = true
    }
  }

  const garments = computed(() => items.value)
  const filtered = computed(() =>
    activeCategory.value === 'all'
      ? items.value
      : items.value.filter((g) => g.category === activeCategory.value),
  )
  const favoriteGarments = computed(() => items.value.filter((g) => g.fav))
  const favIds = computed(() => items.value.filter((g) => g.fav).map((g) => g.id))

  function isFav(id: string) { return items.value.find((g) => g.id === id)?.fav ?? false }

  async function toggleFav(id: string) {
    const it = items.value.find((g) => g.id === id)
    if (!it) return
    it.fav = !it.fav
    if (usingApi.value) {
      try { it.fav = await apiToggleFav(id) } catch { /* ignore */ }
    }
  }

  async function updateItem(id: string, partial: Partial<Garment>) {
    const index = items.value.findIndex((g) => g.id === id)
    if (index < 0) return
    if (usingApi.value) {
      const updated = await apiUpdateGarment(id, partial)
      items.value.splice(index, 1, updated)
      return updated
    }
    items.value.splice(index, 1, { ...items.value[index], ...partial })
    return items.value[index]
  }

  async function uploadItems(filePaths: string[]) {
    const uploaded = await apiUploadGarments(filePaths)
    items.value = [...uploaded, ...items.value]
    return uploaded
  }

  async function reorder(ids: string[]) {
    if (usingApi.value) {
      items.value = await apiReorderGarments(ids)
      return
    }
    const byId = new Map(items.value.map((item) => [item.id, item]))
    items.value = ids.map((id) => byId.get(id)).filter(Boolean) as WardrobeItem[]
  }

  async function toggleFrequentlyWorn(id: string) {
    if (usingApi.value) {
      const updated = await apiToggleFrequentlyWorn(id)
      const index = items.value.findIndex((g) => g.id === id)
      if (index >= 0) items.value.splice(index, 1, updated)
      return updated
    }
    const item = items.value.find((g) => g.id === id)
    if (item) item.frequentlyWorn = !item.frequentlyWorn
    return item
  }

  async function addItem(partial: Partial<Garment>) {
    if (usingApi.value) {
      try { items.value.push(await apiAddGarment(partial)); return } catch { /* fallback */ }
    }
    items.value.push({
      id: 'u' + Date.now(),
      name: partial.name || '新单品',
      category: partial.category || 'top',
      brand: partial.brand || 'MINE',
      emoji: partial.emoji || '👕',
      from: partial.from || '#ffd1e8',
      to: partial.to || '#c9b8ff',
      price: partial.price ?? 0,
      season: (partial.season as Garment['season']) || '四季',
      img: partial.img || '',
      fav: false,
    })
  }

  async function removeItem(id: string) {
    if (usingApi.value) { try { await apiDeleteGarment(id) } catch { /* ignore */ } }
    items.value = items.value.filter((g) => g.id !== id)
  }

  function setCategory(key: string) { activeCategory.value = key }

  /**
   * 退出登录 / 切换账号时回到初始态。
   * setup 语法的 store 没有内置 $reset，得自己写；不清的话
   * 上一个人的衣橱会留在内存里，下一个人进衣橱页会先看到别人的衣服。
   */
  function reset() {
    items.value = fallbackItems()
    activeCategory.value = 'all'
    usingApi.value = false
    loaded.value = false
  }

  load()

  return {
    items, activeCategory, usingApi, loaded,
    garments, filtered, favoriteGarments, favIds,
    isFav, toggleFav, addItem, updateItem, uploadItems, reorder,
    toggleFrequentlyWorn, removeItem, setCategory, load, reset,
  }
})
