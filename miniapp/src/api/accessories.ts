import { request } from './http'

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

export interface AccessoryCartItem {
  cartId: number
  itemType: 'garment' | 'accessory'
  itemId: string
  quantity: number
  sourceOutfitId: string | null
  createdAt: string
  name: string
  brand: string
  price: number
  imageUrl: string
  emoji: string
  from: string
  to: string
  taobaoUrl: string
  taokouling: string
}

export interface AccessoryCart {
  items: AccessoryCartItem[]
  count: number
}

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

export async function fetchAccessoryCart(): Promise<AccessoryCart> {
  return request<AccessoryCart>({ url: '/api/accessory-cart' })
}

export async function addAccessoryToCart(itemType: 'garment' | 'accessory', itemId: string) {
  return request<AccessoryCart>({
    url: '/api/accessory-cart',
    method: 'POST',
    data: { itemType, itemId, quantity: 1 },
  })
}

export async function addAccessoryCartBatch(
  items: Array<{ itemType: 'garment' | 'accessory'; itemId: string }>,
): Promise<AccessoryCart> {
  return request<AccessoryCart>({
    url: '/api/accessory-cart/batch',
    method: 'POST',
    data: { items },
  })
}

export async function removeAccessoryCartItem(id: number): Promise<boolean> {
  const data = await request<{ ok: boolean }>({
    url: `/api/accessory-cart/${id}`,
    method: 'DELETE',
  })
  return data.ok
}
