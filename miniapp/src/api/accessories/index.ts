/*
 * 配饰推荐接口（功能三）。
 */
import { request } from '@/utils/request'
import { addCartBatch, addCartItem, fetchCart, removeCartItem } from '@/api/cart'
import type { AccessoryCart, AccessoryContextItem, AccessoryRecommendations } from './type'

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
 * 以下购物车函数已弃用（规格 §4.5 §13）。
 *
 * 购物车已统一到 api/cart + /api/cart，请改用那边的
 * fetchCart / addCartItem / addCartBatch / removeCartItem，
 * 或直接用 stores/cart.ts。这里保留为薄封装，只为不打断配饰页
 * 现有的「接口失败就退回本地缓存」双路径逻辑，勿再新增调用方。
 */
export async function fetchAccessoryCart(): Promise<AccessoryCart> {
  return fetchCart()
}

export async function addAccessoryToCart(itemType: 'garment' | 'accessory', itemId: string) {
  return addCartItem(itemType, itemId)
}

export async function addAccessoryCartBatch(
  items: Array<{ itemType: 'garment' | 'accessory'; itemId: string }>,
): Promise<AccessoryCart> {
  return addCartBatch(items)
}

export async function removeAccessoryCartItem(id: number): Promise<boolean> {
  return removeCartItem(id)
}
