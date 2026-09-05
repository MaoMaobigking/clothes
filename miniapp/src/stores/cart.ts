import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  EMPTY_CART,
  addCartBatch,
  addCartItem,
  addOutfitToCart,
  fetchCart,
  removeCartItem,
  updateCartQuantity,
  type Cart,
  type CartItem,
  type CartItemType,
} from '@/api/cart'
import { isAuthError } from '@/api/http'

/**
 * 购物车 store（规格 §4.5 §13）
 *
 * 以前这里是一个纯本地的 id 数组，刷新就没、和后端对不上，
 * 「购物车数据保存后重新打开仍存在」这条验收立不住。现在是服务端购物车的
 * 前端镜像：所有写操作都以接口返回的整车为准，不做乐观更新 ——
 * 数量有 99 上限、重复加购会累加，本地猜的结果和服务端对不齐。
 *
 * 商城页那些 mock 商品不在这里，它们在 stores/wishlist.ts。
 */
export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')

  /** 徽标用：数量之和，不是行数 */
  const count = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))
  const totalPrice = computed(() => items.value.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0))
  const isEmpty = computed(() => items.value.length === 0)

  function apply(cart: Cart) {
    items.value = cart.items || []
    loaded.value = true
    error.value = ''
  }

  /** 某个商品是否已在车里（商品 id，不是 cartId） */
  function has(itemId: string) {
    return items.value.some((item) => item.itemId === itemId)
  }

  function quantityOf(itemId: string) {
    return items.value.find((item) => item.itemId === itemId)?.quantity ?? 0
  }

  /**
   * 未登录不算错误：请求层已经把人送去登录页了，
   * 这里再弹一次「加载失败」只是噪音。
   */
  function handle(err: unknown) {
    if (isAuthError(err)) return
    error.value = (err as Error)?.message || '购物车加载失败'
    throw err
  }

  async function load(force = false) {
    if (loading.value) return
    if (loaded.value && !force) return
    loading.value = true
    try {
      apply(await fetchCart())
    } catch (err) {
      if (isAuthError(err)) {
        apply(EMPTY_CART)
        return
      }
      error.value = (err as Error)?.message || '购物车加载失败'
    } finally {
      loading.value = false
    }
  }

  async function add(
    itemType: CartItemType,
    itemId: string,
    options: { quantity?: number; sourceOutfitId?: string | number } = {},
  ) {
    try {
      apply(await addCartItem(itemType, itemId, options))
    } catch (err) {
      handle(err)
    }
  }

  async function addBatch(
    payload: Array<{ itemType: CartItemType; itemId: string; quantity?: number; sourceOutfitId?: string | number }>,
  ) {
    if (!payload.length) return
    try {
      apply(await addCartBatch(payload))
    } catch (err) {
      handle(err)
    }
  }

  /** 整套搭配拆成单品（§8.9），返回本次入车的件数供提示用 */
  async function addOutfit(outfitId: number) {
    const before = count.value
    try {
      apply(await addOutfitToCart(outfitId))
    } catch (err) {
      handle(err)
    }
    return Math.max(0, count.value - before)
  }

  async function setQuantity(cartId: number, quantity: number) {
    const next = Math.max(1, Math.min(99, Math.round(quantity) || 1))
    try {
      const updated = await updateCartQuantity(cartId, next)
      const index = items.value.findIndex((item) => item.cartId === cartId)
      if (index >= 0) items.value.splice(index, 1, updated)
    } catch (err) {
      handle(err)
    }
  }

  async function remove(cartId: number) {
    try {
      await removeCartItem(cartId)
      items.value = items.value.filter((item) => item.cartId !== cartId)
    } catch (err) {
      handle(err)
    }
  }

  /** 退出登录时调用，见 stores/auth.ts 的 purgeUserScopedCaches */
  function reset() {
    items.value = []
    loading.value = false
    loaded.value = false
    error.value = ''
  }

  return {
    items,
    loading,
    loaded,
    error,
    count,
    totalPrice,
    isEmpty,
    has,
    quantityOf,
    load,
    add,
    addBatch,
    addOutfit,
    setQuantity,
    remove,
    reset,
  }
})
