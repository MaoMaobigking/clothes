/*
 * 购物车接口（规格 §4.4 §4.5 §13）
 *
 * 全项目唯一的购物车 API。后端已把功能二 /api/cart 与功能三
 * /api/accessory-cart 统一到 cart_items 单表，前端也只留这一个入口。
 * api/accessories 里的 /api/accessory-cart 系列已弃用，勿再新增调用。
 */
import { request } from '@/utils/request'
import type { Cart, CartItem, CartItemType } from './type'

enum API {
  /** 取车 / 加单件 */
  CART_URL = '/api/cart',
  /** 批量加购 */
  CART_BATCH_URL = '/api/cart/batch',
  /** 整套搭配拆成单品入车，后面接 outfitId */
  CART_OUTFIT_URL = '/api/cart/outfits/',
  /** 改数量 / 删行，后面接 cartId */
  CART_ITEM_URL = '/api/cart/',
}

/** 类型再导出的理由见 api/diary/index.ts 的说明 */
export type { Cart, CartItem, CartItemType } from './type'

export const EMPTY_CART: Cart = { items: [], count: 0, totalPrice: 0 }

export function fetchCart(): Promise<Cart> {
  return request<Cart>({ url: API.CART_URL })
}

export function addCartItem(
  itemType: CartItemType,
  itemId: string,
  options: { quantity?: number; sourceOutfitId?: string | number } = {},
): Promise<Cart> {
  return request<Cart>({
    url: API.CART_URL,
    method: 'POST',
    data: {
      itemType,
      itemId,
      quantity: options.quantity ?? 1,
      sourceOutfitId: options.sourceOutfitId ?? null,
    },
  })
}

export function addCartBatch(
  items: Array<{ itemType: CartItemType; itemId: string; quantity?: number; sourceOutfitId?: string | number }>,
): Promise<Cart> {
  return request<Cart>({ url: API.CART_BATCH_URL, method: 'POST', data: { items } })
}

/** 整套搭配拆成单品写入购物车（§4.5 §8.9） */
export function addOutfitToCart(outfitId: number): Promise<Cart> {
  return request<Cart>({ url: API.CART_OUTFIT_URL + outfitId, method: 'POST' })
}

export async function updateCartQuantity(cartId: number, quantity: number): Promise<CartItem> {
  const data = await request<{ item: CartItem }>({
    url: API.CART_ITEM_URL + cartId,
    method: 'PATCH',
    data: { quantity },
  })
  return data.item
}

export async function removeCartItem(cartId: number): Promise<boolean> {
  const data = await request<{ ok: boolean }>({
    url: API.CART_ITEM_URL + cartId,
    method: 'DELETE',
  })
  return data.ok
}
