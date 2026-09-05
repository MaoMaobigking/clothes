/*
 * 场景模拟（功能四）的数据结构。
 *
 * SceneKey / SceneMode / SceneFilterKey 是前端的场景枚举，定义在 @/data/scene，
 * 这里直接复用，不重复声明一份。
 */
import type { SceneFilterKey, SceneKey, SceneMode } from '@/data/scene'

export interface SceneWeatherInfo {
  city: string
  temp: number
  condition: string
  icon: string
  source: 'located' | 'fallback' | 'manual'
  latitude?: number
  longitude?: number
  season?: string
}

export interface ScenePlanItem {
  id: string
  name: string
  category: string
  price: number
  imageUrl: string
  from: string
  to: string
  emoji: string
  season: string
  tags: string[]
  isNew: boolean
  source: 'garment' | 'catalog'
  taobaoUrl?: string
  taokouling?: string
  keywords?: string[]
}

export interface ScenePlan {
  id: string
  title: string
  scene: string
  sceneKey: SceneKey
  season: string
  mode: SceneMode
  reason: string
  items: ScenePlanItem[]
  weather: SceneWeatherInfo
  newItemCount: number
  oldItemCount: number
  missingSlots?: string[]
}

export interface ScenePlanResult {
  scene: { key: SceneKey; label: string; keywords: string[] }
  season: string
  weather: SceneWeatherInfo
  profile: {
    styles: string[]
    visualBody: string
  }
  wardrobeCount: number
  activatedGarmentCount: number
  plans: {
    pure: ScenePlan[]
    mixed: ScenePlan[]
  }
  missingSlots: string[]
}

export interface SavedSceneOutfit {
  id: number
  sceneKey: SceneKey
  title: string
  season: string
  mode: SceneMode
  filterKey: SceneFilterKey
  weather: SceneWeatherInfo
  composition: ScenePlanItem[]
  createdAt: string
}
