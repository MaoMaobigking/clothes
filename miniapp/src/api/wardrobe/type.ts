/*
 * 衣橱与搭配的数据结构。
 *
 * WardrobeItem = Garment + fav。Garment 是衣物的领域实体，
 * 目前还定义在 @/data/mock —— 那是 mock 数据文件，放生产类型并不合适，
 * 归位工作在下一步单独做。
 */
import type { Garment } from '@/data/mock'

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
