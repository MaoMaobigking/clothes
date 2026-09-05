import { request } from './http'
import { addCartBatch, addCartItem, fetchCart, removeCartItem, type Cart, type CartItem } from './cart'

export interface AccessoryContextItem {
  id: string
  name: string
  category: string
  colors?: string[]
  season?: string
  occasions?: string[]
  styles?: string[]
  img?: string
  emoji?: string
  from?: string
  to?: string
}

export interface AccessoryCategory {
  key: string
  label: string
  items: Accessory[]
}

export interface AccessoryHotComboItem {
  id: string
  name: string
  category: string
  categoryLabel: string
  imageUrl: string
  emoji: string
  from: string
  to: string
  aggregateRating: number
  ratingCount: number
}

export interface AccessoryHotCombo {
  id: string
  title: string
  subtitle: string
  score: number
  favoriteCount: number
  items: AccessoryHotComboItem[]
}

export interface Accessory {
  id: string
  category: string
  categoryLabel: string
  name: string
  brand: string
  price: number
  originalPrice: number | null
  discountPrice: number | null
  imageUrl: string
  tryonSlot: string
  tryonEnabled: boolean
  primaryColor: string
  secondaryColor: string
  seasons: string[]
  occasions: string[]
  styles: string[]
  keywords: string[]
  taobaoUrl: string
  taokouling: string
  favoriteCount: number
  basePopularity: number
  userRating: number | null
  aggregateRating: number
  ratingCount: number
  matchScore: number
  matchReason: string
  matchReasons: string[]
  emoji?: string
}

export interface AccessoryRecommendations {
  source: 'rule' | 'local'
  currentOutfit: {
    anchor: {
      id: string
      name: string
      category: string
      categoryLabel: string
    }
    colors: string[]
    seasons: string[]
    occasions: string[]
    styles: string[]
    garmentIds: string[]
  }
  categories: AccessoryCategory[]
  discountEligible: boolean
  hotCombos: AccessoryHotCombo[]
}

/**
 * 配饰购物车类型 —— 已并入统一购物车（规格 §4.5 §13）。
 *
 * 后端 /api/accessory-cart 现在转发到 /api/cart，返回体完全一致，
 * 所以这里直接别名到 api/cart.ts 的类型，避免两份定义漂移
 * （统一后多了 available / totalPrice / catalog 类型）。
 */
export type AccessoryCartItem = CartItem
export type AccessoryCart = Cart

export async function fetchAccessoryRecommendations(input: {
  garment?: AccessoryContextItem
  outfit?: AccessoryContextItem[]
}): Promise<AccessoryRecommendations> {
  return request<AccessoryRecommendations>({
    url: '/api/accessories/recommend',
    method: 'POST',
    data: input,
  })
}

export async function rateAccessory(id: string, score: number) {
  return request<{ accessoryId: string; score: number; aggregateRating: number }>({
    url: `/api/accessories/${id}/rating`,
    method: 'POST',
    data: { score },
  })
}

/*
 * 以下购物车函数已弃用（规格 §4.5 §13）。
 *
 * 购物车已统一到 api/cart.ts + /api/cart，请改用那边的
 * fetchCart / addCartItem / addCartBatch / removeCartItem，
 * 或直接用 stores/cart.ts。这里保留为薄封装，只为不打断配饰页
 * 现有的「接口失败就退回本地缓存」双路径逻辑，勿再新增调用方。
 */
export async function fetchAccessoryCart(): Promise<AccessoryCart> {
  return fetchCart()
}

export async function addAccessoryToCart(itemType: 'garment' | 'accessory', itemId: string) {
  return addCartItem(itemType, itemId)
}

export async function addAccessoryCartBatch(
  items: Array<{ itemType: 'garment' | 'accessory'; itemId: string }>,
): Promise<AccessoryCart> {
  return addCartBatch(items)
}

export async function removeAccessoryCartItem(id: number): Promise<boolean> {
  return removeCartItem(id)
}
