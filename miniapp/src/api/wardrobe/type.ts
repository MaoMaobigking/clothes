/*
 * 衣橱与搭配的数据结构。
 *
 * WardrobeItem = Garment + fav。Garment 是跨 api / store / utils / 页面
 * 四层共用的领域实体，所以放在共享类型层 @/types，不放在本文件里。
 */
import type { Garment } from '@/types'

export type WardrobeItem = Garment & { fav: boolean }

export interface OutfitItem {
  id: number
  sortOrder: number
  garment: WardrobeItem
}

export interface Outfit {
  id: number
  title: string
  scene: string
  reason: string
  batchId: string
  kind: string
  isSaved: boolean
  isStarred: boolean
  season: string
  occasion: string
  algorithm: Record<string, any>
  items: OutfitItem[]
  createdAt: string
}

export interface OutfitBatch {
  id: string
  outfits: Outfit[]
}
