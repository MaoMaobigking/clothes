/*
 * 商城接口（规格 §4.4 §10.6）
 *
 * 商品来自服务端 scene_catalog，和功能四场景模拟的新品是同一份目录 ——
 * 以前商城读 data/mock.ts，服务端查无此物，加购必然 404，
 * 「商品必须包含淘宝链接和淘口令」这条也只能靠假数据糊过去。
 * 加购统一走 api/cart 的 item_type='catalog'，这里不重复实现。
 */
import { API_BASE_URL, request } from '@/utils/request'
import type { MallProduct, MallProductList } from './type'

enum API {
  /** 商品列表；可带 ?category= 过滤 */
  PRODUCTS_URL = '/api/mall/products',
  /** 商品详情，后面接商品 id */
  PRODUCT_URL = '/api/mall/products/',
}

/** 类型再导出的理由见 api/diary/index.ts 的说明 */
export type { MallCategory, MallProduct, MallProductList } from './type'

/** 目录图是服务端相对路径，小程序端要补上域名才显示得出来 */
export function mallImageUrl(src?: string) {
  if (!src) return ''
  if (/^(https?:|data:|blob:)/i.test(src)) return src
  if (src.startsWith('/uploads/')) return `${API_BASE_URL}${src}`
  return src
}

function normalize(product: MallProduct): MallProduct {
  return {
    ...product,
    price: Number(product.price) || 0,
    imageUrl: mallImageUrl(product.imageUrl),
    keywords: product.keywords || [],
    from: product.from || '#ffd1e8',
    to: product.to || '#c9b8ff',
    emoji: product.emoji || '👗',
  }
}

export async function fetchMallProducts(category = ''): Promise<MallProductList> {
  const data = await request<MallProductList>({
    url: API.PRODUCTS_URL,
    data: category ? { category } : {},
  })
  return {
    categories: data.categories || [],
    items: (data.items || []).map(normalize),
  }
}

export async function fetchMallProduct(id: string): Promise<MallProduct> {
  const data = await request<{ product: MallProduct }>({ url: API.PRODUCT_URL + id })
  return normalize(data.product)
}
