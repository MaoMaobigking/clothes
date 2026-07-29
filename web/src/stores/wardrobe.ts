import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { GARMENTS, type Garment } from '@/data/mock'
import {
  apiAddGarment,
  apiDeleteGarment,
  apiListGarments,
  apiToggleFav,
  type WardrobeItem,
} from '@/api/wardrobe'

const DEFAULT_FAV = ['g1', 'g9', 'g11']

/** 后端没开时的本地兜底数据（App 照常能用） */
function fallbackItems(): WardrobeItem[] {
  return GARMENTS.map((g) => ({ ...g, fav: DEFAULT_FAV.includes(g.id) }))
}

export const useWardrobeStore = defineStore('wardrobe', () => {
  const items = ref<WardrobeItem[]>(fallbackItems())
  const activeCategory = ref('all')
  const usingApi = ref(false) // 是否已连上真实数据库
  const loaded = ref(false)

  /** 尝试从后端数据库拉真实数据；连不上就用本地兜底 */
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

  function isFav(id: string) {
    return items.value.find((g) => g.id === id)?.fav ?? false
  }

  async function toggleFav(id: string) {
    const it = items.value.find((g) => g.id === id)
    if (!it) return
    it.fav = !it.fav // 乐观更新，界面立刻反馈
    if (usingApi.value) {
      try {
        it.fav = await apiToggleFav(id)
      } catch {
        /* 网络失败就保持乐观值 */
      }
    }
  }

  async function addItem(partial: Partial<Garment>) {
    if (usingApi.value) {
      try {
        items.value.push(await apiAddGarment(partial))
        return
      } catch {
        /* 落到本地兜底 */
      }
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
    if (usingApi.value) {
      try {
        await apiDeleteGarment(id)
      } catch {
        /* ignore */
      }
    }
    items.value = items.value.filter((g) => g.id !== id)
  }

  function setCategory(key: string) {
    activeCategory.value = key
  }

  // 首次使用该 store 即尝试连数据库
  load()

  return {
    items,
    activeCategory,
    usingApi,
    loaded,
    garments,
    filtered,
    favoriteGarments,
    favIds,
    isFav,
    toggleFav,
    addItem,
    removeItem,
    setCategory,
    load,
  }
})
