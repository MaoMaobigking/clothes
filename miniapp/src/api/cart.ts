/*
 * 购物车接口（规格 §4.4 §4.5 §13）
 *
 * 全项目唯一的购物车 API。后端已把功能二 /api/cart 与功能三
 * /api/accessory-cart 统一到 cart_items 单表，前端也只留这一个入口。
 * api/accessories.ts 里的 /api/accessory-cart 系列已弃用，勿再新增调用。
 */
import { request } from './http'

/** 三种来源：旧衣（按人隔离）、配饰目录、场景新品目录 */
export type CartItemType = 'garment' | 'accessory' | 'catalog'

export interface CartItem {
  cartId: number
  itemType: CartItemType
  itemId: string
  quantity: number
  /** 来源搭配 id：整套搭配拆成单品时记录，用于「来自搭配」标记 */
  sourceOutfitId: string | null
  /** 目录里查得到明细才为 true；false 表示商品已下架，只能删 */
  available: boolean
  name: string
  brand: string
  price: number | null
  imageUrl: string
  emoji: string
  from: string
  to: string
  taobaoUrl: string
  taokouling: string
  createdAt?: string
  updatedAt?: string
}

export interface Cart {
  items: CartItem[]
  /** 数量之和，不是行数 */
  count: number
  totalPrice: number
}

export const EMPTY_CART: Cart = { items: [], count: 0, totalPrice: 0 }

export function fetchCart(): Promise<Cart> {
  return request<Cart>({ url: '/api/cart' })
}

export function addCartItem(
  itemType: CartItemType,
  itemId: string,
  options: { quantity?: number; sourceOutfitId?: string | number } = {},
): Promise<Cart> {
  return request<Cart>({
    url: '/api/cart',
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
  return request<Cart>({ url: '/api/cart/batch', method: 'POST', data: { items } })
}

/** 整套搭配拆成单品写入购物车（§4.5 §8.9） */
export function addOutfitToCart(outfitId: number): Promise<Cart> {
  return request<Cart>({ url: `/api/cart/outfits/${outfitId}`, method: 'POST' })
}

export async function updateCartQuantity(cartId: number, quantity: number): Promise<CartItem> {
  const data = await request<{ item: CartItem }>({
    url: `/api/cart/${cartId}`,
    method: 'PATCH',
    data: { quantity },
  })
  return data.item
}

export async function removeCartItem(cartId: number): Promise<boolean> {
  const data = await request<{ ok: boolean }>({
    url: `/api/cart/${cartId}`,
    method: 'DELETE',
  })
  return data.ok
}
