/*
 * 效果图与海报的统一单品形状（规格 §8.8 §8.9 §10.7 §10.10）。
 *
 * 功能二的搭配（Outfit.items[].garment）和功能四的场景方案（ScenePlanItem）
 * 字段名不一样：一个叫 img 一个叫 imageUrl，一个把颜色放 primaryColor
 * 一个放 from。以前 OutfitPreview / OutfitPoster 只认功能二那套，
 * 功能四只能自己另画一版舞台和海报，结果就是效果图里没有真实衣物。
 * 在这里抹平一次，两个功能共用同一套叠加与海报逻辑。
 */
import type { Outfit } from '@/api/wardrobe'
import type { ScenePlanItem } from '@/api/scene'
import { resolveImageUrl } from '@/api/wardrobe'

export interface OutfitPiece {
  id: string
  name: string
  /** 品类 key，决定叠加位（帽子在头、鞋在脚） */
  category: string
  img: string
  /** 缺图时的占位配色 */
  from: string
  to: string
  emoji: string
}

export function piecesFromOutfit(outfit: Outfit | null): OutfitPiece[] {
  if (!outfit) return []
  return outfit.items.map((item) => ({
    id: String(item.garment.id),
    name: item.garment.name,
    category: item.garment.category,
    img: resolveImageUrl(item.garment.img) || '',
    from: item.garment.primaryColor || item.garment.from || '#ffd1e8',
    to: item.garment.to || '#c9b8ff',
    emoji: item.garment.emoji || '👗',
  }))
}

export function piecesFromSceneItems(items: ScenePlanItem[]): OutfitPiece[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    img: resolveImageUrl(item.imageUrl) || '',
    from: item.from || '#ffd1e8',
    to: item.to || '#c9b8ff',
    emoji: item.emoji || '👗',
  }))
}
