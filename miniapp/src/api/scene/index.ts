/*
 * 场景模拟接口（功能四）。
 */
import { request } from '@/utils/request'
import type { SceneFilterKey, SceneKey, SceneMode } from '@/constants/scene'
import type { SavedSceneOutfit, ScenePlanItem, ScenePlanResult, SceneWeatherInfo } from './type'

enum API {
  /** 生成搭配方案 */
  PLANS_URL = '/api/scene/plans',
  /** 天气（定位或手填） */
  WEATHER_URL = '/api/scene/weather',
  /** 保存 / 列出场景搭配 */
  OUTFITS_URL = '/api/scene/outfits',
  /** 单条场景搭配，后面接 id */
  OUTFIT_URL = '/api/scene/outfits/',
  /** 新品一键加购 */
  BUY_URL = '/api/scene/buy',
}

/** 类型再导出的理由见 api/diary/index.ts 的说明 */
export type { SavedSceneOutfit, ScenePlan, ScenePlanItem, ScenePlanResult, SceneWeatherInfo } from './type'

export async function fetchScenePlans(input: {
  sceneKey: SceneKey
  season: string
  weather?: SceneWeatherInfo
}): Promise<ScenePlanResult> {
  return request<ScenePlanResult>({
    url: API.PLANS_URL,
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
    url: API.WEATHER_URL,
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
    url: API.OUTFITS_URL,
    method: 'POST',
    data: input,
  })
  return data.outfit
}

export async function listSceneOutfits(): Promise<SavedSceneOutfit[]> {
  const data = await request<{ items: SavedSceneOutfit[] }>({
    url: API.OUTFITS_URL,
    method: 'GET',
  })
  return data.items
}

export async function getSceneOutfit(id: number): Promise<SavedSceneOutfit> {
  const data = await request<{ outfit: SavedSceneOutfit }>({
    url: API.OUTFIT_URL + id,
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
    url: API.BUY_URL,
    method: 'POST',
    data: { itemIds, sourceOutfitId },
  })
}
