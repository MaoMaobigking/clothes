import { request } from '@/utils/request'
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

export async function fetchScenePlans(input: {
  sceneKey: SceneKey
  season: string
  weather?: SceneWeatherInfo
}): Promise<ScenePlanResult> {
  return request<ScenePlanResult>({
    url: '/api/scene/plans',
    method: 'POST',
    data: input,
  })
}

export async function fetchSceneWeather(input: {
  latitude?: number
  longitude?: number
  city?: string
  temp?: number
  condition?: string
  icon?: string
  season?: string
}): Promise<SceneWeatherInfo> {
  const data = await request<{ weather: SceneWeatherInfo }>({
    url: '/api/scene/weather',
    method: 'GET',
    data: input,
  })
  return data.weather
}

export async function saveSceneOutfit(input: {
  sceneKey: SceneKey
  title: string
  season: string
  mode: SceneMode
  filterKey: SceneFilterKey
  weather: SceneWeatherInfo
  composition: ScenePlanItem[]
}): Promise<SavedSceneOutfit> {
  const data = await request<{ outfit: SavedSceneOutfit }>({
    url: '/api/scene/outfits',
    method: 'POST',
    data: input,
  })
  return data.outfit
}

export async function listSceneOutfits(): Promise<SavedSceneOutfit[]> {
  const data = await request<{ items: SavedSceneOutfit[] }>({
    url: '/api/scene/outfits',
    method: 'GET',
  })
  return data.items
}

export async function getSceneOutfit(id: number): Promise<SavedSceneOutfit> {
  const data = await request<{ outfit: SavedSceneOutfit }>({
    url: `/api/scene/outfits/${id}`,
    method: 'GET',
  })
  return data.outfit
}

export async function buySceneOutfit(
  itemIds: string[],
  sourceOutfitId: string,
): Promise<{
  added: {
    itemId: string
    name: string
    price: number
    taokouling: string
  }[]
  ignored: string[]
}> {
  return request({
    url: '/api/scene/buy',
    method: 'POST',
    data: { itemIds, sourceOutfitId },
  })
}
