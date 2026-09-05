/*
 * 购物车的数据结构（规格 §4.4 §4.5 §13）。
 *
 * 后端已把功能二 /api/cart 与功能三 /api/accessory-cart 统一到 cart_items 单表，
 * 三种来源靠 itemType 区分。
 */

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
