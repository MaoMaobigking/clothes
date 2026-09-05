/*
 * 配饰推荐（功能三）的数据结构。
 */
import type { Cart, CartItem } from '@/api/cart'

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
 * 所以这里直接别名到 api/cart 的类型，避免两份定义漂移
 * （统一后多了 available / totalPrice / catalog 类型）。
 */
export type AccessoryCartItem = CartItem
export type AccessoryCart = Cart
