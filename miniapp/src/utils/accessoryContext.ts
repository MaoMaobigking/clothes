import type { AccessoryContextItem } from '@/api/accessories'
import type { Garment } from '@/types'

const CONTEXT_KEY = 'ai-fashion-accessory-context'

export interface AccessoryPageContext {
  source: 'outfit' | 'garment' | 'mall'
  title: string
  outfit: AccessoryContextItem[]
  sourceId?: string
}

export function garmentToAccessoryContext(garment: Garment): AccessoryContextItem {
  return {
    id: garment.id,
    name: garment.name,
    category: garment.category,
    colors: [
      garment.primaryColor || garment.from,
      ...(garment.secondaryColors?.length ? garment.secondaryColors : garment.to ? [garment.to] : []),
    ],
    season: garment.season,
    occasions: garment.occasions?.length ? garment.occasions : garment.tags || [],
    styles: garment.tags || [],
    img: garment.img,
    emoji: garment.emoji,
    from: garment.primaryColor || garment.from,
    to: garment.to,
  }
}

export function mallProductToAccessoryContext(product: {
  id: string
  name: string
  category: string
  emoji: string
  from: string
  to: string
  img: string
  tag?: string
}): AccessoryContextItem {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    colors: [product.from, product.to],
    season: '四季',
    occasions: ['日常'],
    styles: product.tag ? [product.tag] : [],
    img: product.img,
    emoji: product.emoji,
    from: product.from,
    to: product.to,
  }
}

export function setAccessoryPageContext(context: AccessoryPageContext) {
  uni.setStorageSync(CONTEXT_KEY, JSON.stringify(context))
}

export function getAccessoryPageContext(clear = false): AccessoryPageContext | null {
  try {
    const raw = uni.getStorageSync(CONTEXT_KEY)
    if (clear) uni.removeStorageSync(CONTEXT_KEY)
    if (!raw) return null
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed?.outfit?.length ? parsed : null
  } catch {
    return null
  }
}
