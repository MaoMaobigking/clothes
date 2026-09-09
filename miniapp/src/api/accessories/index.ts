/*
 * 配饰推荐接口（功能三）。
 */
import { request } from '@/utils/request'
import type { AccessoryContextItem, AccessoryRecommendations } from './type'

enum API {
  /** 按当前搭配推荐配饰 */
  RECOMMEND_URL = '/api/accessories/recommend',
  /** 单件配饰评分，后面接 id 再拼 /rating */
  ACCESSORY_URL = '/api/accessories/',
}

/** 类型再导出的理由见 api/diary/index.ts 的说明 */
export type {
  Accessory,
  AccessoryCart,
  AccessoryCartItem,
  AccessoryCategory,
  AccessoryContextItem,
  AccessoryHotCombo,
  AccessoryHotComboItem,
  AccessoryRecommendations,
} from './type'

export async function fetchAccessoryRecommendations(input: {
  garment?: AccessoryContextItem
  outfit?: AccessoryContextItem[]
}): Promise<AccessoryRecommendations> {
  return request<AccessoryRecommendations>({
    url: API.RECOMMEND_URL,
    method: 'POST',
    data: input,
  })
}

export async function rateAccessory(id: string, score: number) {
  return request<{ accessoryId: string; score: number; aggregateRating: number }>({
    url: `${API.ACCESSORY_URL}${id}/rating`,
    method: 'POST',
    data: { score },
  })
}

/*
 * 这里原来还有四个购物车薄封装（fetchAccessoryCart / addAccessoryToCart /
 * addAccessoryCartBatch / removeAccessoryCartItem），转手调 api/cart，
 * 注释里写着「已弃用…勿再新增调用方，保留只为不打断配饰页的双路径逻辑」。
 *
 * 2026-09-08：配饰页已改用 stores/cart，唯一的调用方没了，四个封装一并删除。
 * 购物车只走 api/cart 或 stores/cart 这一条路。
 */
