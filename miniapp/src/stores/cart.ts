import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export const useCartStore = defineStore('cart', () => {
  const ids = ref<string[]>([])

  const count = computed(() => ids.value.length)

  function has(id: string) { return ids.value.includes(id) }
  function add(id: string) { if (!ids.value.includes(id)) ids.value.push(id) }
  function remove(id: string) {
    const i = ids.value.indexOf(id)
    if (i >= 0) ids.value.splice(i, 1)
  }
  function toggle(id: string) { has(id) ? remove(id) : add(id) }
  function clear() { ids.value = [] }

  return { ids, count, has, add, remove, toggle, clear }
})
